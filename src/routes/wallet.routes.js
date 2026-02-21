import express from 'express';
import { checkIdempotency } from '../middlewares/idempotency.js';
import * as WalletController from '../controllers/wallet.controller.js';

const router = express.Router();

// Apply idempotency middleware to all POST routes in this router
router.use(checkIdempotency);

// Define endpoints referencing controller actions
router.post('/topup', WalletController.topup);
router.post('/bonus', WalletController.bonus);
router.post('/spend', WalletController.spend);

export default router;
