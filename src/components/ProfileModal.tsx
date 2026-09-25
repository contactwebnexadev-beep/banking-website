import React, { useState } from 'react';
import { User, BankAccount } from '../types';
import {
  User as UserIcon,
  Mail,
  Phone,
  Hash,
  GitFork,
  ShieldCheck,
  Lock,
  ExternalLink,
  X,
  Copy,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  accounts: BankAccount[];
  onViewFullProfile: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  accounts,
  onViewFullProfile,
}) => {
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const primaryAccount = accounts.length > 0 ? accounts[0] : null;
  const accountNumber = primaryAccount?.account_number || '4800921849';
  const routingNumber = primaryAccount?.routing_number || '026009593';
  const accountStatus = primaryAccount?.status || 'Active';

  const maskedAccount = accountNumber.length > 4
    ? '•••• •••• ' + accountNumber.slice(-4)
    : accountNumber;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Backdrop click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white border border-gray-200 rounded-sm shadow-2xl max-w-md w-full overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Navy Header with Red Accent line */}
        <div className="h-1.5 bg-[#DC143C]" />
        
        <div className="bg-[#002663] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg font-serif">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-blue-200">
                Online Banking Member
              </div>
              <h3 className="text-base font-bold font-serif text-white tracking-tight">
                {user.full_name}
              </h3>
            </div>
          </div>

          <button
            id="btn-close-profile-modal"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
            aria-label="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Account Status Badge */}
          <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-sm">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-emerald-900">Current Account Status:</span>
            </div>
            <div className="flex items-center space-x-1 font-bold text-emerald-700 uppercase tracking-wide text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{accountStatus} / 256-bit Encrypted</span>
            </div>
          </div>

          {/* Details List */}
          <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-sm p-3.5">
            {/* Full Name */}
            <div className="flex items-center justify-between py-1 border-b border-gray-200/80">
              <div className="flex items-center space-x-2 text-gray-500">
                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Full Legal Name:</span>
              </div>
              <span className="font-semibold text-gray-900">{user.full_name}</span>
            </div>

            {/* Email Address */}
            <div className="flex items-center justify-between py-1 border-b border-gray-200/80">
              <div className="flex items-center space-x-2 text-gray-500">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Email Address:</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-gray-900 max-w-[190px] truncate">{user.email}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(user.email, 'email')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy email"
                >
                  {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex items-center justify-between py-1 border-b border-gray-200/80">
              <div className="flex items-center space-x-2 text-gray-500">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Phone Number:</span>
              </div>
              <span className="font-semibold text-gray-900">{user.phone || 'Not recorded'}</span>
            </div>

            {/* Routing Number */}
            <div className="flex items-center justify-between py-1 border-b border-gray-200/80">
              <div className="flex items-center space-x-2 text-gray-500">
                <GitFork className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Routing Number (ABA):</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-gray-900">{routingNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(routingNumber, 'routing')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy routing number"
                >
                  {copiedField === 'routing' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Account Number */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center space-x-2 text-gray-500">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Account Number:</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-[#002663]">
                  {showFullAccount ? accountNumber : maskedAccount}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFullAccount(!showFullAccount)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title={showFullAccount ? 'Mask account' : 'Reveal full account'}
                >
                  {showFullAccount ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(accountNumber, 'account')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy account number"
                >
                  {copiedField === 'account' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-sm text-[11px] text-gray-600 flex items-start space-x-2">
            <Lock className="w-3.5 h-3.5 text-[#002663] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#002663] block">FDIC Insured & SafePass® Protected</span>
              <span>All direct deposit transfers and online wire instructions utilize this verified routing and account number.</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 cursor-pointer"
          >
            Close
          </button>

          <button
            id="btn-view-full-profile"
            type="button"
            onClick={() => {
              onClose();
              onViewFullProfile();
            }}
            className="px-4 py-2 bg-[#002663] hover:bg-[#001D4D] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <span>View Full Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
