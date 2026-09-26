import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Account, Transaction, AuditLog } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAdmin, AuthenticatedRequest } from '../auth.js';

const router = Router();

router.use(requireDatabase);
router.use(requireAdmin);

// POST /api/admin/create-admin
// Creates an administrator using an existing administrator session.
router.post('/create-admin', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    if (await User.exists({ email: cleanEmail })) {
      res.status(409).json({ error: 'An account already exists for this email.' });
      return;
    }

    const id = 'usr_admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await User.create({
      id, email: cleanEmail, password_hash: bcrypt.hashSync(cleanPassword, 10),
      full_name: cleanName, role: 'ADMIN', phone: cleanPhone, created_at: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      admin: { id, email: cleanEmail, full_name: cleanName, role: 'ADMIN', phone: cleanPhone },
    });
  } catch (err: any) {
    console.error('Admin creation error:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to create administrator account.') });
  }
});

// GET /api/admin/overview
router.get('/overview', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, totalAccounts, deposits, totalTransactions, pendingTransactions, totalAuditLogs] = await Promise.all([
      User.countDocuments({ role: /^user$/i }), Account.countDocuments(),
      Account.aggregate([{ $match: { account_type: { $ne: 'Credit Card' } } }, { $group: { _id: null, sum: { $sum: '$balance' } } }]),
      Transaction.countDocuments(), Transaction.countDocuments({ status: /^pending$/i }), AuditLog.countDocuments(),
    ]);

    res.json({
      overview: {
        totalUsers,
        totalAccounts,
        totalDepositsUSD: deposits[0]?.sum || 0,
        totalTransactions,
        pendingTransactions,
        totalAuditLogs,
        systemStatus: 'Operational',
        databaseEngine: 'MongoDB Atlas',
      },
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to fetch admin overview.') });
  }
});

// GET /api/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;

    let filter: Record<string, any> = {};
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [matchingAccounts, matchingUsers] = await Promise.all([
        Account.find({ account_number: new RegExp(term, 'i') }).select('user_id').lean<any[]>(),
        User.find({ $or: [{ email: new RegExp(term, 'i') }, { full_name: new RegExp(term, 'i') }] }).select('id').lean<any[]>(),
      ]);
      filter = { id: { $in: [...new Set([...matchingAccounts.map((a) => a.user_id), ...matchingUsers.map((u) => u.id)])] } };
    }

    const users = await User.find(filter).select('id email full_name role phone created_at').sort({ created_at: -1 }).lean<any[]>();
    const allAccounts = await Account.find({ user_id: { $in: users.map((u) => u.id) } }).sort({ account_type: 1 }).lean<any[]>();
    const accountsByUser = new Map<string, any[]>();
    for (const account of allAccounts) accountsByUser.set(account.user_id, [...(accountsByUser.get(account.user_id) || []), account]);
    const usersWithAccounts = users.map((u) => {
      const accounts = accountsByUser.get(u.id) || [];
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
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve users.') });
  }
});

// GET /api/admin/accounts
router.get('/accounts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    let accountFilter: Record<string, any> = {};
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find({ $or: [{ email: new RegExp(term, 'i') }, { full_name: new RegExp(term, 'i') }] }).select('id').lean<any[]>();
      accountFilter = { $or: [{ account_number: new RegExp(term, 'i') }, { user_id: { $in: matchingUsers.map((u) => u.id) } }] };
    }

    const rows = await Account.find(accountFilter).sort({ created_at: -1 }).lean<any[]>();
    const owners = await User.find({ id: { $in: rows.map((a) => a.user_id) } }).select('id full_name email').lean<any[]>();
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
    const accounts = rows.map((account) => ({ ...account, owner_name: ownersById.get(account.user_id)?.full_name, owner_email: ownersById.get(account.user_id)?.email }));
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve accounts.') });
  }
});

// POST /api/admin/balance-adjustment
router.post('/balance-adjustment', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const account = await Account.findOne({ id: accountId }).lean<any>();
    if (!account) {
      res.status(404).json({ error: 'Target account not found.' });
      return;
    }

    const targetUser = await User.findOne({ id: account.user_id }).lean<any>();

    const adjustmentAmount = action === 'credit' ? parsedAmount : -parsedAmount;
    const updatedAccount = await Account.findOneAndUpdate(
      { id: accountId, ...(action === 'debit' ? { balance: { $gte: parsedAmount } } : {}) },
      { $inc: { balance: adjustmentAmount } },
      { new: true }
    ).lean<any>();
    if (!updatedAccount) {
      res.status(400).json({
        error: `Debit amount ($${parsedAmount.toFixed(2)}) exceeds current account balance ($${account.balance.toFixed(2)}).`,
      });
      return;
    }
    const newBalance = updatedAccount.balance;

    // Record adjustment transaction
    const txId = 'tx_adj_' + Date.now();
    const today = new Date().toISOString().split('T')[0];
    const desc = `Bank Admin ${action === 'credit' ? 'Credit' : 'Debit'}: ${reason.trim()}`;

    await Transaction.create({
      id: txId, user_id: account.user_id, account_id: accountId, type: 'admin_adjustment',
      amount: adjustmentAmount, currency: 'USD', description: desc,
      recipient_name: 'Bank Administrator', recipient_account: `...${account.account_number.slice(-4)}`,
      status: 'Completed', category: 'Adjustment', date: today, created_at: Date.now(),
    });

    // Record Audit Log
    const logId = 'log_' + Date.now();
    const auditAction = action === 'credit' ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT';
    const details = `Directly ${action}ed $${parsedAmount.toFixed(2)} USD to account ${account.account_number} (${account.nickname}) owned by ${targetUser ? targetUser.email : 'Unknown'}. Reason: "${reason}"`;

    await AuditLog.create({
      id: logId, admin_id: req.user!.id, admin_email: req.user!.email,
      action: auditAction, target_user_id: account.user_id, target_account_id: accountId,
      amount: parsedAmount, details, ip_address: req.ip || '127.0.0.1', created_at: new Date().toISOString(),
    });

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
    res.status(500).json({ error: errorMessage(err, 'Failed to process balance adjustment.') });
  }
});

// POST /api/admin/credit-user
// Admin endpoint to instantly credit customer accounts
router.post('/credit-user', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      account = await Account.findOne({ id: accountId }).lean<any>();
    } else if (accountNumber) {
      account = await Account.findOne({ account_number: String(accountNumber).trim() }).lean<any>();
    } else if (userId) {
      const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
      accounts.sort((a, b) => ({ Checking: 1, Savings: 2 }[a.account_type as 'Checking' | 'Savings'] || 3) - ({ Checking: 1, Savings: 2 }[b.account_type as 'Checking' | 'Savings'] || 3));
      account = accounts[0] || null;
    }

    if (!account) {
      res.status(404).json({ error: 'Target customer account could not be found. Please verify the customer or account selection.' });
      return;
    }

    const targetUser = await User.findOne({ id: account.user_id }).select('id email full_name').lean<any>();

    // Increment balance directly
    const updatedAccount = await Account.findOneAndUpdate(
      { id: account.id }, { $inc: { balance: parsedAmount } }, { new: true }
    ).lean<any>();
    if (!updatedAccount) {
      res.status(404).json({ error: 'Target customer account could not be found.' });
      return;
    }
    const newBalance = updatedAccount.balance;

    // Record as APPROVED transaction
    const txId = 'tx_cred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const fullDesc = 'ACH Deposit Confirmed';

    await Transaction.create({
      id: txId, user_id: account.user_id, account_id: account.id, type: 'admin_credit',
      amount: parsedAmount, currency: 'USD', description: fullDesc,
      recipient_name: 'Bank Administrator', recipient_account: account.account_number,
      status: 'APPROVED', category: 'Deposit', date: today, created_at: Date.now(),
    });

    // Record audit log
    const logId = 'aud_cred_' + Date.now();
    await AuditLog.create({
      id: logId, admin_id: req.user!.id, admin_email: req.user!.email,
      action: 'ADMIN_CREDIT', target_user_id: account.user_id, target_account_id: account.id,
      amount: parsedAmount,
      details: `Admin fund injection of $${parsedAmount.toFixed(2)} to ${targetUser?.full_name || 'customer'} (Acct: ${account.account_number}). Memo: ${memoText}`,
      ip_address: req.ip || '127.0.0.1', created_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Successfully credited $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${targetUser?.full_name || 'Customer'}'s account (${account.account_number}).`,
      newBalance,
      creditedAmount: parsedAmount,
      account: updatedAccount,
      user: targetUser,
      transactionId: txId,
    });
  } catch (err: any) {
    console.error('Error in credit-user:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to process admin credit to customer account.') });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const rows = await AuditLog.find().sort({ created_at: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.target_user_id).filter(Boolean) } }).select('id full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.target_account_id).filter(Boolean) } }).select('id account_number').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const logs = rows.map((row) => ({
      ...row,
      target_user_name: usersById.get(row.target_user_id)?.full_name,
      target_account_number: accountsById.get(row.target_account_id)?.account_number,
    }));
    res.json({ logs });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve audit logs.') });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const rows = await Transaction.find().sort({ date: -1, created_at: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.user_id) } }).select('id email full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.account_id) } }).select('id account_number nickname').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const transactions = rows.map((row) => ({
      ...row,
      user_email: usersById.get(row.user_id)?.email,
      user_name: usersById.get(row.user_id)?.full_name,
      account_number: accountsById.get(row.account_id)?.account_number,
      account_name: accountsById.get(row.account_id)?.nickname,
    }));
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve system transactions.') });
  }
});

// GET /api/admin/pending-deposits
// Fetch all PENDING deposit transactions with customer details
router.get('/pending-deposits', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await Transaction.find({ status: /^pending$/i }).sort({ date: -1 }).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.user_id) } }).select('id email full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.account_id) } }).select('id account_number nickname').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const pending = rows.map((row) => ({
      ...row,
      user_email: usersById.get(row.user_id)?.email,
      user_name: usersById.get(row.user_id)?.full_name,
      account_number: accountsById.get(row.account_id)?.account_number,
      account_name: accountsById.get(row.account_id)?.nickname,
    }));
    res.status(200).json({ success: true, pendingDeposits: pending });
  } catch (err: any) {
    console.error('Error fetching pending deposits:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve pending deposits.') });
  }
});

// POST /api/admin/approve-deposit
// Approves a PENDING deposit transaction and credits the account
router.post('/approve-deposit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required.' });
      return;
    }

    // Retrieve transaction details
    const trans = await Transaction.findOne({ id: transactionId }).lean<any>();
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
    const account = await Account.findOne({ id: trans.account_id }).lean<any>();
    if (!account) {
      res.status(404).json({ error: 'Associated account not found.' });
      return;
    }

    // Balances are stored on accounts in this schema. Increment the associated account atomically.
    const approved = await Transaction.findOneAndUpdate(
      { id: transactionId, status: 'PENDING' },
      { $set: { status: 'APPROVED' } },
      { new: true }
    ).lean<any>();
    if (!approved) {
      res.status(409).json({ error: 'Transaction is already being processed or is no longer pending.' });
      return;
    }
    const updatedAccount = await Account.findOneAndUpdate(
      { id: trans.account_id }, { $inc: { balance: trans.amount } }, { new: true }
    ).lean<any>();
    if (!updatedAccount) {
      await Transaction.updateOne({ id: transactionId, status: 'APPROVED' }, { $set: { status: 'PENDING' } });
      res.status(404).json({ error: 'Associated account not found.' });
      return;
    }
    const newBalance = updatedAccount.balance;

    // Record audit log
    const logId = 'aud_app_' + Date.now();
    await AuditLog.create({
      id: logId, admin_id: req.user!.id, admin_email: req.user!.email,
      action: 'APPROVE_DEPOSIT', target_user_id: trans.user_id,
      target_account_id: trans.account_id, amount: trans.amount,
      details: `Approved pending deposit of $${trans.amount.toFixed(2)} to account ${account.account_number}. Transaction: ${trans.description}`,
      ip_address: req.ip || '127.0.0.1', created_at: new Date().toISOString(),
    });

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
    res.status(500).json({ error: errorMessage(err, 'Failed to approve deposit.') });
  }
});

export default router;
