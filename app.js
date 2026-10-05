import express from 'express';
import authRoutes from './routes/UserRoute.js';
import path from 'path';
import { fileURLToPath } from 'url';

//express
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));


//View engine
app.set('view engine', 'pug')

//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')))

//app
app.use('/api/auth', authRoutes);
app.get('/signup', (req, res) => {
    res.render('user/signup', { title: 'sign UP' })
})


export default app