import express from 'express';
import {
    UsersignUpController,
    verifyOtpController,
    resendOtpController,
    forgetPasswordController,
    resetPasswordController,
    userLoginController,
    googleCallbackController
} from '../controllers/UserController.js';
import passport from 'passport';

const router = express.Router();


router.post('/signup', UsersignUpController);
router.post('/verify-otp', verifyOtpController);
router.post('/resend-otp', resendOtpController);
router.post('/forget-password', forgetPasswordController);
router.patch('/reset-password', resetPasswordController);
router.post('/login', userLoginController);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/signUp' }), googleCallbackController);


export default router