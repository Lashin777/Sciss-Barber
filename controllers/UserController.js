import User from '../models/userModel.js';
import { UsersignUp,
        forgetPassword,
        resetPassword,
        userLogin,
        UpdateUserProfile,
        changeUserPassword,
        sendEmailChangeOtp,
        verifyEmailChangeOtp,
        ensureUserReferralCode
} from '../services/UserService.js';
import { getAllServices,
         getAllServiceCategories
} from '../services/ServiceService.js';
import { getBookingDetailsService } from '../services/BookingService.js';
import { getUserReferralsService } from '../services/ReferralService.js';
import { verifyOtp, resendOtp } from '../services/otpService.js';
import jwt from 'jsonwebtoken'
import { setUserSessionCookie, clearUserSessionCookie } from '../utils/session.js';
import ShopRules from '../models/ShopRules.js';
import passport from 'passport';
import { uploadImageToCloudinary, deleteCloudinaryProfileImage } from '../services/cloudinaryService.js';
import { readFile, unlink } from 'node:fs/promises';

// Worked by Codex: retain local uploads as a fallback when Cloudinary is not configured.
const uploadProfileImage = (file) => file?.path
    ? `/uploads/${file.filename}`
    : uploadImageToCloudinary(file);

// Worked by Codex: verify file signatures so a spoofed image MIME type cannot upload arbitrary content.
const validateUploadedProfileImage = async (file) => {
    const buffer = file.buffer || (file.path ? await readFile(file.path) : null);
    const signatures = {
        'image/jpeg': buffer?.[0] === 0xff && buffer?.[1] === 0xd8 && buffer?.[2] === 0xff,
        'image/png': buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        'image/gif': ['GIF87a', 'GIF89a'].includes(buffer?.subarray(0, 6).toString('ascii')),
        'image/webp': buffer?.subarray(0, 4).toString('ascii') === 'RIFF'
            && buffer?.subarray(8, 12).toString('ascii') === 'WEBP'
    };

    if (!buffer || !signatures[file.mimetype]) {
        if (file.path) await unlink(file.path).catch(() => {});
        const error = new Error('The selected file is not a supported JPEG, PNG, WebP, or GIF image');
        error.statusCode = 400;
        throw error;
    }
};

const renderHomePageController = (req, res) => {
    res.render('user/home', {
        title: 'Home',
        isLoggedIn: Boolean(req.user)
    });
};

const renderLoginPageController = (req, res) => {
    let message = null
    if (req.query.error === 'BLOCKED') {
        message = "Your account Have Been BLocked"
    }
    res.render('user/login', {
        title: 'Login',
        message
    });
};

const renderServicesPageController = async(req, res) =>{
    try{
        const [categories,services] = await Promise.all([
        getAllServiceCategories(),
        getAllServices()
    ]);
    const serviceGroups = categories
    .map(category => ({
        title: category.name,
        items: services.filter(service =>
            service.categoryId.toString() === category._id.toString()
        )
    }))
    .filter(group => group.items.length > 0);

     return res.render('user/services',
        { title: 'Services & Prices',
            serviceGroups
         });

    }catch(error){
        console.error("error Rendering Service Page",error);
        return res.status(500).send('Unable to load services');
    }

}


const renderSignupPageController = (req, res) => res.render('user/signup', { title: 'signUp' });
const renderAboutPageController = (req, res) => res.render('user/about', { title: 'About' });
const renderBookingPageController = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/login?returnTo=/booking');
        }
        const [categories, services, shopRules] = await Promise.all([
            getAllServiceCategories(),
            getAllServices(),
            ShopRules.findOne().select('weeklyOff').lean()
        ]);

        const serviceGroups = categories
            .map(category => ({
                title: category.name,
                items: services.filter(service =>
                    service.categoryId.toString() === category._id.toString()
                )
            }))
            .filter(group => group.items.length > 0);

        return res.render('user/booking', {
            title: 'Book an appointment',
            serviceGroups,
            weeklyOff: shopRules?.weeklyOff || '',
            user:req.user
        });

    } catch (error) {
        console.error('Error rendering booking page:', error);
        return res.status(500).send('Unable to load booking page');
    }
};

const renderBookingDetailsPageController = async (req, res) => {
    try {
        // Worked by Codex: return a not-found page for malformed IDs instead of surfacing a Mongoose cast error.
        if (!/^[a-f\d]{24}$/i.test(String(req.params.bookingId || ''))) {
            return res.status(404).render('errors/404', { title: 'Booking not found' });
        }
        if (!req.user) {
            return res.redirect('/login');
        }

        const booking = await getBookingDetailsService(
            req.params.bookingId,
            req.user._id
        );

        if (!booking) {
            return res.status(404).send('Booking not found');
        }

        return res.render('user/booking-details', {
            title: 'Booking Details',
            booking,
            user: req.user
        });

    } catch (error) {
        console.error('Error rendering booking details:', error);
        return res.status(500).send('Unable to load booking details');
    }
};

const renderProfilePageController = async (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    try {
        const [referralCode, referrals] = await Promise.all([
            ensureUserReferralCode(req.user._id),
            getUserReferralsService(req.user._id)
        ]);
        req.user.referralCode = referralCode;
        return res.render('user/profile', { title: 'Your Profile', user: req.user, referrals });
    } catch (error) {
        return next(error);
    }
};

const renderWalletPageController = async (req, res, next) => {
    if (!req.user) return res.redirect('/login?returnTo=%2Fwallet');
    try {
        return res.render('user/wallet', { title: 'My Wallet', user: req.user });
    } catch (error) {
        return next(error);
    }
};

const renderBookingHistoryPageController = (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('user/booking-history', { title: 'Booking History', user: req.user });
};

const renderProfileEditPageController = (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('user/profile-edit', { title: 'Edit Profile', user: req.user });
};

const UsersignUpController = async (req, res) => {
    try {
        const result = await UsersignUp(
            req.body.email,
            req.body.name,
            req.body.password,
            req.body.phone,
            undefined,
            req.body.referralCode
        );

        res.status(200).json({
            message: "OTP sent successfully. Please verify your email.",
            email: result.email
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const verifyOtpController = async (req, res) => {
    try {
        await verifyOtp(req.body.email, req.body.otp, req.body.purpose);
        res.status(200).json({ message: "Email verifiead successfuly" });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const resendOtpController = async (req, res) => {
    // Worked by Codex: public OTP resend must not expose authenticated email-change or admin-reset purposes.
    if (!['EMAIL_VERIFICATION', 'PASSWORD_RESET'].includes(req.body?.purpose)) {
        return res.status(400).json({ message: 'Unsupported OTP purpose' });
    }
    try {
        await resendOtp(req.body.email, req.body.purpose);
        res.status(200).json({ message: "OTP have been send" });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const forgetPasswordController = async (req, res) => {
    try {
        await forgetPassword(req.body.email);
        res.status(200).json({ message: "OTP sent to your email" });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const resetPasswordController = async (req, res) => {
    try {
        await resetPassword(req.body.email, req.body.otp, req.body.password);
        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const userLoginController = async (req, res) => {
    try {
        const result = await userLogin(req.body.email, req.body.password);
        // Worked by Codex: use the shared one-day HTTP-only customer session cookie.
        setUserSessionCookie(res, result.token);
        res.status(200).json({ message: "Login Successfull", user: result.user });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const updateUserProfileController = async (req, res) => {
    let uploadedProfileImage;
    try {
        const updatedData = {};

        if (typeof req.body.name === 'string' && req.body.name.trim() !== '') {
            updatedData.name = req.body.name.trim();
        }

        if (typeof req.body.phone === 'string' && req.body.phone.trim() !== '') {
            updatedData.phone = req.body.phone.trim();
        }

        if (req.file) {
            await validateUploadedProfileImage(req.file);
            uploadedProfileImage = await uploadProfileImage(req.file);
            updatedData.profileImage = uploadedProfileImage;
        }

        let updatedUser;
        try {
            updatedUser = await UpdateUserProfile(req.user._id, updatedData);
        } catch (error) {
            if (uploadedProfileImage?.startsWith('https://res.cloudinary.com/')) {
                await deleteCloudinaryProfileImage(uploadedProfileImage).catch(() => {});
            }
            if (req.file?.path) await unlink(req.file.path).catch(() => {});
            throw error;
        }

        if (uploadedProfileImage && req.user.profileImage && req.user.profileImage !== uploadedProfileImage) {
            await deleteCloudinaryProfileImage(req.user.profileImage).catch(() => {});
        }

        res.status(200).json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        if (error.message === 'User not found') {
            return res.status(404).json({
                message: error.message
            });
        }

        res.status(error.statusCode || 400).json({
            message: error.message
        });
    }
};

const changeUserPasswordController = async (req, res) => {
    try {
        await changeUserPassword(req.user._id, req.body.currentPassword, req.body.newPassword);
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Could not change your password' });
    }
};

// Worked by Codex: authenticated endpoints send and verify email-change codes.
const sendEmailChangeOtpController = async (req, res) => {
    try {
        await sendEmailChangeOtp(req.user._id, req.body.email);
        res.status(200).json({ message: 'Verification code sent to your new email address' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const verifyEmailChangeOtpController = async (req, res) => {
    try {
        const user = await verifyEmailChangeOtp(req.user._id, req.body.email, req.body.otp);
        res.status(200).json({ message: 'Email updated and verified', email: user.email });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const userLogoutController = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { tokenVersion: 1 }
        });

        clearUserSessionCookie(res);
        res.redirect('/');
    } catch (error) {
        res.status(500).json({
            message: "logout Failed"
        })
    }
};


const googleCallbackController = (req, res) => {
    if (req.user.role !== 'CUSTOMER') return res.redirect('/login');

    const token = jwt.sign({ id: req.user.id, role: req.user.role, tokenVersion: req.user.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: '1d' });


    setUserSessionCookie(res, token);
    res.redirect('/');
    console.log('Google callback reached');
}

export {
    renderHomePageController,
    renderLoginPageController,
    renderSignupPageController,
    renderAboutPageController,
    renderServicesPageController,
    renderProfilePageController,
    renderWalletPageController,
    renderProfileEditPageController,
    renderBookingPageController,
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
    renderBookingDetailsPageController,
    renderBookingHistoryPageController
}
