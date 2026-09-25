import React from 'react';
import { User } from '../types';
import { ShieldCheck, Smartphone, Mail, Lock, KeyRound, AlertCircle, FileCheck } from 'lucide-react';

interface SecurityViewProps {
  user: User;
}

export const SecurityView: React.FC<SecurityViewProps> = ({ user }) => {
  const maskedPhone = user.phone.length >= 4 ? `(***) ***-${user.phone.slice(-4)}` : user.phone;
  const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, '$1***$3');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xs p-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#DC143C] uppercase tracking-wider">
              Security Center & Fraud Protection
            </div>
            <h1 className="text-2xl font-bold text-[#002663] font-serif">
              SafePass® Multi-Factor Security
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Your accounts are safeguarded with mandatory multi-factor authentication on logins and money transfers.
            </p>
          </div>
        </div>
      </div>

      {/* Security Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SafePass 2FA Status */}
        <div className="bg-white border border-gray-200 rounded-xs p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#002663]" />
              <h2 className="font-bold text-sm text-[#002663]">SafePass® Two-Step Verification</h2>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 rounded">
              Active & Enforced
            </span>
          </div>

          <p className="text-xs text-gray-600">
            A one-time 6-digit authorization code is required for every sign-in and every outbound transfer.
          </p>

          <div className="space-y-2.5 pt-2 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xs border border-gray-200">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-700">Verified Mobile (SMS):</span>
              </div>
              <span className="font-mono text-gray-900 font-semibold">{maskedPhone}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xs border border-gray-200">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-gray-700">Verified Secure Email:</span>
              </div>
              <span className="font-mono text-gray-900 font-semibold">{maskedEmail}</span>
            </div>
          </div>
        </div>

        {/* FDIC Insurance & Currency Protection */}
        <div className="bg-white border border-gray-200 rounded-xs p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#002663]" />
              <h2 className="font-bold text-sm text-[#002663]">Deposit Insurance & Currency</h2>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-800 rounded">
              FDIC Insured
            </span>
          </div>

          <p className="text-xs text-gray-600">
            Funds in all Bank of America deposit accounts are insured by the Federal Deposit Insurance Corporation (FDIC) up to $250,000 per depositor.
          </p>

          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xs text-xs space-y-1">
            <div className="font-bold text-[#002663]">Denomination Standard</div>
            <div className="text-gray-600">
              All balances, settlements, wire transfers, and account histories are natively calculated and executed in United States Dollars (USD / $).
            </div>
          </div>
        </div>
      </div>

      {/* Security Best Practices Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xs p-4 text-xs text-amber-900 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">Bank of America Security Notice</span>
          <span>
            Bank of America will never call or text you asking for your password or your one-time SafePass® authorization code. Never share your 6-digit codes with anyone.
          </span>
        </div>
      </div>
    </div>
  );
};
