import { Router, Response } from 'express';
import { get, run } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();

// POST /api/accounts/deposit
// Creates a PENDING deposit transaction awaiting admin approval
router.post('/deposit', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
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
      targetAccount = get<any>('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [targetAccountId, userId]);
    }

    if (!targetAccount) {
      // Pick primary checking or first account
      targetAccount = get<any>(
        `SELECT * FROM accounts WHERE user_id = ? ORDER BY 
          CASE account_type 
            WHEN 'Checking' THEN 1 
            WHEN 'Savings' THEN 2 
            ELSE 3 
          END ASC LIMIT 1`,
        [userId]
      );
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

    run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, 'DEPOSIT', ?, 'USD', ?, ?, ?, 'PENDING', 'Deposit', ?, ?)`,
      [
        txId,
        userId,
        accountId,
        parsedAmount,
        txDescription,
        cleanInstitution || 'External Account',
        cleanAccountNum ? `External ...${cleanAccountNum.slice(-4)}` : 'External Account',
        today,
        Date.now(),
      ]
    );

    const newTx = get<any>('SELECT * FROM transactions WHERE id = ?', [txId]);
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
    res.status(500).json({ error: 'Failed to process deposit.' });
  }
});

export default router;
