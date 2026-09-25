import React, { useState, useEffect } from 'react';
import { User, AuditLog, AdminOverviewData, UserWithAccounts, BankAccount, Transaction } from '../types';
import { getStoredAuthToken } from '../utils/api';
import {
  ShieldAlert,
  Search,
  DollarSign,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  History,
  Users,
  CheckCircle2,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';

interface AdminViewProps {
  user: User;
  token: string;
  onSignOut: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, token, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'audit' | 'transactions'>('users');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [users, setUsers] = useState<UserWithAccounts[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pending Deposits Processing State
  const [approvingDepositId, setApprovingDepositId] = useState<string | null>(null);

  // Adjustment Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [targetAccountOwner, setTargetAccountOwner] = useState<string>('');
  const [adjustAction, setAdjustAction] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  // Admin Fund Injection Feature State
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAccountId, setCreditAccountId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditMemo, setCreditMemo] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const activeToken = token || getStoredAuthToken();

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load admin overview');
      const data = await res.json();
      setOverview(data.overview);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = searchQuery.trim()
        ? `/api/admin/users?search=${encodeURIComponent(searchQuery.trim())}`
        : '/api/admin/users';
      const res = await fetch(url, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load user accounts');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingDeposits = async () => {
    try {
      const res = await fetch('/api/admin/pending-deposits', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load pending deposits');
      const data = await res.json();
      const deposits = Array.isArray(data.pendingDeposits) ? data.pendingDeposits : [];
      setPendingDeposits(deposits);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/admin/transactions', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load system transactions');
      const data = await res.json();
      setAllTransactions(data.transactions || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchUsers();
    fetchAuditLogs();
    fetchTransactions();
    fetchPendingDeposits();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const openAdjustment = (account: BankAccount, ownerName: string) => {
    setSelectedAccount(account);
    setTargetAccountOwner(ownerName);
    setAdjustAction('credit');
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustModalOpen(true);
    setError(null);
  };

  const openCreditModal = (account?: BankAccount, ownerName?: string) => {
    if (account) {
      setCreditAccountId(account.id);
    } else {
      const firstAcc = users.flatMap((u) => u.accounts || [])[0];
      setCreditAccountId(firstAcc?.id || '');
    }
    setCreditAmount('');
    setCreditMemo('Administrative Fund Injection / Customer Credit');
    setCreditModalOpen(true);
    setError(null);
  };

  const handleProcessCreditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(creditAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid credit amount greater than $0.00 USD.');
      return;
    }

    if (!creditAccountId) {
      setError('Please select a customer account to credit.');
      return;
    }

    if (!creditMemo.trim()) {
      setError('A transaction memo / description is required.');
      return;
    }

    setSubmittingCredit(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/credit-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          accountId: creditAccountId,
          amount: parsed,
          memo: creditMemo.trim(),
          token: activeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to process customer credit injection.');
      }

      setSuccessMsg(data.message || `Successfully credited $${parsed.toFixed(2)} to customer account.`);
      setCreditModalOpen(false);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
      fetchTransactions();
    } catch (err: any) {
      console.error('Error in handleProcessCreditUser:', err);
      setError(err.message || 'Error processing credit to customer account.');
    } finally {
      setSubmittingCredit(false);
    }
  };

  const handleProcessAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const parsed = parseFloat(adjustAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount greater than $0.00 USD.');
      return;
    }

    if (!adjustReason.trim()) {
      setError('A regulatory reason / justification is required for balance adjustments.');
      return;
    }

    setSubmittingAdjustment(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/balance-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          accountId: selectedAccount.id,
          action: adjustAction,
          amount: parsed,
          reason: adjustReason.trim(),
          token: activeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Adjustment failed');
      }

      setSuccessMsg(data.message);
      setAdjustModalOpen(false);
      // Refresh state
      fetchOverview();
      fetchUsers();
      fetchAuditLogs();
      fetchTransactions();

      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const handleApproveDeposit = async (depositId: string, depositAmount: number, customerName: string) => {
    setApprovingDepositId(depositId);
    setError(null);

    try {
      const res = await fetch('/api/admin/approve-deposit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            transactionId: depositId,
            token: activeToken,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to approve deposit');
        }

        setSuccessMsg(
          `Deposit of $${depositAmount.toFixed(2)} approved for ${customerName}. Account balance updated.`
        );
      // Refresh all data after the transaction is marked APPROVED.
      await Promise.all([
        fetchPendingDeposits(),
        fetchOverview(),
        fetchUsers(),
        fetchAuditLogs(),
        fetchTransactions(),
      ]);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Error approving deposit:', err);
      setError(err.message || 'Failed to approve deposit');
    } finally {
      setApprovingDepositId(null);
    }
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Admin Warning Banner */}
      <div className="bg-[#1E293B] text-white p-5 rounded-xs shadow-xs border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#DC143C] rounded-xs text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-red-400 font-bold uppercase tracking-wider">
              Restricted Operations Area
            </div>
            <h1 className="text-xl font-bold font-serif text-white">
              Bank of America Core Systems & Ledger Management
            </h1>
            <p className="text-xs text-slate-300">
              Authorized Administrator: <span className="font-mono text-white">{user.email}</span> | SQLite Persistent Storage Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchOverview();
                fetchUsers();
                fetchAuditLogs();
                fetchTransactions();
                fetchPendingDeposits();
              }}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-white font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Registered Users</div>
            <div className="text-2xl font-bold text-[#002663] font-serif mt-1">
              {overview.totalUsers}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Consumer & Business Profiles</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Deposits (USD)</div>
            <div className="text-2xl font-bold text-emerald-700 font-serif mt-1">
              {formatUSD(overview.totalDepositsUSD)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Across all checking & savings</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Accounts Hosted</div>
            <div className="text-2xl font-bold text-gray-900 font-serif mt-1">
              {overview.totalAccounts}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Active bank accounts</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Audited Actions</div>
            <div className="text-2xl font-bold text-[#DC143C] font-serif mt-1">
              {overview.totalAuditLogs}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Immutable audit events</div>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-[#F8F9FA] px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#002663] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manage Customer Balances ({users.reduce((acc, u) => acc + (u.accounts?.length || 0), 0)} Accounts)
            </button>
              <button
                onClick={() => {
                  setActiveTab('pending');
                  fetchPendingDeposits();
                }}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-[#DC143C] text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Deposit Requests ({pendingDeposits.length})
              </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#002663] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Transaction Audit Logs ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-[#002663] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              System Transactions Master ({allTransactions.length})
            </button>
          </div>
        </div>

        {/* TAB 1: MANAGE CUSTOMER BALANCES */}
        {activeTab === 'users' && (
          <div className="p-5">
            {/* Header: Manage Customer Balances Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-[#002663] font-serif flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#002663]" />
                  <span>Manage Customer Balances</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review registered customers, perform administrative fund injections, and adjust ledger balances with complete audit tracking.
                </p>
              </div>

              <button
                id="btn-admin-credit-customer-modal"
                type="button"
                onClick={() => openCreditModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white font-bold text-xs uppercase tracking-wider rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Funds / Credit Account</span>
              </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-search-accounts"
                  type="text"
                  placeholder="Search by customer name, email, or account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#002663] outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#002663] text-white text-xs font-semibold rounded-xs hover:bg-[#001D4D] cursor-pointer"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTimeout(() => fetchUsers(), 50);
                  }}
                  className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-xs hover:bg-gray-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </form>

            {/* Users / Accounts Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Account Nickname / Type</th>
                    <th className="py-3 px-4">Account Holder</th>
                    <th className="py-3 px-4">Current Balance (USD)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.flatMap((u) =>
                    (u.accounts || []).map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#002663]">
                          {acc.account_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{acc.nickname}</div>
                          <div className="text-[11px] text-gray-500">{acc.account_type}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{u.full_name}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-gray-900">
                          {formatUSD(acc.balance)} USD
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`btn-credit-customer-${acc.id}`}
                              type="button"
                              onClick={() => openCreditModal(acc, u.full_name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs shadow-2xs transition-colors cursor-pointer"
                              title="Add Funds / Credit Account"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Add Funds / Credit</span>
                            </button>

                            <button
                              id={`btn-adjust-account-${acc.id}`}
                              type="button"
                              onClick={() => openAdjustment(acc, u.full_name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#002663] text-white hover:bg-[#001D4D] text-xs font-medium rounded-xs shadow-2xs transition-colors cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Adjust</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PENDING DEPOSITS */}
        {activeTab === 'pending' && (
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-[#DC143C] font-serif flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>Pending Deposit Requests</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Review customer ACH deposits and confirm funds to the destination account.</p>
              </div>
              <button
                type="button"
                onClick={fetchPendingDeposits}
                disabled={approvingDepositId !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs rounded-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Deposits</span>
              </button>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="py-12 text-center border border-gray-200 rounded-xs bg-gray-50">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No Pending Deposits</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingDeposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{(deposit as any).user_name || 'Unknown'}</div>
                          <div className="text-[11px] text-gray-500">{(deposit as any).user_email || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">ACH Deposit Confirmed</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">+{formatUSD(deposit.amount)}</td>
                        <td className="py-3.5 px-4 text-[11px] text-gray-600 whitespace-nowrap">{deposit.date || deposit.created_at}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">{deposit.status}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleApproveDeposit(deposit.id, deposit.amount, (deposit as any).user_name || 'Customer')}
                            disabled={approvingDepositId === deposit.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xs cursor-pointer"
                          >
                            {approvingDepositId === deposit.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            <span>{approvingDepositId === deposit.id ? 'Processing...' : 'Approve & Credit'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="p-5">
            <div className="mb-4 text-xs text-gray-500 flex items-center justify-between">
              <span>All administrative ledger modifications are cryptographically timestamped and logged.</span>
              <span className="font-mono font-bold text-gray-700">{auditLogs.length} Events Total</span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Admin Email</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Amount (USD)</th>
                    <th className="py-3 px-4">Audit Details & Justification</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-800 font-medium">
                        {log.admin_email}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.action.includes('CREDIT')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : log.action.includes('DEBIT')
                              ? 'bg-red-50 text-red-800 border border-red-300'
                              : 'bg-blue-50 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {log.amount ? `${formatUSD(log.amount)} USD` : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700 max-w-md">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500 text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM TRANSACTIONS */}
        {/* TAB 4: SYSTEM TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="p-5">
            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Description / Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">{t.date}</td>
                      <td className="py-3 px-4 font-mono text-[#002663] font-semibold">
                        {t.account_number || t.account_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{t.description}</div>
                        <div className="text-[11px] text-gray-500">Category: {t.category || t.type}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {formatUSD(t.amount)} USD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Balance Adjustment Modal */}
      {adjustModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white border border-gray-300 rounded-xs shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="h-1.5 bg-[#DC143C]" />

            <form onSubmit={handleProcessAdjustment} className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#DC143C] uppercase tracking-wider">
                    Administrative Ledger Override
                  </span>
                  <h3 className="text-xl font-bold text-[#002663] font-serif mt-0.5">
                    Direct Balance Adjustment
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              {/* Target Account Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xs p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Holder:</span>
                  <span className="font-bold text-gray-900">{targetAccountOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account:</span>
                  <span className="font-mono text-gray-900">
                    {selectedAccount.nickname} ({selectedAccount.account_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Balance:</span>
                  <span className="font-mono font-bold text-sm text-[#002663]">
                    {formatUSD(selectedAccount.balance)} USD
                  </span>
                </div>
              </div>

              {/* Action: Credit or Debit */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Adjustment Operation
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustAction('credit')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      adjustAction === 'credit'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                    <span>Credit (+) Add USD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustAction('debit')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      adjustAction === 'debit'
                        ? 'bg-red-50 border-red-600 text-red-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4 text-red-600" />
                    <span>Debit (-) Deduct USD</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="input-adjust-amount"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Amount to {adjustAction === 'credit' ? 'Credit' : 'Debit'} (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    $
                  </span>
                  <input
                    id="input-adjust-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full pl-8 pr-12 py-2 text-base font-bold border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#002663]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>
              </div>

              {/* Reason / Regulatory Justification */}
              <div>
                <label
                  htmlFor="input-adjust-reason"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Audit Reason & Regulatory Justification (Required)
                </label>
                <textarea
                  id="input-adjust-reason"
                  rows={2}
                  required
                  placeholder="e.g. Approved fee reversal for wire inquiry, customer relationship adjustment"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#002663]"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border-l-4 border-[#DC143C] text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 font-semibold hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-adjust-ledger"
                  type="submit"
                  disabled={submittingAdjustment}
                  className="px-5 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {submittingAdjustment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Apply {adjustAction === 'credit' ? 'Credit' : 'Debit'} to Ledger</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dedicated Admin Fund Injection / Credit Customer Account Modal */}
      {creditModalOpen && (
        <div
          id="modal-admin-credit-user"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border border-gray-300 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#002663] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#DC143C]">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-white/10 rounded-sm">
                  <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white leading-tight">
                    Add Funds / Credit Customer Account
                  </h3>
                  <p className="text-[11px] text-gray-200">
                    Administrative Fund Injection • Core Banking System
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreditModalOpen(false)}
                className="text-gray-300 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessCreditUser} className="p-6 space-y-4">
              {/* Customer Selection / Account Number */}
              <div>
                <label
                  htmlFor="select-credit-customer-account"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                >
                  Customer Selection / Account Number
                </label>
                <select
                  id="select-credit-customer-account"
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-gray-300 rounded-xs bg-white focus:ring-1 focus:ring-[#002663] outline-hidden"
                  required
                >
                  <option value="">-- Select Customer Account --</option>
                  {users.flatMap((u) =>
                    (u.accounts || []).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {u.full_name} ({u.email}) — {acc.nickname} ({acc.account_number}) — Balance: ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected account details badge if chosen */}
              {(() => {
                const chosenAcc = users
                  .flatMap((u) =>
                    (u.accounts || []).map((a) => ({
                      ...a,
                      ownerName: u.full_name,
                      ownerEmail: u.email,
                    }))
                  )
                  .find((a) => a.id === creditAccountId);
                if (!chosenAcc) return null;
                return (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xs text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Holder:</span>
                      <span className="font-semibold text-gray-900">{chosenAcc.ownerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Number:</span>
                      <span className="font-mono font-bold text-[#002663]">
                        {chosenAcc.account_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current Balance:</span>
                      <span className="font-mono font-bold text-gray-900">
                        {formatUSD(chosenAcc.balance)} USD
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Amount */}
              <div>
                <label
                  htmlFor="input-credit-amount"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Deposit / Credit Amount ($ USD)
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    $
                  </span>
                  <input
                    id="input-credit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full pl-8 pr-12 py-2 text-base font-bold font-mono border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#002663]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>

                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2500, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreditAmount(amt.toString())}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xs border border-gray-200 cursor-pointer"
                    >
                      +${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Memo / Description */}
              <div>
                <label
                  htmlFor="input-credit-memo"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Transaction Memo / Description (Required)
                </label>
                <input
                  id="input-credit-memo"
                  type="text"
                  required
                  placeholder="e.g. Account opening deposit bonus, Customer courtesy credit"
                  value={creditMemo}
                  onChange={(e) => setCreditMemo(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#002663]"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border-l-4 border-[#DC143C] text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 font-semibold hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-credit-user"
                  type="submit"
                  disabled={submittingCredit}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {submittingCredit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Injecting Funds...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>Authorize & Credit Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
