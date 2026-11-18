import express from 'express';
import { createPaymentOrderController,verifyPaymentController } from '../controllers/PaymentController.js';
import { protect,customerOnly} from '../middlewares/authMiddleware.js';
import { validationPaymentOrder } from '../middlewares/validation.js';

const router = express.Router();

router.post('/api/payments/create-order',protect,customerOnly,validationPaymentOrder,createPaymentOrderController);
router.post('/api/payments/verify',protect,customerOnly,verifyPaymentController);

export default router;