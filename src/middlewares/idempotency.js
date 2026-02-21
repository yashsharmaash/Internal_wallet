import { query } from '../config/db.js';

/**
 * Express middleware to enforce Idempotency-Key from headers.
 * Queries the database to prevent duplicate transactions if a network drop causes a client retry.
 */
export const checkIdempotency = async (req, res, next) => {
    const idempotencyKey = req.header('Idempotency-Key');

    if (!idempotencyKey) {
        return res.status(400).json({ error: 'Idempotency-Key header is required' });
    }

    try {
        // Query the transactions table to see if this key has already been processed successfully
        const result = await query(
            'SELECT id, description, created_at FROM transactions WHERE idempotency_key = $1',
            [idempotencyKey]
        );

        if (result.rows.length > 0) {
            // Recognize as a duplicate and return the cached success response 
            // instead of charging the user a second time. (Brownie points requirement)
            return res.status(200).json({
                message: 'Transaction already processed (Idempotent replay)',
                transaction: result.rows[0]
            });
        }

        // Attach key to request for use in the controller/service
        req.idempotencyKey = idempotencyKey;
        next();
    } catch (error) {
        console.error('Error in idempotency middleware:', error);
        res.status(500).json({ error: 'Internal server error during idempotency check' });
    }
};
