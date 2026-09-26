import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, Account, VerificationCode, AuditLog } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import {
  signAuthToken,
  signTemp2FAToken,
  verifyTemp2FAToken,
  generateOTP,
  requireAuth,
  isAdminRole,
  AuthenticatedRequest
} from '../auth.js';

const router = Router();
router.use(requireDatabase);

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const maskedName = name.length > 2
    ? name[0] + '***' + name[name.length - 1]
    : name[0] + '***';
  return `${maskedName}@${parts[1]}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  const last4 = phone.slice(-4);
  return `(***) ***-${last4}`;
}

// POST /api/auth/login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter your Online ID / Email and Passcode.' });
      return;
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password_hash').lean<any>();
    if (!user) {
      res.status(401).json({ error: 'The Online ID or Passcode entered does not match our records.' });
      return;
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'The Online ID or Passcode entered does not match our records.' });
      return;
    }

    if (portal === 'admin' && !isAdminRole(user.role)) {
      res.status(403).json({ error: 'Administrator credentials are required for this portal.' });
      return;
    }

    const normalizedRole = isAdminRole(user.role) ? 'admin' : 'user';

    // Generate 2FA code
    const otpCode = generateOTP();
    const otpId = 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await VerificationCode.create({
      id: otpId, user_id: user.id, email: user.email, phone: user.phone,
      code: otpCode, purpose: 'login', expires_at: expiresAt,
      verified: false, created_at: Date.now(),
    });

    const tempToken = signTemp2FAToken({
      id: user.id,
      email: user.email,
      role: normalizedRole,
      purpose: 'login',
    });

    res.json({
      require2FA: true,
      tempToken,
      otpId,
      maskedEmail: maskEmail(user.email),
      maskedPhone: maskPhone(user.phone),
      email: user.email,
      phone: user.phone,
      // For developer / user testing in sandbox without real cellular carrier:
      simulatedOtp: otpCode,
      message: 'A security authorization code has been dispatched. Enter the 6-digit code to complete sign in.'
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: errorMessage(err, 'Internal server error during authentication.') });
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res): Promise<void> => {
  try {
    const { tempToken, code, otpId } = req.body;

    if (!tempToken || !code) {
      res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
      return;
    }

    const payload = verifyTemp2FAToken(tempToken);
    if (!payload || payload.purpose !== 'login') {
      res.status(401).json({ error: 'Verification session expired. Please sign in again.' });
      return;
    }

    const record = await VerificationCode.findOne({
      user_id: payload.id, purpose: 'login', verified: false, expires_at: { $gt: Date.now() },
    }).sort({ created_at: -1 }).lean<any>();

    if (!record || record.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid verification code. Please check your code and try again.' });
      return;
    }

    // Mark verified
    await VerificationCode.updateOne({ id: record.id }, { $set: { verified: true } });

    const user = await User.findOne({ id: payload.id }).select('id email full_name role phone').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const normalizedRole = isAdminRole(user.role) ? 'admin' : 'user';
    const authToken = signAuthToken({
      id: user.id,
      email: user.email,
      role: normalizedRole,
      full_name: user.full_name,
      phone: user.phone,
    });

    // Set HTTP-only cookie
    res.cookie('boa_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000,
    });

    res.json({
      success: true,
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: normalizedRole,
        phone: user.phone,
      },
    });
  } catch (err: any) {
    console.error('2FA verification error:', err);
    res.status(500).json({ error: errorMessage(err, 'Verification processing failed.') });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res): Promise<void> => {
  try {
    const { tempToken, channel } = req.body;
    if (!tempToken) {
      res.status(400).json({ error: 'Session token required.' });
      return;
    }

    const payload = verifyTemp2FAToken(tempToken);
    if (!payload) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    const user = await User.findOne({ id: payload.id }).lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const otpCode = generateOTP();
    const otpId = 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await VerificationCode.create({
      id: otpId, user_id: user.id, email: user.email, phone: user.phone,
      code: otpCode, purpose: 'login', expires_at: expiresAt,
      verified: false, created_at: Date.now(),
    });

    res.json({
      success: true,
      otpId,
      channel: channel || 'email',
      simulatedOtp: otpCode,
      message: `A fresh 6-digit verification code was sent via ${channel === 'sms' ? 'SMS text message' : 'Secure Email'}.`,
    });
  } catch (err: any) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to dispatch new verification code.') });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await User.findOne({ id: req.user.id }).select('id email full_name role phone').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: { ...user, role: isAdminRole(user.role) ? 'admin' : 'user' } });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve user profile.') });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('boa_token');
  res.json({ success: true, message: 'Successfully signed out from Bank of America Online Banking.' });
});

// POST /api/auth/register
router.post('/register', async (req, res): Promise<void> => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { name, fullName, email, phone, password, passcode, securityPin } = req.body || {};
    const chosenName = String(name || fullName || '').trim();
    const chosenPassword = password || passcode;

    if (!chosenName || !email || !phone || !chosenPassword) {
      res.status(400).json({
        success: false,
        error: 'Please provide all required fields: name, email, phone, and password.'
      });
      return;
    }

    if (typeof chosenPassword !== 'string' || chosenPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Passcode must be at least 6 characters in length.'
      });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(fullName || chosenName).trim();
    const cleanPhone = String(phone).trim();
    const pin = securityPin ? String(securityPin).trim() : '1234';

    // 1. Check if user already exists (with try/catch)
    let existing: any = null;
    try {
      existing = await User.exists({ email: cleanEmail });
    } catch (checkErr: any) {
      console.error('Database query error checking existing user:', checkErr);
      res.status(500).json({
        success: false,
        error: errorMessage(checkErr, 'Database error validating email uniqueness.')
      });
      return;
    }

    if (existing) {
      res.status(400).json({
        success: false,
        error: 'An online banking profile already exists for this email address. Please sign in.'
      });
      return;
    }

    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const passwordHash = bcrypt.hashSync(chosenPassword, 10);
    const createdAt = new Date().toISOString();
    const pinHash = bcrypt.hashSync(pin, 10);

    try {
      await User.create({
        id: userId, email: cleanEmail, password_hash: passwordHash,
        full_name: cleanName, role: 'user', phone: cleanPhone,
        security_pin: pinHash, created_at: createdAt,
      });
    } catch (dbInsertErr: any) {
      console.error('MongoDB user insertion failed:', dbInsertErr);
      res.status(500).json({
        success: false,
        error: errorMessage(dbInsertErr, 'Could not complete user registration in database.')
      });
      return;
    }

    // 3. Generate unique 10-digit Account Number (safe loop with max attempts)
    let accNum = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 15) {
      attempts++;
      accNum = '48' + Math.floor(10000000 + Math.random() * 90000000).toString();
      isUnique = !(await Account.exists({ account_number: accNum }));
    }
    if (!accNum || !isUnique) {
      accNum = '48' + Date.now().toString().slice(-8);
    }

    const accountId = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const routingNumber = '026009593';

    // 4. Create primary Advantage Plus Checking Account (with try/catch)
    try {
      await Account.create({
        id: accountId, user_id: userId, account_number: accNum,
        account_type: 'Checking', nickname: 'Advantage Plus Checking',
        balance: 0, currency: 'USD', routing_number: routingNumber,
        status: 'Active', created_at: createdAt,
      });
      await User.updateOne({ id: userId }, { $set: { account_number: accNum } });
    } catch (accErr: any) {
      console.error('MongoDB account insertion error:', accErr);
      await User.deleteOne({ id: userId });
      res.status(500).json({
        success: false,
        error: errorMessage(accErr, 'Failed to open the initial checking account.')
      });
      return;
    }

    // 5. Record initial ledger audit log (non-fatal try/catch)
    try {
      const auditId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await AuditLog.create({
        id: auditId, admin_id: 'system', admin_email: 'system@bankofamerica.com',
        action: 'ACCOUNT_OPENED', target_user_id: userId, target_account_id: accountId,
        amount: 0, details: 'Self-service online registration and Advantage Checking opened ($0.00 USD)',
        created_at: createdAt,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error during registration:', auditErr);
    }

    // 6. Generate authenticated JWT for instant login or redirect
    let authToken = '';
    try {
      authToken = signAuthToken({
        id: userId,
        email: cleanEmail,
        role: 'user',
        full_name: cleanName,
        phone: cleanPhone,
      });

      res.cookie('boa_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 3600 * 1000,
      });
    } catch (tokenErr) {
      console.warn('Auth token generation warning:', tokenErr);
    }

    // 7. Structured HTTP 201 JSON Response
    res.status(201).json({
      success: true,
      message: 'Your Bank of America Online Banking enrollment is complete!',
      token: authToken,
      user: {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        full_name: cleanName,
        role: 'user',
        phone: cleanPhone,
      },
      account: {
        id: accountId,
        account_number: accNum,
        routing_number: routingNumber,
        account_type: 'Checking',
        nickname: 'Advantage Plus Checking',
        balance: 0.00,
        currency: 'USD',
        status: 'Active',
      }
    });
  } catch (err: any) {
    console.error('Registration processing unexpected error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : errorMessage(err, 'Failed to process online registration. Please try again later.')
      });
    }
  }
});

export default router;
