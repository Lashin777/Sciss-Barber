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
    addAddressController,
    getUserAddressesController,
    updateAddressController,
    deleteAddressController,
    setDefaultAddressController
} from '../controllers/UserController.js';
import { validationSignup, validationLogin, validationProfileUpdate } from '../middlewares/validation.js';
import passport from 'passport';
import { protect, customerOnly, optionalAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/api/user/signup', validationSignup, UsersignUpController);
router.post('/api/user/verify-otp', verifyOtpController);
router.post('/api/user/resend-otp', resendOtpController);
router.post('/api/user/forget-password', forgetPasswordController);
router.patch('/api/user/reset-password', resetPasswordController);
router.post('/api/user/login', validationLogin, userLoginController);
// Worked by Codex: submit logout as POST so the server can clear the session cookie.
router.post('/api/user/logout', userLogoutController);
router.patch('/api/user/profile', protect, customerOnly, validationProfileUpdate, updateUserProfileController);
router.post('/api/user/email-change/request', protect, customerOnly, sendEmailChangeOtpController);
router.post('/api/user/email-change/verify', protect, customerOnly, verifyEmailChangeOtpController);
router.get('/api/user/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/api/user/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/signup' }), googleCallbackController);

// Worked by Codex: keep customer facing pages alongside customer API routes.
//FRONTED RENDER ROUTES
router.get('/', optionalAuth, renderHomePageController);
router.get('/login', renderLoginPageController);
router.get('/signup', renderSignupPageController);
router.get('/about', renderAboutPageController);
router.get('/services', renderServicesPageController);
router.get('/profile', optionalAuth, renderProfilePageController);
router.get('/profile/edit', optionalAuth, renderProfileEditPageController);
router.get('/booking', renderBookingPageController);

//ADRESS MANAGEMENT ROUTE
router.post('/api/user/addresses', protect, customerOnly, addAddressController);
router.get('/api/user/addresses', protect, customerOnly, getUserAddressesController);
router.patch('/api/user/addresses/:addressId', protect, customerOnly, updateAddressController);
router.delete('/api/user/addresses/:addressId', protect, customerOnly, deleteAddressController);
router.patch('api/user/addresses/:addressId', protect, customerOnly, setDefaultAddressController)


export default router
