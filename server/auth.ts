import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'boa_secure_enterprise_key_984729104';

export interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
  full_name: string;
  phone: string;
}

export interface Temp2FAPayload {
  id: string;
  email: string;
  purpose: 'login' | 'transfer';
  role: 'user' | 'admin';
  transferData?: any;
}

export function signAuthToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function signTemp2FAToken(payload: Temp2FAPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export function verifyTemp2FAToken(token: string): Temp2FAPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Temp2FAPayload;
  } catch (err) {
    return null;
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function isAdminRole(role: unknown): boolean {
  return String(role || '').toUpperCase() === 'ADMIN';
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.boa_token;
  let token: string | undefined = cookieToken;

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim();
    } else if (authHeader.trim()) {
      token = authHeader.trim();
    }
  }

  // Fallback to body or query token for restrictive proxy or iframe environments
  if (!token && req.body && typeof req.body.token === 'string') {
    token = req.body.token.trim();
  }
  if (!token && typeof req.query?.token === 'string') {
    token = (req.query.token as string).trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  req.user = decoded;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
      return;
    }
    next();
  });
}
