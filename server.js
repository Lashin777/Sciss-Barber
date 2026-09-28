import 'dotenv/config';
import connectDB from './config/db.js';
import app from './app.js';


// Connect to MongoDB
connectDB();



app.listen(process.env.PORT, () => {
    console.log("server is ON!!!!!!!!!!!")
})