import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import generateOtp from './otpService.js';



const UsersignUp = async (email, name, password) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error("User Already Exists");
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword });
        await generateOtp(email, 'EMAIL_VERIFICATION')
        return newUser;
    }

}
export default UsersignUp