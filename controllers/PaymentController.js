import { createPaymentOrderService,
         verifyPaymentService,
         markPaymentFailedService,
         payWithWalletService
} from "../services/PaymentService.js";

const safePaymentResponse = (payment) => ({
    id: String(payment._id), method: payment.method, status: payment.status,
    amount: payment.amount, currency: payment.currency,
    razorpayOrderId: payment.razorpayOrderId || null,
    razorpayPaymentId: payment.razorpayPaymentId || null
});

const createPaymentOrderController = async(req,res,next)=>{
    try{
        const { bookingId, serviceIds, serviceId } = req.body;
        
        if(!bookingId){
            return res.status(400).json({
                success:false,
                message:"Booking ID is required"
            });
        }


            const order = await createPaymentOrderService(bookingId, serviceIds || serviceId, req.user.id);

            return res.status(200).json({
                success:true,
                message:"Payment order created successfully",
                order:order
            })
        
    }catch(error){
        return next(error);
    }
}


const verifyPaymentController = async (req, res, next) => {
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
        message:"Payment verified successfully",
        booking:result.booking,
        payment:safePaymentResponse(result.payment)
    });

   }catch(error){
    return next(error);
   }
};

const paymentFailedController = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id) {
            return res.status(400).json({ success: false, message: 'Payment failure details are required' });
        }

        const payment = await markPaymentFailedService(
            razorpay_order_id,
            razorpay_payment_id,
            req.user.id
        );
        return res.status(200).json({ success: true, payment: safePaymentResponse(payment) });
    } catch (error) {
        return next(error);
    }
};

const payWithWalletController = async (req, res, next) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required'
            });
        }

        const result = await payWithWalletService(
            bookingId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: 'Wallet payment successful and booking confirmed',
            booking: result.booking,
            payment: safePaymentResponse(result.payment)
        });

    } catch (error) {
        return next(error);
    }
};


export { createPaymentOrderController,
        verifyPaymentController,
        paymentFailedController,
        payWithWalletController
       };
