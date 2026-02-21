import { executeTransaction, lockAccounts } from '../utils/ledger.js';

// Pre-defined System Account IDs (These would likely be queried from the DB on startup in prod, but for simplicity we assume names or exact UUIDs here)
// Easiest is to look them up by name inside the transaction, but querying `accounts` beforehand or during `lockAccounts` is safer.

const SYSTEM_ACCOUNTS = {
    CASH_RESERVE: 'Cash_Reserve',
    MARKETING: 'Marketing_Expense',
    REVENUE: 'Revenue'
};

const getAccountIdByName = async (client, name) => {
    const res = await client.query('SELECT id FROM accounts WHERE name = $1', [name]);
    if (res.rows.length === 0) throw new Error(`System account ${name} not found`);
    return res.rows[0].id;
};

/**
 * Top-up: User buys points (cash -> points)
 * Debit Cash_Reserve, Credit User_Wallet
 */
export const processTopUp = async (userId, amount, idempotencyKey) => {
    return executeTransaction(async (client) => {
        // Find treasury account ID
        const treasuryId = await getAccountIdByName(client, SYSTEM_ACCOUNTS.CASH_RESERVE);

        // Optional: lock the accounts (Treasury and User) deterministically to prevent deadlocks
        await lockAccounts(client, [treasuryId, userId]);

        // 1. Insert parent transaction record with idempotency key
        const txRes = await client.query(
            'INSERT INTO transactions (idempotency_key, description) VALUES ($1, $2) RETURNING id',
            [idempotencyKey, `Wallet Top-up: ${amount} points`]
        );
        const transactionId = txRes.rows[0].id;

        // 2. Insert debit posting (System Asset increase) - Positive
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, treasuryId, amount] // Debit
        );

        // 3. Insert credit posting (User Wallet increase, system liability) - Negative
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, userId, -amount] // Credit
        );

        return { transactionId, status: 'Top-up successful', amount };
    });
};

/**
 * Bonus: System gives points (marketing expense -> points)
 * Debit Marketing_Expense, Credit User_Wallet
 */
export const processBonus = async (userId, amount, idempotencyKey) => {
    return executeTransaction(async (client) => {
        const marketingId = await getAccountIdByName(client, SYSTEM_ACCOUNTS.MARKETING);

        await lockAccounts(client, [marketingId, userId]);

        const txRes = await client.query(
            'INSERT INTO transactions (idempotency_key, description) VALUES ($1, $2) RETURNING id',
            [idempotencyKey, `Referral Bonus: ${amount} points`]
        );
        const transactionId = txRes.rows[0].id;

        // Debit Marketing Expense
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, marketingId, amount]
        );

        // Credit User Wallet
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, userId, -amount]
        );

        return { transactionId, status: 'Bonus awarded successfully', amount };
    });
};

/**
 * Spend: User spends points
 * Debit User_Wallet, Credit Revenue.
 * Also verifies sufficient funds using the pessimistic lock.
 */
export const processSpend = async (userId, amount, idempotencyKey) => {
    return executeTransaction(async (client) => {
        const revenueId = await getAccountIdByName(client, SYSTEM_ACCOUNTS.REVENUE);

        // Lock accounts alphabetically to prevent deadlock
        const lockedAccounts = await lockAccounts(client, [revenueId, userId]);

        // Verify balance. Our user balance logic: Credit decreases liability, Debit increases liability. 
        // Wait, User_Wallet is a LIABILITY account (Credit is positive to them).
        // Let's standardise how balance is read. Our lockAccounts returns COALESCE(SUM(p.amount), 0)
        // If User Wallet received credit (-500) and spent (+100), SUM is -400.
        // The *absolute* value of the negative sum is the user's spending power.
        const userState = lockedAccounts[userId];
        const userBalance = (userState.balance * -1); // Convert negative credit sum to positive points available

        if (userBalance < amount) {
            // Throw custom error to be caught by the controller and mapped to 400 Bad Request
            const error = new Error(`Insufficient funds: Balance is ${userBalance}, tried to spend ${amount}`);
            error.code = 'INSUFFICIENT_FUNDS';
            throw error;
        }

        const txRes = await client.query(
            'INSERT INTO transactions (idempotency_key, description) VALUES ($1, $2) RETURNING id',
            [idempotencyKey, `Purchase/Spend: ${amount} points`]
        );
        const transactionId = txRes.rows[0].id;

        // User Spends: Debit User_Wallet (removes liability, positive amount)
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, userId, amount]
        );

        // System Earns: Credit Revenue (negative amount)
        await client.query(
            'INSERT INTO postings (transaction_id, account_id, amount) VALUES ($1, $2, $3)',
            [transactionId, revenueId, -amount]
        );

        return { transactionId, status: 'Spend successful', amount_spent: amount, remaining_balance: userBalance - amount };
    });
};
