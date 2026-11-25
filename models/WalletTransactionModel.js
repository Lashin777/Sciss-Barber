import mongoose from 'mongoose';


const walletTransactionSchema = new mongoose.Schema({
walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
},
type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'],
    required: true
},
amount: {
    type: Number,
    required: true,
    min: 1
},
reason: {
    type: String,
    enum: ['BOOKING_REFUND', 'BOOKING_PAYMENT', 'REFERRAL_REWARD'],
    required: true
},
referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
},
balanceAfter: {
    type: Number,
    required: true,
    min: 0
},
},{timestamps:true});

walletTransactionSchema.index(
    { walletId: 1, type: 1, reason: 1, referenceId: 1 },
    { unique: true }
);

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
