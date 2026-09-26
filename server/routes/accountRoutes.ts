import { Router, Response } from 'express';
import { Account, Transaction } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();
router.use(requireDatabase);

// POST /api/accounts/deposit
// Creates a PENDING deposit transaction awaiting admin approval
router.post('/deposit', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { institutionName, accountNumber, amount, targetAccountId } = req.body || {};

    const cleanInstitution = String(institutionName || '').trim();
    const cleanAccountNum = String(accountNumber || '').trim();
    const parsedAmount = parseFloat(amount);

    if (!amount || parsedAmount <= 0) {
      res.status(400).json({ error: 'Please enter a valid deposit amount.' });
      return;
    }

    // Find destination account belonging to this user
    let targetAccount: any = null;
    if (targetAccountId) {
      targetAccount = await Account.findOne({ id: targetAccountId, user_id: userId }).lean<any>();
    }

    if (!targetAccount) {
      // Pick primary checking or first account
      const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
      accounts.sort((a, b) => ({ Checking: 1, Savings: 2 }[a.account_type as 'Checking' | 'Savings'] || 3) - ({ Checking: 1, Savings: 2 }[b.account_type as 'Checking' | 'Savings'] || 3));
      targetAccount = accounts[0] || null;
    }

    if (!targetAccount) {
      res.status(404).json({ error: 'No active recipient account found for this customer profile.' });
      return;
    }

    // Record transaction with status 'PENDING' without incrementing user balance yet
    const txId = 'tx_dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const txDescription = 'ACH Deposit Confirmed';
    const accountId = targetAccount.id;

    console.log('--> Customer Deposit Created:', {
      userId,
      accountId,
      amount: parsedAmount,
      status: 'PENDING',
    });

    const newTx = await Transaction.create({
      id: txId, user_id: userId, account_id: accountId,
      type: 'DEPOSIT', amount: parsedAmount, currency: 'USD', description: txDescription,
      recipient_name: cleanInstitution || 'External Account',
      recipient_account: cleanAccountNum ? `External ...${cleanAccountNum.slice(-4)}` : 'External Account',
      status: 'PENDING', category: 'Deposit', date: today, created_at: Date.now(),
    });
    console.log('New Deposit Inserted:', newTx);

    res.status(200).json({
      success: true,
      message: 'Deposit submitted! Pending administrative approval.',
      depositedAmount: parsedAmount,
      transaction: {
        id: txId,
        account_id: targetAccount.id,
        account_name: targetAccount.nickname,
        account_number: targetAccount.account_number,
        amount: parsedAmount,
        type: 'DEPOSIT',
        description: txDescription,
        status: 'PENDING',
        date: today,
      },
    });
  } catch (err: any) {
    console.error('Deposit Error:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to process deposit.') });
  }
});

export default router;
