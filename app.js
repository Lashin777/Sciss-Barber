import 'dotenv/config';
import express from 'express';
import UserRoutes from './routes/UserRoute.js';
import adminRoutes from './routes/adminRoute.js'
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import passport from 'passport';;
import './config/passport.js'
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'pug')

//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser())
app.use(passport.initialize())

//routes
app.use('/api/user', UserRoutes)
app.use('/api/admin', adminRoutes)

export default app