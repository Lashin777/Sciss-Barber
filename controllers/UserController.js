import UsersignUp from '../services/UserService.js';
import { verifyOtp, resendOtp } from '../services/otpService.js';

const UsersignUpController = async (req, res) => {
    try {
        const newUser = await UsersignUp(req.body.email, req.body.name, req.body.password)
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
export { UsersignUpController, verifyOtpController, resendOtpController }