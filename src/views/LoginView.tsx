import React, { useState, useEffect } from 'react';
import { BofALogo } from '../components/BofALogo';
import { User } from '../types';
import { safeParseResponse, setStoredAuthToken } from '../utils/api';
import {
  Lock,
  ShieldCheck,
  Smartphone,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  onNavigateToRegister?: () => void;
  noticeMessage?: string | null;
  adminOnly?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
  noticeMessage,
  adminOnly = false,
}) => {
  // Step 1: Credentials | Step 2: 2FA Verification
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberId, setRememberId] = useState(true);

  // 2FA State
  const [tempToken, setTempToken] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'sms' | 'email'>('sms');
  const [simulatedOtp, setSimulatedOtp] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, ...(adminOnly ? { portal: 'admin' } : {}) }),
      });

      const result = await safeParseResponse(res);
      if (!result.ok) {
        throw new Error(result.error || 'Authentication failed. Please verify your credentials.');
      }

      const data = result.data;
      if (data.require2FA) {
        setTempToken(data.tempToken);
        setOtpId(data.otpId);
        setMaskedEmail(data.maskedEmail);
        setMaskedPhone(data.maskedPhone);
        setSimulatedOtp(data.simulatedOtp);
        setStep('2fa');
        setResendCooldown(30);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tempToken,
          otpId,
          code: otpCode.trim(),
        }),
      });

      const result = await safeParseResponse(res);
      if (!result.ok) {
        throw new Error(result.error || 'Verification failed. Please check your code and try again.');
      }

      const data = result.data;
      if (data.token) {
        setStoredAuthToken(data.token);
      }
      if (adminOnly && data.user?.role !== 'admin') {
        throw new Error('This sign-in is restricted to authorized administrators.');
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tempToken,
          channel: selectedChannel,
        }),
      });

      const result = await safeParseResponse(res);
      if (!result.ok) {
        throw new Error(result.error || 'Failed to resend verification code.');
      }

      const data = result.data;
      setSimulatedOtp(data.simulatedOtp);
      setOtpId(data.otpId);
      setSuccessMessage(`New code sent via ${selectedChannel === 'sms' ? 'SMS Text' : 'Email'}.`);
      setResendCooldown(45);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-between font-sans">
      {/* Professional Polish Header: Navy Blue + Flag Red Accent Border */}
      <header className="bg-[#002663] text-white px-4 sm:px-8 py-4 flex justify-between items-center h-[80px] shrink-0 border-b-4 border-[#DC143C] shadow-lg">
        <div className="flex items-center space-x-4">
          <BofALogo variant="white" showSubtitle={true} />
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {onNavigateToRegister && (
            <button
              id="btn-header-enroll"
              type="button"
              onClick={onNavigateToRegister}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors cursor-pointer border border-white/20 mr-1"
            >
              Enroll / Register
            </button>
          )}
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-xs opacity-80 uppercase tracking-widest text-slate-200">
              SECURE ACCESS
            </span>
            <span className="text-sm font-medium text-white">
              256-Bit SSL Encryption
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-sm border border-white/20">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Protected
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          {/* Top Flag Red Accent Bar */}
          <div className="h-1.5 bg-[#DC143C] w-full" />

          <div className="p-6 sm:p-8">
            {step === 'credentials' ? (
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#002663] mb-1 font-serif tracking-tight">
                  {adminOnly ? 'Core Ledger Administrator Sign-In' : 'Log In to Online Banking'}
                </h1>
                <p className="text-xs text-gray-500 mb-6">
                  {adminOnly
                    ? 'Authorized personnel only. Enter your administrator credentials to continue.'
                    : 'Please enter your User ID and Passcode to securely access your accounts.'}
                </p>

                {noticeMessage && (
                  <div className="mb-5 p-3.5 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 text-xs flex items-start gap-2.5 rounded-r-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">{noticeMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border-l-4 border-[#DC143C] text-red-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#DC143C] flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="input-email"
                      className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                    >
                      User ID / Email Address
                    </label>
                    <input
                      id="input-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="customer@bankofamerica.com"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#002663] focus:border-[#002663] outline-hidden transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="input-password"
                      className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                    >
                      Passcode
                    </label>
                    <div className="relative">
                      <input
                        id="input-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#002663] focus:border-[#002663] outline-hidden transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-gray-600">
                      <input
                        type="checkbox"
                        checked={rememberId}
                        onChange={(e) => setRememberId(e.target.checked)}
                        className="rounded-sm text-[#002663] focus:ring-[#002663]"
                      />
                      <span>Save this Online ID</span>
                    </label>
                    <a href="#help" className="text-[#002663] hover:underline font-semibold">
                      Forgot ID/Passcode?
                    </a>
                  </div>

                  <button
                    id="btn-submit-login"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-[#002663] hover:bg-[#001D4D] text-white font-bold text-sm uppercase tracking-wider rounded-sm shadow-sm transition-colors flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-75"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {onNavigateToRegister && (
                  <div className="mt-5 pt-4 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-1.5">
                      Don't have an Online Banking ID?
                    </p>
                    <button
                      id="btn-goto-register"
                      type="button"
                      onClick={onNavigateToRegister}
                      className="text-xs font-bold text-[#002663] hover:text-[#DC143C] hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Create an Account / Enroll Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Two-Step Verification Screen */
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#DC143C] uppercase tracking-wider mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Two-Step Verification</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#002663] mb-1 font-serif tracking-tight">
                  Verify Your Identity
                </h2>
                <p className="text-xs text-gray-600 mb-4">
                  For your security, we dispatched a one-time 6-digit authorization code.
                </p>

                {/* Delivery Channel Radio / Info */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm mb-4 text-xs">
                  <div className="font-semibold text-gray-700 mb-2">Delivery Method:</div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="channel"
                        checked={selectedChannel === 'sms'}
                        onChange={() => setSelectedChannel('sms')}
                        className="text-[#002663] focus:ring-[#002663]"
                      />
                      <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                      <span>Text Message (SMS) to {maskedPhone}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="channel"
                        checked={selectedChannel === 'email'}
                        onChange={() => setSelectedChannel('email')}
                        className="text-[#002663] focus:ring-[#002663]"
                      />
                      <Mail className="w-3.5 h-3.5 text-gray-500" />
                      <span>Email to {maskedEmail}</span>
                    </label>
                  </div>
                </div>

                {/* Simulated Notification Banner */}
                {simulatedOtp && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Simulated {selectedChannel.toUpperCase()} Dispatch:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOtpCode(simulatedOtp)}
                        className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                      >
                        Auto-fill
                      </button>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xs text-emerald-700">Code:</span>
                      <span className="text-base font-mono font-bold tracking-widest text-[#002663] bg-white px-2.5 py-0.5 rounded-sm border border-emerald-200">
                        {simulatedOtp}
                      </span>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 p-2.5 bg-blue-50 border-l-4 border-blue-600 text-blue-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border-l-4 border-[#DC143C] text-red-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#DC143C] flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerify2FA} className="space-y-4">
                  <div>
                    <label
                      htmlFor="input-otp"
                      className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                    >
                      Enter 6-Digit Authorization Code
                    </label>
                    <input
                      id="input-otp"
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      required
                      placeholder="123456"
                      autoFocus
                      className="w-full text-center text-xl font-mono tracking-widest px-3.5 py-2.5 border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#002663] focus:border-[#002663] outline-hidden transition-colors"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || loading}
                      className="text-[#002663] hover:underline font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      <span>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Send new code'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStep('credentials');
                        setError(null);
                        setOtpCode('');
                      }}
                      className="text-gray-500 hover:text-gray-700 underline cursor-pointer"
                    >
                      Use another ID
                    </button>
                  </div>

                  <button
                    id="btn-submit-otp"
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full py-3 px-4 bg-[#DC143C] hover:bg-[#B01030] text-white font-bold text-sm uppercase tracking-wider rounded-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Authorize & Sign In</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 border-t border-gray-200 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Bank of America SafePass® 256-bit Security Active</span>
          </div>
        </div>
      </main>

      {/* Corporate Security Footer */}
      <footer className="h-[40px] bg-white border-t border-gray-200 px-4 sm:px-8 flex items-center justify-between shrink-0 text-[10px] text-gray-500">
        <div className="flex items-center space-x-4">
          <span>© {new Date().getFullYear()} Bank of America Corporation. All rights reserved.</span>
          <span className="hidden sm:inline">|</span>
          <a href="#privacy" className="hover:underline hidden sm:inline">Privacy</a>
          <a href="#security" className="hover:underline hidden sm:inline">Security</a>
          <a href="#housing" className="hover:underline hidden sm:inline">Equal Housing Lender</a>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            Secure Session Active
          </span>
        </div>
      </footer>
    </div>
  );
};
