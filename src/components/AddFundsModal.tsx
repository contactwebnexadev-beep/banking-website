import React, { useState } from 'react';
import { BankAccount, Transaction } from '../types';
import {
  X,
  Landmark,
  ArrowDownCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Building2,
  DollarSign,
  ArrowRight,
  Clock
} from 'lucide-react';
import { safeParseResponse, getStoredAuthToken } from '../utils/api';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  token?: string;
  onSuccess: (newBalance: number, tx: Transaction, message: string) => void;
}

const POPULAR_INSTITUTIONS = [
  'JPMorgan Chase',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'U.S. Bank',
  'PNC Bank',
];

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  token,
  onSuccess,
}) => {
  const eligibleAccounts = accounts.filter(
    (acc) => acc.account_type === 'Checking' || acc.account_type === 'Savings'
  );
  const defaultTargetId = eligibleAccounts[0]?.id || accounts[0]?.id || '';

  const [institutionName, setInstitutionName] = useState('JPMorgan Chase');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('021000021');
  const [amount, setAmount] = useState('');
  const [targetAccountId, setTargetAccountId] = useState(defaultTargetId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    newBalance: number;
    transaction: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleSelectInstitution = (name: string) => {
    setInstitutionName(name);
    if (name === 'JPMorgan Chase') setRoutingNumber('021000021');
    else if (name === 'Wells Fargo') setRoutingNumber('121000247');
    else if (name === 'Citibank') setRoutingNumber('021000089');
    else if (name === 'Capital One') setRoutingNumber('051405515');
    else if (name === 'U.S. Bank') setRoutingNumber('091000022');
    else if (name === 'PNC Bank') setRoutingNumber('043000096');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid deposit amount greater than $0.00 USD.');
      return;
    }

    if (!institutionName.trim()) {
      setError('Please provide the external institution name.');
      return;
    }

    if (!accountNumber.trim() || accountNumber.trim().length < 4) {
      setError('Please enter a valid external account number (at least 4 digits).');
      return;
    }

    if (!routingNumber.trim() || routingNumber.trim().length !== 9) {
      setError('External routing number must be exactly 9 digits (ABA format).');
      return;
    }

    const authToken = token || getStoredAuthToken();
    if (!authToken) {
      setError('Your online banking session has expired. Please sign in again to authorize an external deposit.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/accounts/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          accountNumber: accountNumber.trim(),
          routingNumber: routingNumber.trim(),
          amount: parsedAmount,
          targetAccountId: targetAccountId || defaultTargetId,
          token: authToken,
        }),
      });

      const parseResult = await safeParseResponse(res);
      const responseData = parseResult.data || {};

      if (!res.ok) {
        throw new Error(responseData?.error || responseData?.message || parseResult.error || 'Failed to process external deposit.');
      }

      // Store success info but DO NOT redirect - just show the success UI
      setSuccessInfo({
        message: responseData.message || `Deposit of $${parsedAmount.toFixed(2)} USD submitted! Processing via ACH.`,
        newBalance: responseData.newBalance || 0,
        transaction: responseData.transaction,
      });

      // Call onSuccess callback if provided but don't close the modal
      if (onSuccess) {
        onSuccess(responseData.newBalance || 0, responseData.transaction, responseData.message);
      }
    } catch (err: any) {
      console.error('Error submitting external deposit:', err);
      setError(err.message || 'Unable to connect to deposit gateway. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessInfo(null);
    setError(null);
    setAmount('');
    setAccountNumber('');
    onClose();
  };

  const selectedTargetAccount = accounts.find((a) => a.id === targetAccountId) || accounts[0];

  return (
    <div
      id="modal-add-funds"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white border border-gray-300 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#002663] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#DC143C]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/10 rounded-sm">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-white leading-tight">
                Add Funds from External Account
              </h3>
              <p className="text-[11px] text-gray-200">
                Secure ACH Electronic Transfer • Bank of America
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-gray-300 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {successInfo ? (
            /* Success confirmation - PENDING APPROVAL */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-[#002663] font-serif">
                  Deposit Submitted Successfully
                </h4>
                <p className="text-sm font-semibold text-amber-700 bg-amber-50 inline-block px-3 py-1 rounded-full">
                  Status: PROCESSING
                </p>
                <p className="text-xs text-gray-600 max-w-md mx-auto pt-1">
                  Your deposit request has been received and is being processed via ACH. Funds typically clear within 1 to 2 business days.
                </p>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-sm p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Source Institution:</span>
                  <span className="font-semibold text-gray-800">{institutionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credited To:</span>
                  <span className="font-semibold text-[#002663]">
                    {selectedTargetAccount?.nickname} ({selectedTargetAccount?.account_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit Amount:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    +${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div className="flex justify-between border-t border-amber-200 pt-2">
                  <span className="text-gray-600">Current Status:</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    PENDING
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 flex items-start gap-2 text-[11px] text-blue-900">
                <ShieldCheck className="w-4 h-4 text-[#002663] shrink-0 mt-0.5" />
                <span>
                  ACH transfers undergo standard automated security checks. You can track the status in your transaction activity log.
                </span>
              </div>

              <div className="pt-2">
                <button
                  id="btn-add-funds-done"
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-2.5 bg-[#002663] hover:bg-[#001D4D] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer"
                >
                  Done & Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* Deposit Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Bank of America Account */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Deposit Into Account
                </label>
                <select
                  id="select-deposit-target-account"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-gray-300 rounded-sm bg-white focus:ring-2 focus:ring-[#002663] focus:border-transparent outline-hidden"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname} — {acc.account_number} (${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)
                    </option>
                  ))}
                </select>
              </div>

              {/* External Institution Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  External Institution Name
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_INSTITUTIONS.map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => handleSelectInstitution(inst)}
                      className={`px-2.5 py-1 text-[11px] rounded-xs font-medium border transition-colors cursor-pointer ${
                        institutionName === inst
                          ? 'bg-[#002663] text-white border-[#002663]'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-external-institution-name"
                    type="text"
                    required
                    placeholder="e.g. JPMorgan Chase, Wells Fargo, Citibank"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#002663] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* External Routing Number & Account Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    External Routing Number
                  </label>
                  <input
                    id="input-external-routing-number"
                    type="text"
                    required
                    maxLength={9}
                    placeholder="9-digit ABA Routing"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="w-full p-2 text-xs font-mono font-medium border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#002663] focus:border-transparent outline-hidden"
                  />
                  <span className="text-[10px] text-gray-500">9-digit ABA code</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    External Account Number
                  </label>
                  <input
                    id="input-external-account-number"
                    type="text"
                    required
                    placeholder="e.g. 1029384756"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
                    className="w-full p-2 text-xs font-mono font-medium border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#002663] focus:border-transparent outline-hidden"
                  />
                  <span className="text-[10px] text-gray-500">Checking or Savings account</span>
                </div>
              </div>

              {/* Deposit Amount ($) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Deposit Amount ($ USD)
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-600">
                    $
                  </span>
                  <input
                    id="input-deposit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-12 py-2 text-base font-bold font-mono border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#002663] focus:border-transparent outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>

                {/* Quick amount chips */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt.toString())}
                      className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xs border border-gray-200 cursor-pointer"
                    >
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security & Verification Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-sm flex items-start gap-2 text-[11px] text-blue-900">
                <ShieldCheck className="w-4 h-4 text-[#002663] shrink-0 mt-0.5" />
                <span>
                  <strong>Instant Availability:</strong> External funds transferred via ACH are verified instantaneously in testing sandbox mode and credited directly to your ledger balance.
                </span>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3 bg-red-50 border-l-4 border-[#DC143C] text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC143C] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 text-xs text-gray-600 font-semibold hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-external-deposit"
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing Deposit...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>Authorize & Deposit Funds</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
