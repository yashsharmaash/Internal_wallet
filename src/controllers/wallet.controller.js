import * as WalletService from '../services/wallet.service.js';
import { query } from '../config/db.js';

const handleError = (res, error) => {
    console.error('Controller Error:', error);

    // Map custom service errors
    if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: error.message });
    }
    if (error.code === 'ACCOUNT_NOT_FOUND') {
        return res.status(404).json({ error: error.message });
    }

    // Map specific PostgreSQL constraint violations
    if (error.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format provided' });
    }

    // e.g., Uniqueness constraint on idempotency_key (23505)
    // Though we check in the middleware, concurrency can cause a race condition at insertion time!
    if (error.code === '23505') {
        return res.status(409).json({ error: 'Conflict: Idempotency-Key already processing/processed concurrently' });
    }

    // Generic error
    res.status(500).json({ error: 'Internal Server Error' });
};

export const topup = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid userId or amount' });
        }

        const result = await WalletService.processTopUp(userId, amount, req.idempotencyKey);
        res.status(201).json(result);
    } catch (error) {
        handleError(res, error);
    }
};

export const bonus = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid userId or amount' });
        }

        const result = await WalletService.processBonus(userId, amount, req.idempotencyKey);
        res.status(201).json(result);
    } catch (error) {
        handleError(res, error);
    }
};

export const spend = async (req, res) => {
    try {
        const { userId, amount } = req.body;
        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid userId or amount' });
        }

        const result = await WalletService.processSpend(userId, amount, req.idempotencyKey);
        res.status(201).json(result);
    } catch (error) {
        handleError(res, error);
    }
};

export const getUsers = async (req, res) => {
    try {
        const result = await query("SELECT id, name FROM accounts WHERE type = 'LIABILITY'");
        res.status(200).json({ users: result.rows });
    } catch (error) {
        handleError(res, error);
    }
};

export const getBalance = async (req, res) => {
    try {
        const { userId } = req.params;
        const balanceRes = await query(
            'SELECT COALESCE(SUM(amount), 0) AS balance FROM postings WHERE account_id = $1',
            [userId]
        );
        const balance = (parseFloat(balanceRes.rows[0].balance) * -1); // LIABILITY implies credit is negative logic. We show positive to user.
        res.status(200).json({ userId, balance });
    } catch (error) {
        handleError(res, error);
    }
};
