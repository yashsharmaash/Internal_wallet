import * as WalletService from '../services/wallet.service.js';

const handleError = (res, error) => {
    console.error('Controller Error:', error);

    // Map custom service errors
    if (error.code === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: error.message });
    }

    // Map specific PostgreSQL constraint violations
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
