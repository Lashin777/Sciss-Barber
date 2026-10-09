import express from 'express';
import { UsersignUpController, verifyOtpController, resendOtpController, forgetPasswordController, resetPasswordController, userLoginController } from '../controllers/UserController.js';

const router = express.Router();

router.post('/signup', UsersignUpController);
router.post('/verify-otp', verifyOtpController);
router.post('/resend-otp', resendOtpController);
router.post('/forget-password', forgetPasswordController);
router.patch('/reset-password', resetPasswordController);
router.post('/login', userLoginController);



export default router