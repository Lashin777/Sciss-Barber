import express from 'express';
import { createPaymentOrderController,
        verifyPaymentController,
        paymentFailedController,
        payWithWalletController
} from '../controllers/PaymentController.js';
import { protect,customerOnly} from '../middlewares/authMiddleware.js';
import { validationPaymentOrder } from '../middlewares/validation.js';

const router = express.Router();

router.post('/api/payments/create-order',protect,customerOnly,validationPaymentOrder,createPaymentOrderController);
router.post('/api/payments/verify',protect,customerOnly,verifyPaymentController);
router.post('/api/payments/failed', protect, customerOnly, paymentFailedController);
router.post('/api/payments/wallet', protect, customerOnly, payWithWalletController);

export default router;
