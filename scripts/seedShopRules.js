import "dotenv/config";
import connectDB from "../config/db.js";
import ShopRules from "../models/ShopRules.js";
import mongoose from "mongoose";


const seedShopRules = async()=>{
    try{
        await connectDB();

        const existingRules = await ShopRules.findOne();

        if(existingRules){
            console.log("shop Rules Alredy Exist");
            return;
        }

        await ShopRules.create({
            openingTime:"11:00",
            closingTime:"00:00",
            weeklyOff:"TUESDAY",
            maxConcurrentBookings: 2,
            bufferMinutes: 10
        });

        console.log("Shop rules created successfully");

    }catch(error){
        console.error("Error seeding shop rules:", error);
    }
    finally{
        await mongoose.disconnect();
    }
}

seedShopRules();