import express, { json, urlencoded } from 'express';

//express
const app = express();


//middleware
app.use(urlencoded({ extended: true }))



export default app


