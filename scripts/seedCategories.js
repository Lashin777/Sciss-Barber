import connectDB from "../config/db.js";
import ServiceCategory from "../models/ServiceCategory.js";



const categories = [
    "01 / HAIR CARE",
    "02 / FACE CARE",
    "03 / FACIALS",
    "04 / HAIR COLOUR",
    "05 / STRAIGHTENING & SMOOTHENING",
    "06 / HAIR SPA & MASSAGE"
];

const seedCategories = async () => {
    try {
        await connectDB();

        for (const name of categories) {
            await ServiceCategory.updateOne({ name },{ $setOnInsert: { name } },{ upsert: true });
        }

        console.log("Categories seeded successfully");
    } catch (error) {
        console.error("Seeding failed:", error.message);
    } finally {
        process.exit();
    }
};

seedCategories();
