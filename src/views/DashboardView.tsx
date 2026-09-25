import React, { useState } from 'react';
import { BankAccount, Transaction, User, UserSummary } from '../types';
import {
  CreditCard,
  Landmark,
  PiggyBank,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  Search,
  Filter,
  Send,
  Shield,
  RefreshCw,
  Download,
  Receipt,
  PlusCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { AddFundsModal } from '../components/AddFundsModal';

interface DashboardViewProps {
  user: User;
  token?: string;
  accounts: BankAccount[];
  transactions: Transaction[];
  summary: UserSummary | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  token,
  accounts,
  transactions,
  summary,
  loading,
  onRefresh,
  onNavigateToTransfer,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [showAccountNumber, setShowAccountNumber] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);

  const primaryAccount =
    accounts.find((a) => a.account_type === 'Checking') || accounts[0] || null;
  const customerName = user?.full_name || (user as any)?.name || 'Valued Customer';

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (selectedAccountId !== 'all' && tx.account_id !== selectedAccountId) {
      return false;
    }
    if (statusFilter !== 'all' && tx.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchDesc = tx.description.toLowerCase().includes(q);
      const matchRecipient = tx.recipient_name?.toLowerCase().includes(q);
      const matchAmount = tx.amount.toString().includes(q);
      if (!matchDesc && !matchRecipient && !matchAmount) return false;
    }
    return true;
  });

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const exportCSV = () => {
    const headers = 'Date,Description,Account,Status,Amount (USD)\n';
    const rows = filteredTransactions
      .map((t) => `"${t.date}","${t.description}","${t.account_name}","${t.status}","${t.amount}"`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bofa_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <span className="text-xs font-bold text-[#DC143C] uppercase tracking-wider">
            Personal Banking Portal
          </span>
          <h1 className="text-2xl font-bold text-[#002663] font-serif tracking-tight">
            Account Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-refresh-dashboard"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs border border-gray-300 rounded-sm shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#002663] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Balances</span>
          </button>

          <button
            id="btn-nav-deposit"
            onClick={() => setIsDepositModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Funds / Deposit</span>
          </button>

          <button
            id="btn-quick-transfer"
            onClick={() => onNavigateToTransfer()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#002663] hover:bg-[#001D4D] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer"
          >
            <span>Transfer Money</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prominent Dynamic Welcome Header Hero Section */}
      <div
        id="dashboard-welcome-hero"
        className="bg-gradient-to-r from-[#002663] via-[#001D4D] to-[#001433] text-white rounded-sm shadow-md overflow-hidden border-t-4 border-[#DC143C]"
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-xs bg-white/10 text-white/90 text-[11px] font-semibold tracking-wider uppercase mb-2 border border-white/15">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>SafePass® 2FA Verified • Preferred Relationship</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">
                Welcome back, {customerName}!
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-xl leading-relaxed">
                Your Bank of America deposits are FDIC insured up to $250,000. Manage account balances, authorize external ACH deposits, and review real-time ledger activity below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                id="hero-btn-add-funds"
                onClick={() => setIsDepositModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-sm transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Deposit / Add Funds</span>
              </button>

              <button
                id="hero-btn-transfer"
                onClick={() => onNavigateToTransfer()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs uppercase tracking-wider rounded-sm border border-white/20 transition-colors cursor-pointer"
              >
                <span>Transfer Money</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Key Account Details: Account Number, Routing Number, Account Security Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6 pt-5 border-t border-white/15">
            {/* 1. Account Number */}
            <div className="bg-white/10 backdrop-blur-xs rounded-xs p-4 border border-white/10 hover:bg-white/15 transition-colors">
              <div className="flex items-center justify-between text-[11px] text-gray-300 uppercase tracking-wider font-semibold mb-1.5">
                <span>{primaryAccount?.nickname || 'Checking Account'} Number</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="text-gray-300 hover:text-white cursor-pointer p-0.5"
                    title={showAccountNumber ? 'Mask account number' : 'Show full account number'}
                  >
                    {showAccountNumber ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    id="btn-copy-account-number"
                    type="button"
                    onClick={() => handleCopy(primaryAccount?.account_number || '', 'account')}
                    className="text-gray-300 hover:text-white cursor-pointer p-0.5 inline-flex items-center gap-1 text-[10px]"
                    title="Copy account number"
                  >
                    {copiedField === 'account' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Copied
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="font-mono text-lg sm:text-xl font-bold tracking-wider text-white">
                {showAccountNumber
                  ? (primaryAccount?.account_number || '4860399242')
                  : `•••• •••• ${primaryAccount?.account_number ? primaryAccount.account_number.slice(-4) : '9242'}`}
              </div>
              <div className="text-[11px] text-gray-300 mt-1 flex items-center justify-between">
                <span>{primaryAccount?.account_type || 'Checking'}</span>
                <span className="font-mono font-bold text-emerald-300">
                  {primaryAccount ? formatUSD(primaryAccount.balance) : '$0.00'} Available
                </span>
              </div>
            </div>

            {/* 2. Routing Number */}
            <div className="bg-white/10 backdrop-blur-xs rounded-xs p-4 border border-white/10 hover:bg-white/15 transition-colors">
              <div className="flex items-center justify-between text-[11px] text-gray-300 uppercase tracking-wider font-semibold mb-1.5">
                <span>Routing Number (ABA)</span>
                <button
                  id="btn-copy-routing-number"
                  type="button"
                  onClick={() => handleCopy(primaryAccount?.routing_number || '026009593', 'routing')}
                  className="text-gray-300 hover:text-white cursor-pointer p-0.5 inline-flex items-center gap-1 text-[10px]"
                  title="Copy routing number"
                >
                  {copiedField === 'routing' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Copied
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <div className="font-mono text-lg sm:text-xl font-bold tracking-wider text-white">
                {primaryAccount?.routing_number || '026009593'}
              </div>
              <div className="text-[11px] text-gray-300 mt-1">
                Direct Deposit & Electronic ACH Transfer
              </div>
            </div>

            {/* 3. Account Security Status */}
            <div className="bg-white/10 backdrop-blur-xs rounded-xs p-4 border border-white/10 hover:bg-white/15 transition-colors">
              <div className="text-[11px] text-gray-300 uppercase tracking-wider font-semibold mb-1.5">
                Account Security Status
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-base sm:text-lg font-bold text-emerald-300 font-sans tracking-tight">
                  Active & 2FA Protected
                </span>
              </div>
              <div className="text-[11px] text-gray-300 mt-1">
                SafePass® Active • 256-Bit SSL • FDIC Insured
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Success Alert if applicable */}
      {depositSuccessMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-xs rounded-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{depositSuccessMsg}</span>
          </div>
          <button
            onClick={() => setDepositSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Layout from "Professional Polish" */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        {/* ASIDE COLUMN: Your Accounts + Quick Actions + Security Tip */}
        <aside className="w-full lg:w-[320px] shrink-0 flex flex-col space-y-6">
          {/* Card: Your Accounts */}
          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#002663] font-bold text-base sm:text-lg flex items-center">
                <Landmark className="w-5 h-5 mr-2 text-[#002663]" />
                Your Accounts
              </h2>
              {selectedAccountId !== 'all' && (
                <button
                  onClick={() => setSelectedAccountId('all')}
                  className="text-[11px] text-[#002663] font-semibold hover:underline cursor-pointer"
                >
                  View All
                </button>
              )}
            </div>

            <div className="space-y-3">
              {accounts.map((account) => {
                const isSelected = selectedAccountId === account.id;
                const isCreditCard = account.account_type === 'Credit Card';

                return (
                  <div
                    key={account.id}
                    id={`card-account-${account.id}`}
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`p-3.5 rounded-sm cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-l-4 border-[#002663] shadow-2xs'
                        : 'border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {account.nickname} ({account.display_number})
                      </p>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                        {account.status}
                      </span>
                    </div>

                    <p className={`text-2xl font-bold font-serif mt-1 ${isSelected ? 'text-[#002663]' : 'text-gray-800'}`}>
                      {formatUSD(account.balance)}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-green-600 font-bold uppercase">
                        {isCreditCard ? 'Current Balance' : 'Available Balance'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToTransfer(account.id);
                        }}
                        className="text-[#002663] hover:text-[#DC143C] font-semibold underline"
                      >
                        Transfer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Quick Actions */}
          <div className="bg-white border border-gray-200 shadow-sm p-5 rounded-sm">
            <h3 className="font-bold text-gray-800 text-sm mb-4 uppercase tracking-wider">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="quick-action-deposit"
                onClick={() => setIsDepositModalOpen(true)}
                className="flex flex-col items-center justify-center p-3 border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 rounded-sm hover:border-emerald-600 text-emerald-900 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 bg-emerald-100 group-hover:bg-emerald-200 rounded-full flex items-center justify-center mb-2 text-emerald-700 transition-colors">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase">ADD FUNDS</span>
              </button>

              <button
                id="quick-action-transfer"
                onClick={() => onNavigateToTransfer()}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-sm hover:border-[#DC143C] hover:bg-red-50 text-gray-700 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-white rounded-full flex items-center justify-center mb-2 text-[#002663] group-hover:text-[#DC143C] transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase">TRANSFER</span>
              </button>

              <button
                id="quick-action-pay-bills"
                onClick={() => onNavigateToTransfer()}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-sm hover:border-[#DC143C] hover:bg-red-50 text-gray-700 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-white rounded-full flex items-center justify-center mb-2 text-[#002663] group-hover:text-[#DC143C] transition-colors">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase">PAY BILLS</span>
              </button>

              <button
                id="quick-action-zelle"
                onClick={() => onNavigateToTransfer()}
                className="flex flex-col items-center justify-center p-3 border border-gray-200 rounded-sm hover:border-[#DC143C] hover:bg-red-50 text-gray-700 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 bg-gray-100 group-hover:bg-white rounded-full flex items-center justify-center mb-2 text-[#002663] group-hover:text-[#DC143C] transition-colors">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase">ZELLE®</span>
              </button>

              <button
                id="quick-action-statements"
                onClick={exportCSV}
                className="col-span-2 flex items-center justify-center gap-2 p-2.5 border border-gray-200 rounded-sm hover:border-[#002663] hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer group"
              >
                <Download className="w-3.5 h-3.5 text-[#002663]" />
                <span className="text-[11px] font-bold tracking-wider uppercase">DOWNLOAD CSV STATEMENT</span>
              </button>
            </div>
          </div>

          {/* Card: Security Tip (Navy Blue with Shield watermark) */}
          <div className="bg-[#002663] text-white p-5 rounded-sm relative overflow-hidden shadow-xs">
            <div className="relative z-10">
              <p className="text-xs font-bold uppercase mb-2 tracking-wider text-red-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>Security Tip</span>
              </p>
              <p className="text-xs opacity-90 leading-relaxed text-slate-100">
                Always verify your SafePass® 2-Step Verification preferences. Bank of America will never ask for your authorization code or PIN via telephone or SMS.
              </p>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
              <Shield className="w-36 h-36 text-white" />
            </div>
          </div>
        </aside>

        {/* MAIN SECTION: Liquidity Bar + Recent Transactions Table */}
        <section className="flex-1 w-full flex flex-col space-y-6">
          {/* Liquidity Bar */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 p-4 rounded-sm shadow-2xs">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Total Deposits Liquidity
                </div>
                <div className="text-2xl font-bold text-[#002663] font-serif mt-1">
                  {formatUSD(summary.totalDepositBalanceUSD)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Checking & Savings in USD
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-sm shadow-2xs">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Credit Card Balance
                </div>
                <div className="text-2xl font-bold text-gray-900 font-serif mt-1">
                  {formatUSD(summary.totalCreditBalanceUSD)}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Available limit: {formatUSD(summary.totalCreditLimitUSD)}
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-sm shadow-2xs">
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Pending Transactions
                </div>
                <div className="text-2xl font-bold text-amber-700 font-serif mt-1 flex items-center gap-2">
                  <span>{summary.pendingTransactionsCount}</span>
                  {summary.pendingTransactionsCount > 0 && (
                    <span className="text-xs font-sans font-normal text-amber-800 bg-amber-100 px-2 py-0.5 rounded-sm">
                      In Clearing
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Posts in 1 business day
                </div>
              </div>
            </div>
          )}

          {/* Transactions Card - Professional Polish structure */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-sm flex flex-col overflow-hidden">
            {/* Table Header Bar */}
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
              <h2 className="font-bold text-gray-800 uppercase tracking-tight text-sm sm:text-base">
                Recent Transactions
              </h2>
              <div className="flex items-center space-x-3 text-xs font-bold">
                <button
                  onClick={() => {
                    const el = document.getElementById('input-search-transactions');
                    el?.focus();
                  }}
                  className="text-[#002663] hover:underline cursor-pointer"
                >
                  Search
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={exportCSV}
                  className="text-[#002663] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Row */}
            <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="input-search-transactions"
                  type="text"
                  placeholder="Search by merchant, payee, description, or amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#002663] focus:border-[#002663] outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  id="select-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-sm bg-white text-gray-700 focus:ring-1 focus:ring-[#002663] outline-hidden cursor-pointer"
                >
                  <option value="all">All Records (Pending & Completed)</option>
                  <option value="completed">Completed Status Only</option>
                  <option value="pending">Pending Status Only</option>
                </select>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              {filteredTransactions.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">No matching transactions</p>
                  <p className="text-xs text-gray-400 mt-1">Try clearing your search query or status filter.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="bg-gray-100 text-[11px] uppercase text-gray-500 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 w-32">Date</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Amount (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredTransactions.map((tx) => {
                      const isPositive =
                        tx.type === 'deposit' ||
                        tx.type === 'transfer_in' ||
                        tx.type === 'admin_credit' ||
                        (tx.type === 'admin_adjustment' && tx.amount > 0);
                      // Normalize status: 'PENDING' or 'Pending' -> show as Pending
                      const normalizedStatus = tx.status?.toUpperCase() === 'PENDING' ? 'Pending' : (tx.status || 'Completed');
                      const isPending = normalizedStatus === 'Pending';

                      return (
                        <tr
                          key={tx.id}
                          id={`tx-row-${tx.id}`}
                          onClick={() => setSelectedTransaction(tx)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 font-medium text-gray-700 whitespace-nowrap">
                            {tx.date}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{tx.description}</span>
                              <span className="text-[11px] text-gray-400">
                                {tx.account_name} {tx.recipient_name ? `• To: ${tx.recipient_name}` : ''}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {isPending ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-sm uppercase tracking-wider inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Processing</span>
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-sm uppercase tracking-wider inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completed</span>
                              </span>
                            )}
                          </td>

                          <td
                            className={`px-6 py-4 text-right font-bold whitespace-nowrap font-mono ${
                              isPositive ? 'text-green-600' : 'text-gray-900'
                            }`}
                          >
                            {isPositive ? `+${formatUSD(Math.abs(tx.amount))}` : `-${formatUSD(Math.abs(tx.amount))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table Bottom Action Bar */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">
                Showing {filteredTransactions.length} of {transactions.length} records
              </span>
              <button
                onClick={() => {
                  setSelectedAccountId('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-[#002663] hover:text-[#DC143C] uppercase tracking-wide cursor-pointer"
              >
                Reset Filters & View All
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Transaction Details Modal Receipt */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white border border-gray-300 rounded-sm shadow-xl max-w-md w-full overflow-hidden">
            <div className="h-1.5 bg-[#002663]" />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#DC143C] uppercase tracking-wider">
                    Bank of America Transaction Record
                  </span>
                  <h3 className="text-lg font-bold text-[#002663] font-serif mt-0.5">
                    {selectedTransaction.description}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs border-y border-gray-100 py-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-mono font-bold text-base text-gray-900">
                    {formatUSD(selectedTransaction.amount)} USD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span
                    className={`font-semibold ${
                      selectedTransaction.status?.toUpperCase() === 'PENDING' || selectedTransaction.status === 'Pending' 
                        ? 'text-amber-700' 
                        : 'text-green-700'
                    }`}
                  >
                    {selectedTransaction.status?.toUpperCase() === 'PENDING' ? 'Processing' : (selectedTransaction.status || 'Completed')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Posting Date:</span>
                  <span className="font-mono text-gray-700">{selectedTransaction.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference ID:</span>
                  <span className="font-mono text-gray-700">{selectedTransaction.id}</span>
                </div>
                {selectedTransaction.account_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account:</span>
                    <span className="font-medium text-gray-900">{selectedTransaction.account_name}</span>
                  </div>
                )}
                {selectedTransaction.recipient_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payee / Recipient:</span>
                    <span className="font-medium text-gray-900">{selectedTransaction.recipient_name}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="px-4 py-2 bg-[#002663] hover:bg-[#001D4D] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-2xs transition-colors cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Funds from External Account Modal */}
      <AddFundsModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        accounts={accounts}
        token={token}
        onSuccess={(newBalance, tx, msg) => {
          setDepositSuccessMsg(msg || 'External deposit processed successfully!');
          onRefresh();
        }}
      />
    </div>
  );
};
