import { addBarberUnavailabilityService,
        getBarberUnavailabilityService
 } from "../services/BarberUnavailabilityService.js";


 const addBarberUnavailabilityController = async(req,res)=>{
    try{
        const {barberId,startTime,endTime,reason}= req.body;


        const unavailability = await addBarberUnavailabilityService(
            barberId,
            startTime,
            endTime,
            reason
        )

        return res.status(201).json({
            success:true,
            message:"barber unavailability added successfuly ",
            data:unavailability
        });

    }catch(error){
        return res.status(400).json({
            success:false,
            message:error.message
        })
    }
 }

 const getBarberUnavailabilityController = async (req, res) => {
    try{
        const {startTime,endTime} = req.query;

        const unavailability = await getBarberUnavailabilityService(
            startTime,
            endTime
        )

        return res.status(200).json({
            success:true,
            message:"Barber unavailability fetched successfully",
            data:unavailability
        })
    }catch(error){
         return res.status(400).json({
            success:false,
            message:error.message,
        })
    }
};


export{addBarberUnavailabilityController,getBarberUnavailabilityController}