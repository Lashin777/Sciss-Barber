import express from 'express';
import { UsersignUpController, verifyOtpController, resendOtpController } from '../controllers/UserController.js';

const router = express.Router();

router.post('/signup', UsersignUpController);
router.post('/verify-otp', verifyOtpController);
router.post('/resend-otp', resendOtpController)




export default router