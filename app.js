import 'dotenv/config';
import express from 'express';
import UserRoutes from './routes/UserRoute.js';
import adminRoutes from './routes/adminRoute.js';
import serviceRoutes from'./routes/serviceRoute.js';
import BarberUnavailabilityRoutes from'./routes/BarberUnavailabilityRoute.js';
import BookingRoutes from './routes/BookingRoute.js';
import PaymentRoutes from'./routes/PaymentRoute.js';
import notFoundMiddleware from './middlewares/notFoundMiddleware.js';
import AdminBookingRoutes from './routes/AdminBookingRoute.js';
import WalletRoutes from './routes/WalletRoute.js';
import ShopAvailabilityRoutes from './routes/ShopAvailabilityRoute.js';
import errorMiddleware from './middlewares/errorMiddleware.js';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import passport from 'passport';
import './config/passport.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    next();
});

app.set('view engine', 'pug')

//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser())
app.use(passport.initialize())


app.use(UserRoutes);
app.use(adminRoutes);
app.use(serviceRoutes);
app.use(BarberUnavailabilityRoutes);
app.use(BookingRoutes);
app.use(AdminBookingRoutes);
app.use(PaymentRoutes);
app.use(WalletRoutes)
app.use(ShopAvailabilityRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);


export default app
