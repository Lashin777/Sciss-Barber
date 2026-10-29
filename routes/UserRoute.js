import express from 'express';
import {
    UsersignUpController,
    verifyOtpController,
    resendOtpController,
    forgetPasswordController,
    resetPasswordController,
    userLoginController,
    userLogoutController,
    updateUserProfileController,
    changeUserPasswordController,
    sendEmailChangeOtpController,
    verifyEmailChangeOtpController,
    googleCallbackController,
    renderHomePageController,
    renderLoginPageController,
    renderSignupPageController,
    renderAboutPageController,
    renderServicesPageController,
    renderProfilePageController,
    renderProfileEditPageController,
    renderBookingPageController,
} from '../controllers/UserController.js';
import { validationSignup, validationLogin, validationProfileUpdate, validationPasswordChange, validationResetPassword } from '../middlewares/validation.js';
import passport from 'passport';
import { protect, customerOnly, optionalAuth, preventCache } from '../middlewares/authMiddleware.js';
import googleAuthMiddleWare from '../middlewares/googleAuthMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
const router = express.Router();


router.post('/api/user/signup', validationSignup, UsersignUpController);
router.post('/api/user/verify-otp', verifyOtpController);
router.post('/api/user/resend-otp', resendOtpController);
router.post('/api/user/forget-password', forgetPasswordController);
router.patch('/api/user/reset-password', validationResetPassword, resetPasswordController);
router.post('/api/user/login', validationLogin, userLoginController);
router.post('/api/user/logout', protect, customerOnly, userLogoutController);
router.patch('/api/user/profile', protect, customerOnly, upload.single('profileImage'), validationProfileUpdate, updateUserProfileController);
router.patch('/api/user/password', protect, customerOnly, validationPasswordChange, changeUserPasswordController);
router.post('/api/user/email-change/request', protect, customerOnly, sendEmailChangeOtpController);
router.post('/api/user/email-change/verify', protect, customerOnly, verifyEmailChangeOtpController);

//GOOGLE ROUTE
router.get('/api/user/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/api/user/auth/google/callback', googleAuthMiddleWare, googleCallbackController)

//FRONTED RENDER ROUTES
router.get('/', preventCache, optionalAuth, renderHomePageController);
router.get('/login', preventCache, optionalAuth, renderLoginPageController);
router.get('/signup', renderSignupPageController);
router.get('/about', renderAboutPageController);
router.get('/services', renderServicesPageController);
router.get('/profile', preventCache, optionalAuth, renderProfilePageController);
router.get('/profile/edit', preventCache, optionalAuth, renderProfileEditPageController);
router.get('/booking', preventCache, renderBookingPageController);



export default router
