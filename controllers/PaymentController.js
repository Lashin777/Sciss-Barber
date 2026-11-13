import { createPaymentOrderService } from "../services/PaymentService.js";


const createPaymentOrderController = async(req,res)=>{
    try{
        const {bookingId,serviceId} = req.body ;
        
        if(!bookingId||!serviceId){
            return res.status(400).json({
                success:false,
                message:"Booking ID and Service ID are required"
            });
        }


            const order = await createPaymentOrderService(bookingId,serviceId,req.user.id);

            return res.status(200).json({
                success:true,
                message:"Payment order created successfully",
                order:order
            })
        
    }catch(error){
        return res.status(500).json({
            success:false,
            message:error.message||"Failed To Create  Payment order",
            
        })
    }
}

export{createPaymentOrderController}
