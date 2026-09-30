import express from 'express';
import authRoutes from './routes/authRoute.js';

//express
const app = express();


//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


//app
app.use('/api/auth', authRoutes);


export default app