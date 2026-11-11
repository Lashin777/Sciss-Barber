import mongoose from "mongoose";

const barberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Barber = mongoose.model("Barber", barberSchema);

export default Barber;