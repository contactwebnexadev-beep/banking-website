export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  phone: string;
  created_at?: string;
}

export interface BankAccount {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'Checking' | 'Savings' | 'Credit Card';
  nickname: string;
  balance: number;
  currency: string;
  routing_number: string;
  credit_limit?: number;
  status: 'Active' | 'Locked' | 'Closed';
  display_number: string;
  masked_number: string;
  available_balance?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'payment' | 'admin_adjustment';
  amount: number;
  currency: string;
  description: string;
  recipient_name?: string;
  recipient_account?: string;
  status: 'Completed' | 'Pending';
  category?: string;
  date: string;
  created_at: number;
  account_name?: string;
  account_number?: string;
}

export interface UserSummary {
  totalDepositBalanceUSD: number;
  totalCreditBalanceUSD: number;
  totalCreditLimitUSD: number;
  pendingTransactionsCount: number;
  accountsCount: number;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_user_id?: string;
  target_account_id?: string;
  amount?: number;
  details: string;
  ip_address?: string;
  created_at: string;
  target_user_name?: string;
  target_account_number?: string;
}

export interface AdminOverviewData {
  totalUsers: number;
  totalAccounts: number;
  totalDepositsUSD: number;
  totalTransactions: number;
  pendingTransactions: number;
  totalAuditLogs: number;
  systemStatus: string;
  databaseEngine: string;
}

export interface UserWithAccounts extends User {
  accounts: BankAccount[];
  totalBalanceUSD: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  phone: string;
  security_pin?: string;
  created_at?: string;
  account_number: string;
  routing_number: string;
  status: string;
  encryption_status?: string;
  accounts_count?: number;
}

