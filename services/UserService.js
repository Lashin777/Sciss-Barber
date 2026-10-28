import { hashPassword, comparePassword } from '../utils/passwordUtils.js';
import User from '../models/userModel.js';
import { generateOtp, verifyOtp, resendOtp, consumeOtp } from './otpService.js';
import jwt from 'jsonwebtoken';



const UsersignUp = async (email, name, password, phone) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("User Already Exists");
    } else {
        const hashedPassword = await hashPassword(password);
        const newUser = await User.create({ name, email, password: hashedPassword, phone });
        await generateOtp(email, 'EMAIL_VERIFICATION')
        return newUser;
    }

}

const getPasswordLoginAccount = async (email) => {
    const user = await User.findOne({ email });
    if (!user || user.role !== 'CUSTOMER') {
        throw new Error('No Account With This EMAIL');
    }

    if (user.googleId) {
        throw new Error('This account uses Google sign-in. Manage your password through Google.');
    }
    return user;
}

const forgetPassword = async (email) => {
    await getPasswordLoginAccount(email);
    await generateOtp(email, 'PASSWORD_RESET')
}

const resetPassword = async (email, otp, newpassword) => {
    await getPasswordLoginAccount(email);
    await verifyOtp(email, otp, 'PASSWORD_RESET');
    const hashedPassword = await hashPassword(newpassword);

    await User.updateOne(
        { email },
        {
            $set: { password: hashedPassword },
            $inc: { tokenVersion: 1 }
        }
    );
}


const userLogin = async (email, password) => {
    const user = await User.findOne({ email });


    if (!user || user.role !== 'CUSTOMER') {
        throw new Error("Invalid Email Or Password");
    }
    const ismatch = await comparePassword(password, user.password);
    if (!ismatch) {
        throw new Error("Invalid Email Or Password");
    }
    if (user.status === 'BLOCKED') {
        throw new Error("Your Account Is Blocked");
    }
    if (!user.isEmailVerified) {
        throw new Error("Please Verify Your Email first");
    }


    const token = jwt.sign(
        {
            id: user._id,
            role: user.role,
            tokenVersion: user.tokenVersion

        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    )
    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email
        }
    };
}


const UpdateUserProfile = async (userId, updates) => {
    const fields = {};
    if (typeof updates.name === 'string') {
        fields.name = updates.name.trim();
        fields['addresses.$[].fullName'] = fields.name;
    }

    if (typeof updates.phone === 'string') {
        fields.phone = updates.phone.trim();
        fields['addresses.$[].phone'] = fields.phone;
    }

    if (typeof updates.profileImage === 'string') {
        fields.profileImage = updates.profileImage.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: fields },
        { new: true, runValidators: true, select: '-password' }
    );

    if (!updatedUser) throw new Error('User not found');
    return updatedUser;
}

const changeUserPassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.googleId || !user.password) {
        throw new Error('This account uses Google sign-in and does not have a password to change');
    }

    const currentPasswordMatches = await comparePassword(currentPassword, user.password);
    if (!currentPasswordMatches) throw new Error('Current password is incorrect');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

    const newPasswordMatches = await comparePassword(newPassword, user.password);
    if (newPasswordMatches) throw new Error('Choose a new password different from your current password');

    const hashedPassword = await hashPassword(newPassword);
    await User.updateOne(
        { _id: userId },
        {
            $set: { password: hashedPassword },
            $inc: { tokenVersion: 1 }
        }
    );
};


const sendEmailChangeOtp = async (userId, newEmail) => {
    const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error('Enter a valid email address');
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.email.toLowerCase() === normalizedEmail) throw new Error('This is already your current email');

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) throw new Error('An account already uses this email address');

    await resendOtp(normalizedEmail, 'EMAIL_CHANGE');
};

const verifyEmailChangeOtp = async (userId, newEmail, otp) => {
    const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^\d{6}$/.test(String(otp || ''))) throw new Error('Enter the six-digit code');

    const user = await User.findById(userId);
    if (!user || user.role !== 'CUSTOMER') throw new Error('Customer account not found');
    if (user.email.toLowerCase() === normalizedEmail) throw new Error('This is already your current email');

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) throw new Error('An account already uses this email address');

    await consumeOtp(normalizedEmail, String(otp), 'EMAIL_CHANGE');

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { email: normalizedEmail, isEmailVerified: true } },
            { new: true, runValidators: true, select: '-password' }
        );
        if (!updatedUser) throw new Error('Customer account not found');
        return updatedUser;
    } catch (error) {
        if (error.code === 11000) throw new Error('An account already uses this email address');
        throw error;
    }
};


const addUserAddress = async (userId, addressData) => {
    const user = await User.findById(userId);


    if (!user || user.role !== 'CUSTOMER') {
        throw new Error('customer Account not found')
    }

    const requiredFields = [
        'addressLine',
        'city',
        'state',
        'postalCode'
    ];

    for (const field of requiredFields) {
        if (
            typeof addressData[field] !== 'string' || !addressData[field].trim()
        ) {
            throw new Error(`${field} required`)
        }
    }

    const address = {
        label: addressData.label || 'Home',
        fullName: user.name,
        phone: user.phone,
        addressLine: addressData.addressLine.trim(),
        city: addressData.city.trim(),
        state: addressData.state.trim(),
        postalCode: addressData.postalCode.trim(),
        isDefault: user.addresses.length === 0

    };
    user.addresses.push(address);
    await user.save();


    return user.addresses[user.addresses.length - 1];
}

const getUserAddresses = async (userId) => {
    const user = await User.findOne({
        _id: userId,
        role: 'CUSTOMER'
    }).select('addresses');

    if (!user) {
        throw new Error('Customer account not found');
    }

    return user.addresses;
};

const updateAddress = async (userId, addressId, addressData) => {
    const user = await User.findOne({
        _id: userId,
        role: 'CUSTOMER'
    });

    if (!user) {
        throw new Error("Customer Account not found");
    }


    const address = user.addresses.id(addressId);

    if (!address) {
        throw new Error("Address not found")
    }

    const allowField = [
        'addressLine',
        'city',
        'state',
        'postalCode'
    ];


    for (const field of allowField) {
        if (addressData[field] !== undefined) {
            if (typeof addressData[field] !== 'string' || !addressData[field].trim()) {
                throw new Error(`${field} is required`)
            }
            address[field] = addressData[field].trim()
        }
    }

    if (addressData.label !== undefined && !['Home', 'Work', 'Other'].includes(addressData.label)) {
        throw new Error('Invalid address Label');
    }
    if (addressData.label !== undefined) {
        address.label = addressData.label;
    }

    await user.save();

    return address
}

const deleteAddress = async (userId, addressId) => {
    const user = await User.findOne({
        _id: userId,
        role: 'CUSTOMER'
    });

    if (!user) {
        throw new Error('Customer account not found');
    }

    const address = user.addresses.id(addressId);

    if (!address) {
        throw new Error('Address not found');
    }

    const wasDefault = address.isDefault;

    user.addresses.pull({ _id: addressId });

    if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
    }

    await user.save();

    return user.addresses;
};


const setDefaultAddress = async (userId, addressId) => {
    const user = await User.findOne({
        _id: userId,
        role: 'CUSTOMER'
    });

    if (!user) {
        throw new Error('Customer account not found');
    }

    const address = user.addresses.id(addressId);

    if (!address) {
        throw new Error('Address not found');
    }

    user.addresses.forEach(item => {
        item.isDefault = item._id.equals(address._id);
    });

    await user.save();

    return address;
};
export {
    UsersignUp,
    forgetPassword,
    resetPassword,
    userLogin,
    UpdateUserProfile,
    changeUserPassword,
    sendEmailChangeOtp,
    verifyEmailChangeOtp,
    addUserAddress,
    getUserAddresses,
    updateAddress,
    deleteAddress,
    setDefaultAddress
}
