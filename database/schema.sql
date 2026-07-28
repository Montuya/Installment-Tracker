-- Installment Tracker Database Schema
-- Auto-created on server start

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    brand TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    purchase_date TEXT DEFAULT '',
    srp REAL DEFAULT 0,
    downpayment REAL DEFAULT 0,
    terms INTEGER DEFAULT 0,
    monthly_installment REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    next_due_date TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    rebate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_next_due_date ON customers(next_due_date);
