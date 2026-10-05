import express from 'express';
import { UsersignUpController, verifyOtpController } from '../controllers/UserController.js';

const router = express.Router();

router.post('/signup', UsersignUpController);
router.post('/verify-otp', verifyOtpController)




export default router