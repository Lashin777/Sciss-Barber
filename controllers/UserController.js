import User from '../models/userModel.js';
import { UsersignUp, forgetPassword, resetPassword, userLogin, UpdateUserProfile, changeUserPassword, sendEmailChangeOtp, verifyEmailChangeOtp, addUserAddress, getUserAddresses, updateAddress, deleteAddress, setDefaultAddress } from '../services/UserService.js';
import { verifyOtp, resendOtp } from '../services/otpService.js';
import jwt from 'jsonwebtoken'
import { setUserSessionCookie, clearUserSessionCookie } from '../utils/session.js';

// Worked by Codex: keep customer page response logic in controllers.
const renderHomePageController = (req, res) => {
    res.render('user/home', { title: 'Home', isLoggedIn: Boolean(req.user) });
};

const renderLoginPageController = (req, res) => res.render('user/login', { title: 'Login' });
const renderSignupPageController = (req, res) => res.render('user/signup', { title: 'signUp' });
const renderAboutPageController = (req, res) => res.render('user/about', { title: 'About' });
const renderServicesPageController = (req, res) => res.render('user/services', { title: 'Services & Prices' });
const renderBookingPageController = (req, res) => res.render('user/booking', { title: 'Book an appointment' });

const renderProfilePageController = (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('user/profile', { title: 'Your Profile', user: req.user });
};

const renderProfileEditPageController = (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.render('user/profile-edit', { title: 'Edit Profile', user: req.user });
};

const UsersignUpController = async (req, res) => {
    try {
        const newUser = await UsersignUp(req.body.email, req.body.name, req.body.password, req.body.phone)
        res.status(201).json({
            message: "signUp succesful",
            userId: newUser._id
        });

    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const verifyOtpController = async (req, res) => {
    try {
        await verifyOtp(req.body.email, req.body.otp, req.body.purpose);
        res.status(200).json({ message: "Email verifiead successfuly" });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
}

const resendOtpController = async (req, res) => {
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
    try {
        const updatedData = {};

        if (typeof req.body.name === 'string' && req.body.name.trim() !== '') {
            updatedData.name = req.body.name.trim();
        }

        if (typeof req.body.phone === 'string' && req.body.phone.trim() !== '') {
            updatedData.phone = req.body.phone.trim();
        }

        if (req.file) {
            updatedData.profileImage = `/uploads/${req.file.filename}`;
        }

        const updatedUser = await UpdateUserProfile(
            req.user._id,
            updatedData
        );

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

        res.status(400).json({
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

const userLogoutController = (req, res) => {
    // Worked by Codex: end the customer session by clearing its HTTP-only cookie.
    clearUserSessionCookie(res);
    res.redirect('/');
};


const googleCallbackController = (req, res) => {
    if (req.user.role !== 'CUSTOMER') return res.redirect('/login');

    const token = jwt.sign({ id: req.user.id, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' });

    // Worked by Codex: issue the same customer session cookie used by password login.
    setUserSessionCookie(res, token);
    res.redirect('/');
    console.log('Google callback reached');
}

const addAddressController = async (req, res) => {
    try {

        const address = await addUserAddress(req.user._id, req.body);

        res.status(201).json({
            message: "Address added succssfully",
            address
        });
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
};


const getUserAddressesController = async (req, res) => {
    try {
        const addresses = await getUserAddresses(req.user._id);

        res.status(201).json({ addresses })
    } catch (error) {
        res.status(400).json({
            message: error.message
        })
    }
};


const updateAddressController = async (req, res) => {
    try {
        const address = await updateAddress(req.user._id, req.params.addressId, req.body);

        res.status(201).json({
            message: "Address Updated Succssfully",
            address
        });
    } catch (error) {
        const status = error.message === 'Address not found' ? 404 : 400;
        res.status(status).json({ message: error.message })
    }
}


const deleteAddressController = async (req, res) => {
    try {
        const address = await deleteAddress(req.user._id, req.params.addressId);
        res.status(201).json({
            message: "Address Deleted Successfully",
            address
        })
    } catch (error) {
        res.status(400).json({
            message: error.message
        })
    }
}

const setDefaultAddressController = async (req, res) => {
    try {
        const address = await setDefaultAddress(req.user._id, req.params.addressId);
        res.status(201).json({
            message: "Default Address Updated Succssfully",
            address
        })
    } catch (error) {
        res.status(400).json({
            message: error.message
        })
    }
}

export {
    renderHomePageController,
    renderLoginPageController,
    renderSignupPageController,
    renderAboutPageController,
    renderServicesPageController,
    renderProfilePageController,
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
    addAddressController,
    getUserAddressesController,
    updateAddressController,
    deleteAddressController,
    setDefaultAddressController
}
