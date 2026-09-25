import { Router, Response } from 'express';
import { query, get, run } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/user/accounts
router.get('/accounts', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const accounts = query<any>(
      `SELECT * FROM accounts WHERE user_id = ? ORDER BY 
        CASE account_type 
          WHEN 'Checking' THEN 1 
          WHEN 'Savings' THEN 2 
          WHEN 'Credit Card' THEN 3 
          ELSE 4 
        END, created_at ASC`,
      [userId]
    );

    // Format account numbers (e.g. "...4821") and balances
    const formattedAccounts = accounts.map((acc) => {
      const last4 = acc.account_number.slice(-4);
      return {
        ...acc,
        display_number: `...${last4}`,
        masked_number: `Account ending in ${last4}`,
        available_balance: acc.balance,
      };
    });

    res.json({ accounts: formattedAccounts });
  } catch (err: any) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to retrieve accounts.' });
  }
});

// GET /api/user/transactions
router.get('/transactions', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { accountId, search, status, limit = 50 } = req.query;

    let sql = `
      SELECT t.*, a.nickname as account_name, a.account_number
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.user_id = ?
    `;
    const params: any[] = [userId];

    if (accountId && accountId !== 'all') {
      sql += ' AND t.account_id = ?';
      params.push(accountId);
    }

    if (status && status !== 'all') {
      sql += ' AND LOWER(t.status) = LOWER(?)';
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      sql += ' AND (LOWER(t.description) LIKE ? OR LOWER(t.recipient_name) LIKE ?)';
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const transactions = query<any>(sql, params);
    res.json({ transactions });
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to retrieve transactions.' });
  }
});

// GET /api/user/summary
router.get('/summary', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const accounts = query<any>('SELECT * FROM accounts WHERE user_id = ?', [userId]);

    let totalCheckingSavings = 0;
    let totalCreditUsed = 0;
    let totalCreditLimit = 0;

    accounts.forEach((acc) => {
      if (acc.account_type === 'Credit Card') {
        totalCreditUsed += acc.balance;
        totalCreditLimit += (acc.credit_limit || 0);
      } else {
        totalCheckingSavings += acc.balance;
      }
    });

    const pendingCountRow = get<any>(
      "SELECT count(*) as count FROM transactions WHERE user_id = ? AND status = 'Pending'",
      [userId]
    );

    res.json({
      totalDepositBalanceUSD: totalCheckingSavings,
      totalCreditBalanceUSD: totalCreditUsed,
      totalCreditLimitUSD: totalCreditLimit,
      pendingTransactionsCount: pendingCountRow ? pendingCountRow.count : 0,
      accountsCount: accounts.length,
    });
  } catch (err: any) {
    console.error('Error fetching user summary:', err);
    res.status(500).json({ error: 'Failed to retrieve summary.' });
  }
});

// GET /api/user/profile
router.get('/profile', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = get<any>('SELECT id, email, full_name, role, phone, security_pin, created_at FROM users WHERE id = ?', [
      req.user!.id,
    ]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accounts = query<any>(
      'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC',
      [req.user!.id]
    );
    const primaryAccount = accounts.length > 0 ? accounts[0] : null;

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        security_pin: user.security_pin || '••••',
        created_at: user.created_at,
        account_number: primaryAccount ? primaryAccount.account_number : '4800000000',
        routing_number: primaryAccount ? primaryAccount.routing_number : '026009593',
        status: primaryAccount ? primaryAccount.status : 'Active',
        encryption_status: 'Active (256-bit AES Hardware Encrypted)',
        accounts_count: accounts.length,
      },
      accounts: accounts.map((acc) => ({
        ...acc,
        display_number: `...${acc.account_number.slice(-4)}`,
      })),
    });
  } catch (err: any) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// POST /api/user/deposit or /api/user/accounts/deposit
router.post(['/deposit', '/accounts/deposit'], requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { institutionName, accountNumber, routingNumber, amount, targetAccountId } = req.body || {};

    const cleanInstitution = String(institutionName || '').trim();
    const cleanAccountNum = String(accountNumber || '').trim();
    const cleanRoutingNum = String(routingNumber || '').trim();
    const parsedAmount = parseFloat(amount);

    if (!cleanInstitution) {
      res.status(400).json({ error: 'External Institution Name is required (e.g. Chase, Wells Fargo).' });
      return;
    }

    if (!cleanAccountNum) {
      res.status(400).json({ error: 'External Account Number is required.' });
      return;
    }

    if (!cleanRoutingNum) {
      res.status(400).json({ error: 'External 9-digit Routing Number is required.' });
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Deposit amount must be a positive number greater than $0.00.' });
      return;
    }

    let targetAccount: any = null;
    if (targetAccountId) {
      targetAccount = get<any>('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [targetAccountId, userId]);
    }

    if (!targetAccount) {
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

    const newBalance = targetAccount.balance + parsedAmount;
    run('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, targetAccount.id]);

    const txId = 'tx_dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const extLast4 = cleanAccountNum.slice(-4) || 'XXXX';
    const txDescription = `External ACH Deposit: ${cleanInstitution} (Acct ...${extLast4})`;

    run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, 'deposit', ?, 'USD', ?, ?, ?, 'Completed', 'Deposit', ?, ?)`,
      [
        txId,
        userId,
        targetAccount.id,
        parsedAmount,
        txDescription,
        cleanInstitution,
        `External ...${extLast4}`,
        today,
        Date.now(),
      ]
    );

    const logId = 'aud_dep_' + Date.now();
    run(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, ip_address, created_at)
       VALUES (?, 'customer', ?, 'EXTERNAL_DEPOSIT', ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        req.user!.email,
        userId,
        targetAccount.id,
        parsedAmount,
        `External ACH Transfer of $${parsedAmount.toFixed(2)} from ${cleanInstitution} (Routing: ${cleanRoutingNum}, Acct: ...${extLast4}) into account ${targetAccount.account_number}`,
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.status(200).json({
      success: true,
      message: `Deposit of $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${cleanInstitution} successfully credited to your ${targetAccount.nickname}.`,
      newBalance,
      depositedAmount: parsedAmount,
      account: { ...targetAccount, balance: newBalance },
      transaction: {
        id: txId,
        account_id: targetAccount.id,
        account_name: targetAccount.nickname,
        account_number: targetAccount.account_number,
        amount: parsedAmount,
        type: 'deposit',
        description: txDescription,
        recipient_name: cleanInstitution,
        recipient_account: `External ...${extLast4}`,
        status: 'Completed',
        category: 'Deposit',
        date: today,
        created_at: Date.now(),
      },
    });
  } catch (err: any) {
    console.error('Error processing external deposit:', err);
    res.status(500).json({ error: 'An error occurred while processing the external deposit.' });
  }
});

export default router;
