import express from "express";
import{
    getWalletBalanceController,
    getWalletTransactionsController
} from '../controllers/WalletController.js';
import{protect,customerOnly} from '../middlewares/authMiddleware.js';


const router = express.Router();


router.get('/balance', protect, customerOnly, getWalletBalanceController);
router.get('/transactions', protect, customerOnly, getWalletTransactionsController);


export default router;
