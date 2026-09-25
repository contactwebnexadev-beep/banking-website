import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { initDatabase, get, run, getDatabase } from './server/db.js';
import { verifyAuthToken, signAuthToken } from './server/auth.js';
import authRoutes from './server/routes/authRoutes.js';
import userRoutes from './server/routes/userRoutes.js';
import transferRoutes from './server/routes/transferRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import verifyRoutes from './server/routes/verifyRoutes.js';
import accountRoutes from './server/routes/accountRoutes.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database
  await initDatabase();

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      bank: 'Bank of America Online Banking',
      time: new Date().toISOString(),
    });
  });

  // POST /api/auth/register - Enrollment Endpoint
  app.post(['/api/auth/register', '/api/register'], async (req: Request, res: Response): Promise<void> => {
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
      const cleanPhone = String(phone).trim();
      const pin = securityPin ? String(securityPin).trim() : '1234';

      // 1. Check if user already exists
      let existing: any = null;
      try {
        existing = get<any>('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
      } catch (checkErr: any) {
        console.error('Database query error checking existing user:', checkErr);
        res.status(400).json({
          success: false,
          error: 'Database error validating email uniqueness. Please try again.'
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

      // 2. Save user to SQLite database
      let userInserted = false;
      try {
        run(
          `INSERT INTO users (id, email, password_hash, full_name, role, phone, security_pin, created_at)
           VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
          [userId, cleanEmail, passwordHash, chosenName, cleanPhone, pin, createdAt]
        );
        userInserted = true;
      } catch (dbInsertErr: any) {
        console.warn('Initial SQLite insert failed, attempting table alter or fallback:', dbInsertErr);
        try {
          const db = getDatabase();
          try {
            db.run("ALTER TABLE users ADD COLUMN security_pin TEXT;");
          } catch {
            // column might already exist
          }
          run(
            `INSERT INTO users (id, email, password_hash, full_name, role, phone, security_pin, created_at)
             VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
            [userId, cleanEmail, passwordHash, chosenName, cleanPhone, pin, createdAt]
          );
          userInserted = true;
        } catch (retryErr: any) {
          try {
            run(
              `INSERT INTO users (id, email, password_hash, full_name, role, phone, created_at)
               VALUES (?, ?, ?, ?, 'user', ?, ?)`,
              [userId, cleanEmail, passwordHash, chosenName, cleanPhone, createdAt]
            );
            userInserted = true;
          } catch (finalErr: any) {
            console.error('SQLite user insertion fatal error:', finalErr);
            res.status(400).json({
              success: false,
              error: 'Failed to create user record in database: ' + (finalErr?.message || 'Database error')
            });
            return;
          }
        }
      }

      if (!userInserted) {
        res.status(400).json({
          success: false,
          error: 'Could not complete user registration in database.'
        });
        return;
      }

      // 3. Generate 10-digit Account Number
      let accNum = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 15) {
        attempts++;
        accNum = '48' + Math.floor(10000000 + Math.random() * 90000000).toString();
        try {
          const existingAcc = get('SELECT id FROM accounts WHERE account_number = ?', [accNum]);
          if (!existingAcc) {
            isUnique = true;
          }
        } catch {
          isUnique = true;
        }
      }
      if (!accNum || !isUnique) {
        accNum = '48' + Date.now().toString().slice(-8);
      }

      const accountId = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const routingNumber = '026009593';

      // 4. Create primary checking account with $0.00 initial balance
      try {
        run(
          `INSERT INTO accounts (id, user_id, account_number, account_type, nickname, balance, currency, routing_number, status, created_at)
           VALUES (?, ?, ?, 'Checking', 'Advantage Plus Checking', 0.00, 'USD', ?, 'Active', ?)`,
          [accountId, userId, accNum, routingNumber, createdAt]
        );
      } catch (accErr: any) {
        console.warn('Account insertion note:', accErr);
      }

      // 5. Audit log
      try {
        const auditId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        run(
          `INSERT INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, created_at)
           VALUES (?, 'system', 'system@bankofamerica.com', 'ACCOUNT_OPENED', ?, ?, 0.00, 'Self-service online registration and Advantage Checking opened ($0.00 USD)', ?)`,
          [auditId, userId, accountId, createdAt]
        );
      } catch (auditErr) {
        console.warn('Audit log note:', auditErr);
      }

      // 6. Sign auth token & Set cookie
      let authToken = '';
      try {
        authToken = signAuthToken({
          id: userId,
          email: cleanEmail,
          role: 'user',
          full_name: chosenName,
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

      // 7. Returns a 201 JSON success response
      res.status(201).json({
        success: true,
        message: 'Your Bank of America Online Banking enrollment is complete!',
        token: authToken,
        user: {
          id: userId,
          email: cleanEmail,
          name: chosenName,
          full_name: chosenName,
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
      console.error('Registration processing error:', err);
      if (!res.headersSent) {
        res.status(400).json({
          success: false,
          error: err?.message || 'Failed to process online registration.'
        });
      }
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/admin', adminRoutes);

  // Server-side route guard for /admin browser navigation
  // Strict role check: must be logged in as admin, else HTTP 403 Forbidden redirected to /dashboard
  app.get('/admin', (req: Request, res: Response, next: NextFunction) => {
    const cookieToken = req.cookies?.boa_token;
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      res.status(403);
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.json({ error: 'Forbidden: Admin access required.' });
        return;
      }
      res.redirect('/dashboard?auth_error=403_forbidden');
      return;
    }

    const decoded = verifyAuthToken(token);
    if (!decoded || decoded.role !== 'admin') {
      res.status(403);
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.json({ error: 'Forbidden: Admin access required.' });
        return;
      }
      res.redirect('/dashboard?auth_error=403_forbidden');
      return;
    }

    next();
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bank of America Banking Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
