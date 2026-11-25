import 'dotenv/config';
import connectDB from './config/db.js';
import app from './app.js';
import { verifyEmailConnection } from './services/emailService.js';
import { startBookingExpiryScheduler } from './services/BookingExpiryService.js';

const startServer = async () => {
    try {
        await connectDB();
        startBookingExpiryScheduler();

        try {
            await verifyEmailConnection();
            console.log("SMTP connection verified");
        } catch (error) {
            console.error("SMTP connection failed:", error.message);
        }

        app.listen(process.env.PORT, () => {
            console.log("Server is running");
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();
