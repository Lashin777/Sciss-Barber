import mongoose from "mongoose";

const walkInSchema = mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    phone:{
        type:String,
        required:true,
        trim:true,
        unique:true
    }
},{timestamps:true});


const walkInCustomer = mongoose.model('walkInCustomer',walkInSchema);

export default walkInCustomer;