import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceCategory",
        required: true
    },

    description: {
        type: String,
        trim: true,
        default: ""
    },


    price: {
        type: Number,
        required: true,
        min: 0
    },

    duration: {
        type: Number,
        required: true,
        min: 1
    },
    isActive: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });


const Service = mongoose.model("Service", serviceSchema);

export default Service;