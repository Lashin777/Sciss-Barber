import express from 'express';
import UserRoutes from './routes/UserRoute.js';
import adminRoutes from './routes/adminRoute.js'
import path from 'path';
import { fileURLToPath } from 'url';

//express
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));


//View engine
app.set('view engine', 'pug')

//middleware
http://localhost:3007/api/auth/resend-otpr', UserRoutes);
app.use('/api/admin', adminRoutes)


export default app