import { getClient } from '../config/db.js';

/**
 * Executes a callback within a database transaction.
 * Handles BEGIN, COMMIT, ROLLBACK, and client release automatically.
 * 
 * @param {Function} callback - A function that takes a PostgreSQL client and executes queries.
 * @returns {Promise<any>} The result of the callback.
 */
export const executeTransaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Execute the business logic within the transaction
        const result = await callback(client);

        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction failed, rolled back.', error);
        throw error; // Re-throw the error to be handled by the route/controller
    } finally {
        // ALWAYS release the client back to the pool
        client.release();
    }
};

/**
 * Helper to acquire DB row locks in a deterministic order to prevent deadlocks.
 * 
 * @param {Object} client - The PostgreSQL client within the transaction.
 * @param {string[]} accountIds - Array of account UUIDs to lock.
 * @returns {Promise<Object>} An object mapping account ID to current balance.
 */
export const lockAccounts = async (client, accountIds) => {
    // 1. Sort alphabetically to prevent deadlocks
    const sortedIds = [...new Set(accountIds)].sort();

    const lockedAccounts = {};

    // 2. Lock rows sequentially in the deterministic order
    for (const id of sortedIds) {
        // Lock the account row first
        const lockQuery = 'SELECT id, name, type FROM accounts WHERE id = $1 FOR UPDATE';
        const lockRes = await client.query(lockQuery, [id]);

        if (lockRes.rows.length === 0) {
            const err = new Error(`Account not found: ${id}`);
            err.code = 'ACCOUNT_NOT_FOUND';
            throw err;
        }

        const account = lockRes.rows[0];

        // Then calculate the current balance directly from postings
        const balanceQuery = 'SELECT COALESCE(SUM(amount), 0) AS balance FROM postings WHERE account_id = $1';
        const balanceRes = await client.query(balanceQuery, [id]);

        lockedAccounts[id] = {
            ...account,
            balance: parseFloat(balanceRes.rows[0].balance)
        };
    }

    return lockedAccounts;
};
