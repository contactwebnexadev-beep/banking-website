import { Router, Response } from 'express';
import { User, Account, Transaction, AuditLog } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';

const router = Router();
router.use(requireDatabase);

// GET /api/user/accounts
router.get('/accounts', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
    const rank: Record<string, number> = { Checking: 1, Savings: 2, 'Credit Card': 3 };
    accounts.sort((a, b) => (rank[a.account_type] || 4) - (rank[b.account_type] || 4));

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
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve accounts.') });
  }
});

// GET /api/user/transactions
router.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { accountId, search, status, limit = 50 } = req.query;

    const filter: Record<string, any> = { user_id: userId };
    if (accountId && accountId !== 'all') {
      filter.account_id = accountId;
    }

    if (status && status !== 'all') {
      filter.status = new RegExp(`^${String(status).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ description: new RegExp(term, 'i') }, { recipient_name: new RegExp(term, 'i') }];
    }

    const rows = await Transaction.find(filter).sort({ date: -1, created_at: -1 }).limit(Math.min(Number(limit) || 50, 500)).lean<any[]>();
    const accountIds = [...new Set(rows.map((row) => row.account_id))];
    const accounts = await Account.find({ id: { $in: accountIds } }).select('id nickname account_number').lean<any[]>();
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const transactions = rows.map((row) => ({
      ...row,
      account_name: accountsById.get(row.account_id)?.nickname,
      account_number: accountsById.get(row.account_id)?.account_number,
    }));
    res.json({ transactions });
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve transactions.') });
  }
});

// GET /api/user/summary
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const accounts = await Account.find({ user_id: userId }).lean<any[]>();

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

    const pendingTransactionsCount = await Transaction.countDocuments({ user_id: userId, status: /^pending$/i });

    res.json({
      totalDepositBalanceUSD: totalCheckingSavings,
      totalCreditBalanceUSD: totalCreditUsed,
      totalCreditLimitUSD: totalCreditLimit,
      pendingTransactionsCount,
      accountsCount: accounts.length,
    });
  } catch (err: any) {
    console.error('Error fetching user summary:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve summary.') });
  }
});

// GET /api/user/profile
router.get('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ id: req.user!.id }).select('id email full_name role phone created_at').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const accounts = await Account.find({ user_id: req.user!.id }).sort({ created_at: 1 }).lean<any[]>();
    const primaryAccount = accounts.length > 0 ? accounts[0] : null;

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        security_pin: '••••',
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
    res.status(500).json({ error: errorMessage(err, 'Failed to fetch user profile.') });
  }
});

// POST /api/user/deposit or /api/user/accounts/deposit
router.post(['/deposit', '/accounts/deposit'], requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      targetAccount = await Account.findOne({ id: targetAccountId, user_id: userId }).lean<any>();
    }

    if (!targetAccount) {
      const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
      accounts.sort((a, b) => ({ Checking: 1, Savings: 2 }[a.account_type as 'Checking' | 'Savings'] || 3) - ({ Checking: 1, Savings: 2 }[b.account_type as 'Checking' | 'Savings'] || 3));
      targetAccount = accounts[0] || null;
    }

    if (!targetAccount) {
      res.status(404).json({ error: 'No active recipient account found for this customer profile.' });
      return;
    }

    const updatedAccount = await Account.findOneAndUpdate(
      { id: targetAccount.id, user_id: userId },
      { $inc: { balance: parsedAmount } },
      { new: true }
    ).lean<any>();
    const newBalance = updatedAccount.balance;

    const txId = 'tx_dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const extLast4 = cleanAccountNum.slice(-4) || 'XXXX';
    const txDescription = `External ACH Deposit: ${cleanInstitution} (Acct ...${extLast4})`;

    await Transaction.create({
      id: txId, user_id: userId, account_id: targetAccount.id,
      type: 'deposit', amount: parsedAmount, currency: 'USD', description: txDescription,
      recipient_name: cleanInstitution, recipient_account: `External ...${extLast4}`,
      status: 'Completed', category: 'Deposit', date: today, created_at: Date.now(),
    });

    const logId = 'aud_dep_' + Date.now();
    await AuditLog.create({
      id: logId, admin_id: 'customer', admin_email: req.user!.email,
      action: 'EXTERNAL_DEPOSIT', target_user_id: userId, target_account_id: targetAccount.id,
      amount: parsedAmount,
      details: `External ACH Transfer of $${parsedAmount.toFixed(2)} from ${cleanInstitution} (Routing: ${cleanRoutingNum}, Acct: ...${extLast4}) into account ${targetAccount.account_number}`,
      ip_address: req.ip || '127.0.0.1', created_at: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Deposit of $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${cleanInstitution} successfully credited to your ${targetAccount.nickname}.`,
      newBalance,
      depositedAmount: parsedAmount,
      account: { ...updatedAccount, balance: newBalance },
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
    res.status(500).json({ error: errorMessage(err, 'An error occurred while processing the external deposit.') });
  }
});

export default router;
