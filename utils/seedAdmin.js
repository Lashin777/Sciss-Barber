import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/userModel.js';


const seedadmin = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const existingAdmin = await User.findOne({ role: "ADMIN" });
    if (existingAdmin) {
        console.log("Admin already  exists:", existingAdmin.email);
        return
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await User.create({
        name: 'Admin',
        email: 'admin@sciss-barber.com',
        password: hashedPassword,
        role: 'ADMIN',
        isEmailVerified: true
    });
    console.log('Admin created successfully:', admin.email);
}

seedadmin().then(() => mongoose.connection.close());
