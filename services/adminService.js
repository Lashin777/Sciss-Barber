import bcrypt from 'bcrypt';
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';


const adminLogin = async (email, password) => {
    const user = await User.findOne({ email });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Invalid admin credentials")
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new Error("Invalid admin credentials");
    }

    const token = jwt.sign(
        { id: user._id, role: user.role },
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


export { adminLogin }