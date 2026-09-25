import { Router, Response } from 'express';
import { query, get, run } from '../db.js';
import { requireAuth, AuthenticatedRequest, generateOTP } from '../auth.js';

const router = Router();

// POST /api/transfers/initiate
router.post('/initiate', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
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
    const sourceAccount = get<any>(
      'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
      [sourceAccountId, userId]
    );

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
      const destAccount = get<any>(
        'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
        [destinationAccountId, userId]
      );
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

    run(
      `INSERT INTO verification_codes (id, user_id, email, phone, code, purpose, metadata, expires_at, verified, created_at)
       VALUES (?, ?, ?, ?, ?, 'transfer', ?, ?, 0, ?)`,
      [
        verificationId,
        userId,
        req.user!.email,
        req.user!.phone,
        otpCode,
        JSON.stringify(transferPayload),
        expiresAt,
        Date.now(),
      ]
    );

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
    res.status(500).json({ error: 'Transfer initiation failed.' });
  }
});

// POST /api/transfers/confirm
router.post('/confirm', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { verificationId, code } = req.body;

    if (!verificationId || !code) {
      res.status(400).json({ error: 'Verification ID and 6-digit code are required.' });
      return;
    }

    const verificationRecord = get<any>(
      `SELECT * FROM verification_codes 
       WHERE id = ? AND user_id = ? AND purpose = 'transfer' AND verified = 0 AND expires_at > ?`,
      [verificationId, userId, Date.now()]
    );

    if (!verificationRecord || verificationRecord.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid or expired authorization code. Please verify the 6-digit code and try again.' });
      return;
    }

    const payload = JSON.parse(verificationRecord.metadata || '{}');
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
    const sourceAccount = get<any>('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [
      sourceAccountId,
      userId,
    ]);

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found.' });
      return;
    }

    if (sourceAccount.balance < amount) {
      res.status(400).json({ error: 'Transfer failed: Insufficient funds in source account.' });
      return;
    }

    // Execute transfer
    const newSourceBalance = sourceAccount.balance - amount;
    run('UPDATE accounts SET balance = ? WHERE id = ?', [newSourceBalance, sourceAccountId]);

    const txIdOut = 'tx_' + Date.now() + '_out';
    const today = new Date().toISOString().split('T')[0];

    // Create Outgoing Transaction
    const outgoingDesc = `Online Banking Transfer Out to ${recipientName}`;
    run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, 'transfer_out', ?, 'USD', ?, ?, ?, 'Completed', 'Transfer', ?, ?)`,
      [
        txIdOut,
        userId,
        sourceAccountId,
        amount,
        outgoingDesc,
        recipientName,
        recipientAccount,
        today,
        Date.now(),
      ]
    );

    // If destination account is internal or registered user account:
    if (transferType === 'internal' && destinationAccountId) {
      const destAccount = get<any>('SELECT * FROM accounts WHERE id = ?', [destinationAccountId]);
      if (destAccount) {
        const newDestBalance = destAccount.balance + amount;
        run('UPDATE accounts SET balance = ? WHERE id = ?', [newDestBalance, destinationAccountId]);

        const txIdIn = 'tx_' + Date.now() + '_in';
        const incomingDesc = `Transfer Received from ${sourceAccount.nickname}`;
        run(
          `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
           VALUES (?, ?, ?, 'transfer_in', ?, 'USD', ?, ?, ?, 'Completed', 'Transfer', ?, ?)`,
          [
            txIdIn,
            destAccount.user_id,
            destinationAccountId,
            amount,
            incomingDesc,
            sourceAccount.nickname,
            `...${sourceAccount.account_number.slice(-4)}`,
            today,
            Date.now() + 1,
          ]
        );
      }
    }

    // Mark verification verified
    run('UPDATE verification_codes SET verified = 1 WHERE id = ?', [verificationId]);

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
    res.status(500).json({ error: 'Transfer execution failed.' });
  }
});

// GET /api/transfers/recent-recipients
router.get('/recent-recipients', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const recipients = query<any>(
      `SELECT DISTINCT recipient_name, recipient_account 
       FROM transactions 
       WHERE user_id = ? AND recipient_name IS NOT NULL AND recipient_name != ''
       LIMIT 6`,
      [userId]
    );
    res.json({ recipients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve recipients.' });
  }
});

export default router;
