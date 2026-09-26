import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password_hash: { type: String, required: true, select: false },
  full_name: { type: String, required: true, trim: true },
  role: { type: String, required: true, default: 'user', index: true },
  phone: { type: String, required: true, trim: true },
  security_pin: { type: String, select: false },
  account_number: { type: String, trim: true },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

const accountSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_number: { type: String, required: true, unique: true, index: true },
  account_type: { type: String, required: true },
  nickname: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
  currency: { type: String, required: true, default: 'USD' },
  routing_number: { type: String, required: true },
  credit_limit: { type: Number, default: 0 },
  status: { type: String, required: true, default: 'Active' },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

const transactionSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_id: { type: String, required: true, index: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  description: { type: String, required: true },
  recipient_name: { type: String, default: '' },
  recipient_account: { type: String, default: '' },
  status: { type: String, required: true, default: 'Completed', index: true },
  category: { type: String, default: 'General' },
  date: { type: String, required: true, index: true },
  created_at: { type: Number, required: true },
}, { versionKey: false, bufferCommands: false });

const verificationCodeSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  code: { type: String, required: true },
  purpose: { type: String, required: true, index: true },
  metadata: { type: Schema.Types.Mixed },
  expires_at: { type: Number, required: true, index: true },
  verified: { type: Boolean, default: false, index: true },
  created_at: { type: Number, required: true },
}, { versionKey: false, bufferCommands: false });

const auditLogSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  admin_id: { type: String, required: true },
  admin_email: { type: String, required: true },
  action: { type: String, required: true },
  target_user_id: { type: String, default: null, index: true },
  target_account_id: { type: String, default: null },
  amount: { type: Number },
  details: { type: String, required: true },
  ip_address: { type: String },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as mongoose.Model<any>;
export const Account = (mongoose.models.Account || mongoose.model('Account', accountSchema)) as mongoose.Model<any>;
export const Transaction = (mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema)) as mongoose.Model<any>;
export const VerificationCode = (mongoose.models.VerificationCode || mongoose.model('VerificationCode', verificationCodeSchema)) as mongoose.Model<any>;
export const AuditLog = (mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)) as mongoose.Model<any>;