import React from 'react';
import { BofALogo } from './BofALogo';
import { User } from '../types';
import { Lock, LogOut, ShieldCheck, ChevronDown, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
  isAdminView?: boolean;
  onOpenProfileModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onSignOut,
  isAdminView = false,
  onOpenProfileModal,
}) => {
  return (
    <div className="w-full shrink-0">
      {/* Top Header - Professional Polish: Navy Blue + Red Accent Border */}
      <header className="bg-[#002663] text-white px-4 sm:px-8 py-4 flex justify-between items-center h-[80px] shrink-0 border-b-4 border-[#DC143C] shadow-lg">
        <div className="flex items-center space-x-4">
          <div
            className="cursor-pointer"
            onClick={() => {
              if (isAdminView) {
                setActiveTab('overview');
              } else {
                setActiveTab('accounts');
              }
            }}
          >
            <BofALogo variant="white" showSubtitle={true} />
          </div>

          {isAdminView && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-sm text-amber-200 text-xs font-bold tracking-wide uppercase">
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Core Ledger Admin</span>
            </div>
          )}
        </div>

        {/* User Account Bar & High-Contrast Sign Out */}
        {user ? (
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Clickable user profile trigger */}
            <button
              id="btn-user-profile-trigger"
              type="button"
              onClick={onOpenProfileModal}
              className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer group text-left border border-white/10"
              title="Click to view Account Profile & Identification"
            >
              <div className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white text-xs font-bold font-serif group-hover:bg-white/25 transition-colors shrink-0">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col items-start hidden sm:flex">
                <span className="text-[9px] opacity-80 uppercase tracking-widest text-slate-200">
                  {isAdminView ? 'SYSTEM OPERATOR' : 'SECURE ACCOUNT'}
                </span>
                <span className="text-sm font-semibold text-white truncate max-w-[180px] group-hover:text-blue-100 flex items-center gap-1">
                  <span>{user.full_name}</span>
                  <ChevronDown className="w-3 h-3 text-white/70 group-hover:text-white" />
                </span>
              </div>
            </button>

            <button
              id="btn-signout"
              onClick={onSignOut}
              className="bg-white text-[#002663] px-3.5 sm:px-4 py-1.5 rounded-sm font-bold text-xs sm:text-sm hover:bg-gray-100 uppercase transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : null}
      </header>

      {/* Sub Navigation Bar - Professional Polish: White background, 56px height, crisp bottom border */}
      {user && !isAdminView && (
        <nav className="bg-white border-b border-gray-300 h-[56px] shrink-0 flex px-4 sm:px-8 shadow-xs">
          <div className="flex space-x-6 sm:space-x-10 h-full overflow-x-auto no-scrollbar">
            <button
              id="tab-accounts"
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'accounts'
                  ? 'border-b-4 border-[#002663] text-[#002663] font-bold'
                  : 'text-gray-600 hover:text-[#002663] font-medium'
              }`}
            >
              Accounts
            </button>

            <button
              id="tab-transfers"
              onClick={() => setActiveTab('transfers')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'transfers'
                  ? 'border-b-4 border-[#002663] text-[#002663] font-bold'
                  : 'text-gray-600 hover:text-[#002663] font-medium'
              }`}
            >
              Transfers
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'history'
                  ? 'border-b-4 border-[#002663] text-[#002663] font-bold'
                  : 'text-gray-600 hover:text-[#002663] font-medium'
              }`}
            >
              Bill Pay & Activity
            </button>

            <button
              id="tab-security"
              onClick={() => setActiveTab('security')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'security'
                  ? 'border-b-4 border-[#002663] text-[#002663] font-bold'
                  : 'text-gray-600 hover:text-[#002663] font-medium'
              }`}
            >
              Security Center
            </button>

            <button
              id="tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'profile'
                  ? 'border-b-4 border-[#002663] text-[#002663] font-bold'
                  : 'text-gray-600 hover:text-[#002663] font-medium'
              }`}
            >
              Profile & Details
            </button>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-xs text-gray-500 italic hidden lg:inline">
              Last login: Today at 09:42 AM EST
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-sm border border-emerald-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Encrypted
              </span>
            </div>
          </div>
        </nav>
      )}

      {/* Admin specific sub-nav if viewing admin portal */}
      {user && isAdminView && (
        <nav className="bg-slate-900 border-b border-slate-700 h-[52px] shrink-0 flex px-4 sm:px-8 shadow-xs text-white">
          <div className="flex space-x-4 sm:space-x-6 h-full items-center text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Control Panel:
            </span>
            <button
              id="admin-tab-users"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#DC143C] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Customer Accounts & Direct Adjustments
            </button>
            <button
              id="admin-tab-audit"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#DC143C] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Transaction Audit Logs
            </button>
            <button
              id="admin-tab-system"
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-[#DC143C] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              All System Transactions
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
