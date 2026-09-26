import { Router, Response } from 'express';
import { Account, Transaction, VerificationCode } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAuth, AuthenticatedRequest, generateOTP } from '../auth.js';

const router = Router();
router.use(requireDatabase);

// POST /api/transfers/initiate
router.post('/initiate', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      sourceAccountId,
      transferType = 'internal',
      destinationAccountId,
      recipientName,
      recipientAccount,
      recipientRouting,
      amount,
      memo = '',
      channel = 'email',
    } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Please enter a valid transfer amount greater than $0.00 USD.' });
      return;
    }

    // Verify source account
    const sourceAccount = await Account.findOne({ id: sourceAccountId, user_id: userId }).lean<any>();

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found.' });
      return;
    }

    if (sourceAccount.balance < parsedAmount) {
      res.status(400).json({
        error: `Insufficient funds. Available balance is $${sourceAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`,
      });
      return;
    }

    // Determine destination details
    let destDisplayName = recipientName || 'External Recipient';
    let destDisplayAccount = recipientAccount || '';

    if (transferType === 'internal') {
      const destAccount = await Account.findOne({ id: destinationAccountId, user_id: userId }).lean<any>();
      if (!destAccount) {
        res.status(400).json({ error: 'Destination account not found.' });
        return;
      }
      if (destAccount.id === sourceAccount.id) {
        res.status(400).json({ error: 'Source and destination accounts must be different.' });
        return;
      }
      destDisplayName = destAccount.nickname;
      destDisplayAccount = `...${destAccount.account_number.slice(-4)}`;
    }

    // Generate 2FA security code for transaction approval
    const otpCode = generateOTP();
    const verificationId = 'vtx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    const transferPayload = {
      userId,
      sourceAccountId: sourceAccount.id,
      sourceAccountNumber: sourceAccount.account_number,
      sourceAccountNickname: sourceAccount.nickname,
      destinationAccountId: destinationAccountId || null,
      recipientName: destDisplayName,
      recipientAccount: destDisplayAccount,
      recipientRouting: recipientRouting || '',
      amount: parsedAmount,
      currency: 'USD',
      transferType,
      memo: memo || 'Online Banking Transfer',
    };

    await VerificationCode.create({
      id: verificationId, user_id: userId, email: req.user!.email, phone: req.user!.phone,
      code: otpCode, purpose: 'transfer', metadata: transferPayload,
      expires_at: expiresAt, verified: false, created_at: Date.now(),
    });

    const maskedContact = channel === 'sms'
      ? (req.user!.phone.length >= 4 ? `(***) ***-${req.user!.phone.slice(-4)}` : req.user!.phone)
      : (req.user!.email.replace(/^(.)(.*)(@.*)$/, '$1***$3'));

    res.json({
      require2FA: true,
      verificationId,
      amount: parsedAmount,
      sourceAccountNickname: sourceAccount.nickname,
      sourceAccountLast4: sourceAccount.account_number.slice(-4),
      recipientName: destDisplayName,
      recipientAccount: destDisplayAccount,
      channel,
      maskedContact,
      // For immediate verification in testing sandbox:
      simulatedOtp: otpCode,
      message: `Security verification required. A 6-digit authorization code has been dispatched via ${channel === 'sms' ? 'SMS' : 'Email'}.`,
    });
  } catch (err: any) {
    console.error('Error initiating transfer:', err);
    res.status(500).json({ error: errorMessage(err, 'Transfer initiation failed.') });
  }
});

// POST /api/transfers/confirm
router.post('/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { verificationId, code } = req.body;

    if (!verificationId || !code) {
      res.status(400).json({ error: 'Verification ID and 6-digit code are required.' });
      return;
    }

    const verificationRecord = await VerificationCode.findOne({
      id: verificationId, user_id: userId, purpose: 'transfer',
      verified: false, expires_at: { $gt: Date.now() },
    }).lean<any>();

    if (!verificationRecord || verificationRecord.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid or expired authorization code. Please verify the 6-digit code and try again.' });
      return;
    }

    const payload = verificationRecord.metadata || {};
    const {
      sourceAccountId,
      destinationAccountId,
      recipientName,
      recipientAccount,
      amount,
      memo,
      transferType,
    } = payload;

    // Check source account balance again
    const sourceAccount = await Account.findOne({ id: sourceAccountId, user_id: userId }).lean<any>();

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found.' });
      return;
    }

    if (sourceAccount.balance < amount) {
      res.status(400).json({ error: 'Transfer failed: Insufficient funds in source account.' });
      return;
    }

    // Execute transfer
    const debitedAccount = await Account.findOneAndUpdate(
      { id: sourceAccountId, user_id: userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    ).lean<any>();
    if (!debitedAccount) {
      res.status(400).json({ error: 'Transfer failed: Insufficient funds in source account.' });
      return;
    }
    const newSourceBalance = debitedAccount.balance;

    const txIdOut = 'tx_' + Date.now() + '_out';
    const today = new Date().toISOString().split('T')[0];

    // Create Outgoing Transaction
    const outgoingDesc = `Online Banking Transfer Out to ${recipientName}`;
    await Transaction.create({
      id: txIdOut, user_id: userId, account_id: sourceAccountId,
      type: 'transfer_out', amount, currency: 'USD', description: outgoingDesc,
      recipient_name: recipientName, recipient_account: recipientAccount,
      status: 'Completed', category: 'Transfer', date: today, created_at: Date.now(),
    });

    // If destination account is internal or registered user account:
    if (transferType === 'internal' && destinationAccountId) {
      const destAccount = await Account.findOne({ id: destinationAccountId }).lean<any>();
      if (destAccount) {
        await Account.updateOne({ id: destinationAccountId }, { $inc: { balance: amount } });

        const txIdIn = 'tx_' + Date.now() + '_in';
        const incomingDesc = `Transfer Received from ${sourceAccount.nickname}`;
        await Transaction.create({
          id: txIdIn, user_id: destAccount.user_id, account_id: destinationAccountId,
          type: 'transfer_in', amount, currency: 'USD', description: incomingDesc,
          recipient_name: sourceAccount.nickname,
          recipient_account: `...${sourceAccount.account_number.slice(-4)}`,
          status: 'Completed', category: 'Transfer', date: today, created_at: Date.now() + 1,
        });
      }
    }

    // Mark verification verified
    await VerificationCode.updateOne({ id: verificationId, verified: false }, { $set: { verified: true } });

    res.json({
      success: true,
      transactionId: txIdOut,
      newSourceBalance,
      amount,
      recipientName,
      message: `Your transfer of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD to ${recipientName} has been authorized and completed.`,
    });
  } catch (err: any) {
    console.error('Error confirming transfer:', err);
    res.status(500).json({ error: errorMessage(err, 'Transfer execution failed.') });
  }
});

// GET /api/transfers/recent-recipients
router.get('/recent-recipients', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const recipients = await Transaction.aggregate([
      { $match: { user_id: userId, recipient_name: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: { recipient_name: '$recipient_name', recipient_account: '$recipient_account' } } },
      { $limit: 6 },
      { $project: { _id: 0, recipient_name: '$_id.recipient_name', recipient_account: '$_id.recipient_account' } },
    ]);
    res.json({ recipients });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve recipients.') });
  }
});

export default router;
