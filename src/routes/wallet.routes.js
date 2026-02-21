import express from 'express';
import { checkIdempotency } from '../middlewares/idempotency.js';
import * as WalletController from '../controllers/wallet.controller.js';

const router = express.Router();

// Define GET endpoints (Idempotency middleware is skipped for GETs internally)
router.get('/users', WalletController.getUsers);
router.get('/balance/:userId', WalletController.getBalance);

// Apply idempotency middleware to all subsequent routes (POSTs)
router.use(checkIdempotency);

// Define transactional POST endpoints
router.post('/topup', WalletController.topup);
router.post('/bonus', WalletController.bonus);
router.post('/spend', WalletController.spend);

export default router;
