-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Assets Table (e.g., POINTS, USD)
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'POINTS'
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table
-- Types: ASSET (System), LIABILITY (User Wallet), EXPENSE (Marketing), REVENUE
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EXPENSE', 'REVENUE')),
    asset_id VARCHAR(50) REFERENCES assets(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transactions Table (Header record for a set of postings)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Postings Table (The actual movements of funds)
-- We use a single signed amount column: Debit is positive, Credit is negative.
-- The sum of amounts for the same transaction_id must always be zero.
CREATE TABLE IF NOT EXISTS postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount NUMERIC(20, 4) NOT NULL, -- signed amount
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_postings_transaction_id ON postings(transaction_id);
CREATE INDEX IF NOT EXISTS idx_postings_account_id ON postings(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency_key ON transactions(idempotency_key);

-- Initial Seeding
-- 1. Insert 'POINTS' asset
INSERT INTO assets (id, name) 
VALUES ('POINTS', 'System Reward Points')
ON CONFLICT (id) DO NOTHING;

-- 2. Establish Master Accounts
-- Cash_Reserve: System Asset (where points come from when purchased)
INSERT INTO accounts (name, type, asset_id)
VALUES ('Cash_Reserve', 'ASSET', 'POINTS')
ON CONFLICT (name) DO NOTHING;

-- Marketing_Expense: System Expense (where points come from for bonuses)
INSERT INTO accounts (name, type, asset_id)
VALUES ('Marketing_Expense', 'EXPENSE', 'POINTS')
ON CONFLICT (name) DO NOTHING;

-- Revenue: System Revenue (where points go when spent)
INSERT INTO accounts (name, type, asset_id)
VALUES ('Revenue', 'REVENUE', 'POINTS')
ON CONFLICT (name) DO NOTHING;

-- 3. Demo User Wallets (Requirement: At least two users)
INSERT INTO accounts (name, type, asset_id)
VALUES 
    ('User_Wallet_001', 'LIABILITY', 'POINTS'),
    ('User_Wallet_002', 'LIABILITY', 'POINTS')
ON CONFLICT (name) DO NOTHING;
