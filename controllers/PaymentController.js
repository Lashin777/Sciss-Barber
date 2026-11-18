import { createPaymentOrderService ,verifyPaymentService} from "../services/PaymentService.js";


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


const verifyPaymentController = async (req, res) => {
    try{
    const{razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;


    if(!razorpay_order_id || !razorpay_payment_id || !razorpay_signature){
        return res.status(400).json({
            success:false,
            message:"payment verification details are required"
        });
    }
    

    const result = await verifyPaymentService(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        req.user.id
    )

    return res.status(200).json({
        success:true,
        message:"Payment verified and booking confirmed successfully",
        booking:result.booking,
        payment:result.payment
    });

   }catch(error){
    return res.status(error.statusCode ||500).json({
        success:false,
        message:error.message||"payment verification failed "
    });
   }
};

export{createPaymentOrderController,verifyPaymentController}
