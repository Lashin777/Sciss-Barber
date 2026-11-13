import express from 'express';
import { createPaymentOrderController } from '../controllers/PaymentController.js';
import { protect,customerOnly} from '../middlewares/authMiddleware.js';
import { validationPaymentOrder } from '../middlewares/validation.js';

const router = express.Router();

router.post('/api/payments/create-order',protect,customerOnly,validationPaymentOrder,createPaymentOrderController);

export default router;