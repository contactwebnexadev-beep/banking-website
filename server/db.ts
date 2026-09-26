import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { User, Account, Transaction, VerificationCode, AuditLog } from './models.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (mongoose.connection.readyState === 0) connectionPromise = null;

  if (!connectionPromise) {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not configured. Add your MongoDB Atlas connection string to the environment.');
    }

    connectionPromise = mongoose.connect(mongoUri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
    }).then(async (connection) => {
      await Promise.all([
        User.init(), Account.init(), Transaction.init(), VerificationCode.init(), AuditLog.init(),
      ]);
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminEmail && adminPassword && !(await User.exists({ email: adminEmail }))) {
        await User.create({
          id: `usr_admin_${randomUUID()}`,
          email: adminEmail,
          password_hash: bcrypt.hashSync(adminPassword, 12),
          full_name: process.env.ADMIN_FULL_NAME?.trim() || 'System Administrator',
          role: 'ADMIN',
          phone: process.env.ADMIN_PHONE?.trim() || 'Not provided',
          created_at: new Date().toISOString(),
        });
      }
      return connection;
    }).catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function requireDatabase(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    res.status(503).json({ error: errorMessage(error, 'Database service is temporarily unavailable.') });
  }
}