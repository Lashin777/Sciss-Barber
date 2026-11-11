import mongoose from "mongoose";
import "dotenv/config";
import connectDB from "../config/db.js";
import Barber from "../models/Barber.js";

const seedBarbers = async () => {
    try{
        await connectDB();

        const existingBarbers = await Barber.find();

        if(existingBarbers.length>0){
            console.log("Barber Already exist ");
            return;
        }

        const barbers = [
        { name: "Barber 1" },
        { name: "Barber 2" },
        { name: "Barber 3" }
    ];

        await Barber.insertMany(barbers);

        console.log("Three barbers created successfully");
    }catch(error){
            console.error("Error seeding barbers:", error);
    }finally {
        await mongoose.disconnect();
    }
};

seedBarbers();