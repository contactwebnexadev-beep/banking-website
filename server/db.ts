import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

let dbInstance: Database | null = null;
const dbPath = path.resolve(process.cwd(), 'bank.sqlite');

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function query<T = any>(sqlStr: string, params: SqlValue[] = []): T[] {
  const db = getDatabase();
  const stmt = db.prepare(sqlStr);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function get<T = any>(sqlStr: string, params: SqlValue[] = []): T | null {
  const rows = query<T>(sqlStr, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sqlStr: string, params: SqlValue[] = []): void {
  const db = getDatabase();
  db.run(sqlStr, params);
  saveDatabase();
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  let shouldSeed = false;
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Failed to load existing database file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
      shouldSeed = true;
    }
  } else {
    dbInstance = new SQL.Database();
    shouldSeed = true;
  }

  // Create Schema
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      phone TEXT NOT NULL,
      security_pin TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_number TEXT UNIQUE NOT NULL,
      account_type TEXT NOT NULL,
      nickname TEXT NOT NULL,
      balance REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      routing_number TEXT NOT NULL,
      credit_limit REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      description TEXT NOT NULL,
      recipient_name TEXT,
      recipient_account TEXT,
      status TEXT NOT NULL DEFAULT 'Completed',
      category TEXT DEFAULT 'General',
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      metadata TEXT,
      expires_at INTEGER NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      target_account_id TEXT,
      amount REAL,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  try {
    dbInstance.run("ALTER TABLE users ADD COLUMN security_pin TEXT;");
  } catch (err) {
    // Column already exists or table is fresh
  }

  // Check if seed data needed
  const userCount = get<{ count: number }>('SELECT count(*) as count FROM users');
  if (shouldSeed || !userCount || userCount.count === 0) {
    await seedDatabase();
  }

  // Keep the initial administrator available even when an existing database skips full reseeding.
  const initialAdmin = get<any>('SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)', ['admin@bankofamerica.com']);
  if (!initialAdmin) {
    const adminHash = bcrypt.hashSync('admin123', bcrypt.genSaltSync(10));
    run(
      `INSERT INTO users (id, email, password_hash, full_name, role, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['usr_admin_boa_001', 'admin@bankofamerica.com', adminHash, 'Bank Administrator', 'ADMIN', '+1 (800) 432-1000', new Date().toISOString()]
    );
  } else if (String(initialAdmin.role).toUpperCase() !== 'ADMIN') {
    run('UPDATE users SET role = ? WHERE id = ?', ['ADMIN', initialAdmin.id]);
  }

  saveDatabase();
  console.log('SQLite Database ready and initialized.');
  return dbInstance;
}

async function seedDatabase(): Promise<void> {
  console.log('Seeding initial banking data...');
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const customerHash = bcrypt.hashSync('customer123', salt);

  const adminId = 'usr_admin_boa_001';
  const customerId = 'usr_cust_boa_002';
  const now = new Date().toISOString();

  // 1. Seed Users
  run(
    `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, 'admin@bankofamerica.com', adminHash, 'Bank Administrator', 'ADMIN', '+1 (800) 432-1000', now]
  );

  run(
    `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [customerId, 'customer@bankofamerica.com', customerHash, 'David M. Miller', 'user', '+1 (555) 849-4821', now]
  );

  // 2. Seed Customer Accounts
  const checkingId = 'acc_chk_4821';
  const savingsId = 'acc_sav_9312';
  const creditCardId = 'acc_crd_2817';

  // Seed checking with exact $5,240.50 USD as specified in user prompt!
  run(
    `INSERT OR REPLACE INTO accounts (id, user_id, account_number, account_type, nickname, balance, currency, routing_number, credit_limit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [checkingId, customerId, '009482184821', 'Checking', 'Bank of America Advantage Plus Banking®', 5240.50, 'USD', '026009593', 0, 'Active', now]
  );

  run(
    `INSERT OR REPLACE INTO accounts (id, user_id, account_number, account_type, nickname, balance, currency, routing_number, credit_limit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [savingsId, customerId, '009312049312', 'Savings', 'Bank of America Advantage Savings', 12850.00, 'USD', '026009593', 0, 'Active', now]
  );

  run(
    `INSERT OR REPLACE INTO accounts (id, user_id, account_number, account_type, nickname, balance, currency, routing_number, credit_limit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [creditCardId, customerId, '451098492817', 'Credit Card', 'Bank of America® Customized Cash Rewards', 412.30, 'USD', '026009593', 5000.00, 'Active', now]
  );

  // 3. Seed Realistic Transactions
  const seedTx = [
    {
      id: 'tx_seed_01',
      userId: customerId,
      accountId: checkingId,
      type: 'deposit',
      amount: 2850.00,
      desc: 'Direct Deposit ACME CORP PAYROLL',
      recipientName: 'David M. Miller',
      recipientAccount: '009482184821',
      status: 'Completed',
      category: 'Income',
      date: '2026-09-01',
      created_at: Date.now() - 5 * 86400000,
    },
    {
      id: 'tx_seed_02',
      userId: customerId,
      accountId: checkingId,
      type: 'withdrawal',
      amount: 84.22,
      desc: 'Whole Foods Market #10294 Austin TX',
      recipientName: 'Whole Foods Market',
      recipientAccount: '',
      status: 'Completed',
      category: 'Groceries',
      date: '2026-09-02',
      created_at: Date.now() - 4 * 86400000,
    },
    {
      id: 'tx_seed_03',
      userId: customerId,
      accountId: checkingId,
      type: 'withdrawal',
      amount: 142.50,
      desc: 'Duke Energy Online Utility Payment',
      recipientName: 'Duke Energy',
      recipientAccount: '',
      status: 'Completed',
      category: 'Utilities',
      date: '2026-09-03',
      created_at: Date.now() - 3 * 86400000,
    },
    {
      id: 'tx_seed_04',
      userId: customerId,
      accountId: checkingId,
      type: 'deposit',
      amount: 350.00,
      desc: 'Mobile Check Deposit #004921',
      recipientName: 'David M. Miller',
      recipientAccount: '009482184821',
      status: 'Pending',
      category: 'Deposit',
      date: '2026-09-05',
      created_at: Date.now() - 1 * 86400000,
    },
    {
      id: 'tx_seed_05',
      userId: customerId,
      accountId: checkingId,
      type: 'transfer_out',
      amount: 75.00,
      desc: 'Zelle Payment to Sarah Jenkins (Dinner split)',
      recipientName: 'Sarah Jenkins',
      recipientAccount: 's.jenkins@email.com',
      status: 'Completed',
      category: 'Transfer',
      date: '2026-09-05',
      created_at: Date.now() - 18 * 3600000,
    },
    {
      id: 'tx_seed_06',
      userId: customerId,
      accountId: checkingId,
      type: 'withdrawal',
      amount: 6.85,
      desc: 'Starbucks Store #08491 Charlotte NC',
      recipientName: 'Starbucks',
      recipientAccount: '',
      status: 'Completed',
      category: 'Dining',
      date: '2026-09-06',
      created_at: Date.now() - 4 * 3600000,
    },
    {
      id: 'tx_seed_07',
      userId: customerId,
      accountId: savingsId,
      type: 'deposit',
      amount: 500.00,
      desc: 'Scheduled Monthly Auto-Transfer from Checking',
      recipientName: 'Advantage Savings',
      recipientAccount: '009312049312',
      status: 'Completed',
      category: 'Savings',
      date: '2026-09-01',
      created_at: Date.now() - 5 * 86400000,
    },
  ];

  for (const tx of seedTx) {
    run(
      `INSERT OR REPLACE INTO transactions (id, user_id, account_id, type, amount, currency, description, recipient_name, recipient_account, status, category, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tx.id, tx.userId, tx.accountId, tx.type, tx.amount, 'USD', tx.desc, tx.recipientName, tx.recipientAccount, tx.status, tx.category, tx.date, tx.created_at]
    );
  }

  // 4. Seed an initial audit log
  run(
    `INSERT OR REPLACE INTO audit_logs (id, admin_id, admin_email, action, target_user_id, target_account_id, amount, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'log_seed_01',
      adminId,
      'admin@bankofamerica.com',
      'SYSTEM_INIT',
      customerId,
      checkingId,
      5240.50,
      'Initial system bootstrap with seed customer account and verified compliance balance',
      '127.0.0.1',
      now
    ]
  );

  console.log('Seed data successfully applied.');
}
