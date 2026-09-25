import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, get, run } from '../db.js';
import { requireAdmin, AuthenticatedRequest } from '../auth.js';

const router = Router();

// Apply requireAdmin middleware to all routes in this router
router.use(requireAdmin);

// POST /api/admin/create-admin
// Creates an administrator using an existing administrator session.
router.post('/create-admin', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { email, password, passcode, fullName, phone } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || passcode || '');
    const cleanName = String(fullName || 'Administrator').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanEmail || !cleanPassword || !cleanName || !cleanPhone) {
      res.status(400).json({ error: 'Email, passcode, full name, and phone are required.' });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }
    if (get<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail])) {
      res.status(409).json({ error: 'An account already exists for this email.' });
      return;
    }

    const id = 'usr_admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    run(
      `INSERT INTO users (id, email, password_hash, full_name, role, phone, created_at)
       VALUES (?, ?, ?, ?, 'ADMIN', ?, ?)`,
      [id, cleanEmail, bcrypt.hashSync(cleanPassword, 10), cleanName, cleanPhone, new Date().toISOString()]
    );

    res.status(201).json({
      success: true,
      admin: { id, email: cleanEmail, full_name: cleanName, role: 'ADMIN', phone: cleanPhone },
    });
  } catch (err: any) {
    console.error('Admin creation error:', err);
    res.status(500).json({ error: 'Failed to create administrator account.' });
  }
});

// GET /api/admin/overview
router.get('/overview', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const totalUsers = get<any>("SELECT count(*) as count FROM users WHERE role = 'user'")?.count || 0;
    const totalAccounts = get<any>("SELECT count(*) as count FROM accounts")?.count || 0;
    const totalDeposits = get<any>("SELECT SUM(balance) as sum FROM accounts WHERE account_type != 'Credit Card'")?.sum || 0;
    const totalTransactions = get<any>("SELECT count(*) as count FROM transactions")?.count || 0;
    const pendingTransactions = get<any>("SELECT count(*) as count FROM transactions WHERE status = 'Pending'")?.count || 0;
    const totalAuditLogs = get<any>("SELECT count(*) as count FROM audit_logs")?.count || 0;

    res.json({
      overview: {
        totalUsers,
        totalAccounts,
        totalDepositsUSD: totalDeposits,
        totalTransactions,
        pendingTransactions,
        totalAuditLogs,
        systemStatus: 'Operational',
        databaseEngine: 'SQLite (Embedded Server-Side)',
      },
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview.' });
  }
});

// GET /api/admin/users
router.get('/users', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { search } = req.query;

    let usersQuery = 'SELECT id, email, full_name, role, phone, created_at FROM users';
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      usersQuery += ` WHERE (LOWER(email) LIKE ? OR LOWER(full_name) LIKE ? OR id IN (
        SELECT user_id FROM accounts WHERE account_number LIKE ?
      ))`;
      params.push(term, term, `%${search.trim()}%`);
    }

    usersQuery += ' ORDER BY created_at DESC';
    const users = query<any>(usersQuery, params);

    // Fetch accounts for each user
    const usersWithAccounts = users.map((u) => {
      const accounts = query<any>('SELECT * FROM accounts WHERE user_id = ? ORDER BY account_type ASC', [u.id]);
      const totalBalanceUSD = accounts
        .filter((a) => a.account_type !== 'Credit Card')
        .reduce((sum, a) => sum + a.balance, 0);

      return {
        ...u,
        accounts,
        totalBalanceUSD,
      };
    });

    res.json({ users: usersWithAccounts });
  } catch (err: any) {
    console.error('Error fetching users for admin:', err);
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// GET /api/admin/accounts
router.get('/accounts', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT a.*, u.full_name as owner_name, u.email as owner_email
      FROM accounts a
      JOIN users u ON a.user_id = u.id
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ' WHERE (LOWER(a.account_number) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ?)';
      params.push(term, term, term);
    }

    sql += ' ORDER BY a.created_at DESC';
    const accounts = query<any>(sql, params);
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve accounts.' });
  }
});

// POST /api/admin/balance-adjustment
router.post('/balance-adjustment', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { accountId, action, amount, reason } = req.body;

    if (!accountId || !action || !amount || !reason) {
      res.status(400).json({ error: 'Account ID, action (credit/debit), amount, and reason are required.' });
      return;
    }

    if (action !== 'credit' && action !== 'debit') {
      res.status(400).json({ error: "Action must be either 'credit' or 'debit'." });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Adjustment amount must be a positive number.' });
      return;
    }

    const account = get<any>('SELECT * FROM accounts WHERE id = ?', [accountId]);
    if (!account) {
      res.status(404).json({ error: 'Target account not found.' });
      return;
    }

    const targetUser = get<any>('SELECT * FROM users WHERE id = ?', [account.user_id]);

    let newBalance = account.balance;
    let adjustmentAmount = parsedAmount;

    if (action === 'credit') {
      newBalance += parsedAmount;
    } else {
      if (account.balance < parsedAmount) {
        res.status(400).json({
          error: `Debit amount ($${parsedAmount.toFixed(2)}) exceeds current account balance ($${account.balance.toFixed(2)}).`,
        });
        return;
      }
      newBalance -= parsedAmount;
      adjustmentAmount = -parsedAmount;
    }

    // Update account balance
    run('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, accountId]);

    // Record adjustment transaction
    const txId = 'tx_adj_' + Date.now();
    const today = new Date().toISOString().split('T')[0];
    const desc = `Bank Admin ${action === 'credit' ? 'Credit' : 'Debit'}: ${reason.trim()}`;

    run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, 'admin_adjustment', ?, 'USD', ?, 'Bank Administrator', ?, 'Completed', 'Adjustment', ?, ?)`,
      [
        txId,
        account.user_id,
        accountId,
        adjustmentAmount,
        desc,
        `...${account.account_number.slice(-4)}`,
        today,
        Date.now(),
      ]
    );

    // Record Audit Log
    const logId = 'log_' + Date.now();
    const auditAction = action === 'credit' ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT';
    const details = `Directly ${action}ed $${parsedAmount.toFixed(2)} USD to account ${account.account_number} (${account.nickname}) owned by ${targetUser ? targetUser.email : 'Unknown'}. Reason: "${reason}"`;

    run(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        req.user!.id,
        req.user!.email,
        auditAction,
        account.user_id,
        accountId,
        parsedAmount,
        details,
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.json({
      success: true,
      newBalance,
      adjustedAmount: parsedAmount,
      action,
      accountNumber: account.account_number,
      message: `Account successfully ${action}ed by $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD. New balance: $${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`,
    });
  } catch (err: any) {
    console.error('Error in balance adjustment:', err);
    res.status(500).json({ error: 'Failed to process balance adjustment.' });
  }
});

// POST /api/admin/credit-user
// Admin endpoint to instantly credit customer accounts
router.post('/credit-user', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { userId, accountId, accountNumber, amount, memo, description, reason } = req.body || {};
    const memoText = String(memo || description || reason || 'Administrative Credit / Fund Injection').trim();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Credit amount must be a positive number greater than $0.00.' });
      return;
    }

    let account: any = null;
    if (accountId) {
      account = get<any>('SELECT * FROM accounts WHERE id = ?', [accountId]);
    } else if (accountNumber) {
      account = get<any>('SELECT * FROM accounts WHERE account_number = ?', [String(accountNumber).trim()]);
    } else if (userId) {
      account = get<any>(
        `SELECT * FROM accounts WHERE user_id = ? ORDER BY 
          CASE account_type 
            WHEN 'Checking' THEN 1 
            WHEN 'Savings' THEN 2 
            ELSE 3 
          END ASC LIMIT 1`,
        [userId]
      );
    }

    if (!account) {
      res.status(404).json({ error: 'Target customer account could not be found. Please verify the customer or account selection.' });
      return;
    }

    const targetUser = get<any>('SELECT id, email, full_name FROM users WHERE id = ?', [account.user_id]);

    // Increment balance directly
    const newBalance = account.balance + parsedAmount;
    run('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, account.id]);

    // Record as APPROVED transaction
    const txId = 'tx_cred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const fullDesc = 'ACH Deposit Confirmed';

    run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, 'admin_credit', ?, 'USD', ?, 'Bank Administrator', ?, 'APPROVED', 'Deposit', ?, ?)`,
      [
        txId,
        account.user_id,
        account.id,
        parsedAmount,
        fullDesc,
        account.account_number,
        today,
        Date.now(),
      ]
    );

    // Record audit log
    const logId = 'aud_cred_' + Date.now();
    run(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, ip_address, created_at)
       VALUES (?, ?, ?, 'ADMIN_CREDIT', ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        req.user!.id,
        req.user!.email,
        account.user_id,
        account.id,
        parsedAmount,
        `Admin fund injection of $${parsedAmount.toFixed(2)} to ${targetUser?.full_name || 'customer'} (Acct: ${account.account_number}). Memo: ${memoText}`,
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.json({
      success: true,
      message: `Successfully credited $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${targetUser?.full_name || 'Customer'}'s account (${account.account_number}).`,
      newBalance,
      creditedAmount: parsedAmount,
      account: { ...account, balance: newBalance },
      user: targetUser,
      transactionId: txId,
    });
  } catch (err: any) {
    console.error('Error in credit-user:', err);
    res.status(500).json({ error: 'Failed to process admin credit to customer account.' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { limit = 100 } = req.query;
    const logs = query<any>(
      `SELECT al.*, u.full_name as target_user_name, a.account_number as target_account_number
       FROM audit_logs al
       LEFT JOIN users u ON al.target_user_id = u.id
       LEFT JOIN accounts a ON al.target_account_id = a.id
       ORDER BY al.created_at DESC LIMIT ?`,
      [Number(limit)]
    );
    res.json({ logs });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// GET /api/admin/transactions
router.get('/transactions', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { limit = 100 } = req.query;
    const transactions = query<any>(
      `SELECT t.*, u.email as user_email, u.full_name as user_name, a.account_number, a.nickname as account_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       JOIN accounts a ON t.account_id = a.id
       ORDER BY t.date DESC, t.created_at DESC LIMIT ?`,
      [Number(limit)]
    );
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve system transactions.' });
  }
});

// GET /api/admin/pending-deposits
// Fetch all PENDING deposit transactions with customer details
router.get('/pending-deposits', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const rows = query<any>(
      `SELECT transactions.*, users.email as user_email, users.full_name as user_name,
              accounts.account_number, accounts.nickname as account_name
       FROM transactions
       LEFT JOIN users ON users.id = transactions.user_id
       LEFT JOIN accounts ON accounts.id = transactions.account_id
       WHERE UPPER(transactions.status) = 'PENDING'
       ORDER BY transactions.date DESC`,
      []
    );
    console.log('--> Pending Fetch Executed. Found rows:', rows);
    console.log('API sending pending deposits:', rows.length);
    res.status(200).json({ success: true, pendingDeposits: rows || [] });
  } catch (err: any) {
    console.error('Error fetching pending deposits:', err);
    res.status(500).json({ error: 'Failed to retrieve pending deposits.' });
  }
});

// POST /api/admin/approve-deposit
// Approves a PENDING deposit transaction and credits the account
router.post('/approve-deposit', (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required.' });
      return;
    }

    // Retrieve transaction details
    const trans = get<any>('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (!trans) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (trans.status === 'APPROVED') {
      res.status(400).json({ error: 'Transaction is already approved.' });
      return;
    }

    if (trans.status !== 'PENDING') {
      res.status(400).json({ error: 'Only pending transactions can be approved.' });
      return;
    }

    // Retrieve account to update balance
    const account = get<any>('SELECT * FROM accounts WHERE id = ?', [trans.account_id]);
    if (!account) {
      res.status(404).json({ error: 'Associated account not found.' });
      return;
    }

    // Balances are stored on accounts in this schema. Increment the associated account atomically.
    run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [trans.amount, trans.account_id]);
    const updatedAccount = get<any>('SELECT * FROM accounts WHERE id = ?', [trans.account_id]);
    const newBalance = updatedAccount?.balance ?? account.balance + trans.amount;

    // Mark transaction as APPROVED
    run('UPDATE transactions SET status = ? WHERE id = ?', ['APPROVED', transactionId]);

    // Record audit log
    const logId = 'aud_app_' + Date.now();
    run(
      `INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, ip_address, created_at)
       VALUES (?, ?, ?, 'APPROVE_DEPOSIT', ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        req.user!.id,
        req.user!.email,
        trans.user_id,
        trans.account_id,
        trans.amount,
        `Approved pending deposit of $${trans.amount.toFixed(2)} to account ${account.account_number}. Transaction: ${trans.description}`,
        req.ip || '127.0.0.1',
        new Date().toISOString(),
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Deposit approved and credited.',
      transaction: {
        id: transactionId,
        status: 'APPROVED',
        amount: trans.amount,
        description: trans.description,
      },
      account: {
        id: trans.account_id,
        account_number: account.account_number,
        nickname: account.nickname,
        previousBalance: account.balance,
        newBalance: newBalance,
      },
    });
  } catch (err: any) {
    console.error('Error approving deposit:', err);
    res.status(500).json({ error: err.message || 'Failed to approve deposit.' });
  }
});

export default router;
