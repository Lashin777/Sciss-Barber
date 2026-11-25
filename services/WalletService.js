
import Wallet from '../models/WalletModel.js';
import AppError from '../utils/AppError.js';
import WalletTransaction from '../models/WalletTransactionModel.js';
import mongoose from 'mongoose';

const CreateWalletService = async (userId, session = null) => {
    const now = new Date();
    return Wallet.findOneAndUpdate(
        { userId },
        {
            $setOnInsert: {
                userId,
                createdAt: now,
                updatedAt: now
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            timestamps: false,
            ...(session ? { session } : {})
        }
    );
};

const getWalletBalanceService = async (userId) => {
    const wallet = await CreateWalletService(userId);
    return wallet.balance;
};

const getWalletTransactionsService = async (userId, { page = 1, limit = 10 } = {}) => {
    const parsePositiveInteger = (value) => {
        if (typeof value === 'number') return Number.isSafeInteger(value) ? value : NaN;
        if (typeof value !== 'string' || !/^\d+$/.test(value)) return NaN;
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) ? parsed : NaN;
    };
    const currentPage = parsePositiveInteger(page);
    const pageSize = parsePositiveInteger(limit);

    if (!Number.isInteger(currentPage) || currentPage < 1) {
        throw new AppError('page must be a positive integer', 400);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
        throw new AppError('limit must be an integer between 1 and 50', 400);
    }

    const wallet = await CreateWalletService(userId);
    const filter = { walletId: wallet._id };
    const [transactions, total] = await Promise.all([
        WalletTransaction.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize),
        WalletTransaction.countDocuments(filter)
    ]);

    return {
        transactions,
        pagination: {
            page: currentPage,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

const validateTransaction = (amount, reason, referenceId, allowedReasons) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new AppError('Invalid transaction amount',400);
    }

    if (!allowedReasons.includes(reason)) {
        throw new AppError('Invalid transaction reason',400);
    }

    if (!mongoose.isValidObjectId(referenceId)) {
        throw new AppError('Invalid transaction reference',400);
    }
};

const executeWalletTransaction = async (session, operation) => {
    if (session) {
        return operation(session);
    }

    const ownSession = await mongoose.startSession();

    try {
        let result;

        await ownSession.withTransaction(async () => {
            result = await operation(ownSession);
        });

        return result;
    } finally {
        await ownSession.endSession();
    }
};

const throwDuplicateTransactionConflict = (error) => {
    if (error?.code === 11000 && error.keyPattern?.walletId) {
        throw new AppError('This wallet transaction already exists', 409);
    }
    throw error;
};

const creditWalletService = async (
    userId,
    amount,
    reason,
    referenceId,
    session = null
) => {
    validateTransaction(amount, reason, referenceId, ['BOOKING_REFUND', 'REFERRAL_REWARD']);

    try {
        return await executeWalletTransaction(session, async (activeSession) => {
            const wallet = await CreateWalletService(userId, activeSession);

            const existingTransaction = await WalletTransaction.findOne({
                walletId: wallet._id,
                type: 'CREDIT',
                reason,
                referenceId
            }).session(activeSession);

            if (existingTransaction) {
                throw new AppError('This wallet transaction already exists', 409);
            }

            const updatedWallet = await Wallet.findOneAndUpdate(
                { _id: wallet._id },
                { $inc: { balance: amount } },
                { new: true, session: activeSession, runValidators: true }
            );
            if (!updatedWallet) throw new AppError('Wallet not found', 404);

            const createdTransactions = await WalletTransaction.create([{
                walletId: updatedWallet._id,
                type: 'CREDIT',
                amount,
                reason,
                referenceId,
                balanceAfter: updatedWallet.balance
            }], { session: activeSession });

            return createdTransactions[0];
        });
    } catch (error) {
        throwDuplicateTransactionConflict(error);
    }
};

const debitWalletService = async (
    userId,
    amount,
    reason,
    referenceId,
    session = null
) => {
    validateTransaction(amount, reason, referenceId, ['BOOKING_PAYMENT']);

    try {
        return await executeWalletTransaction(session, async (activeSession) => {
            const wallet = await CreateWalletService(userId, activeSession);

            const existingTransaction = await WalletTransaction.findOne({
                walletId: wallet._id,
                type: 'DEBIT',
                reason,
                referenceId
            }).session(activeSession);

            if (existingTransaction) {
                throw new AppError('This wallet transaction already exists', 409);
            }

            const updatedWallet = await Wallet.findOneAndUpdate(
                { _id: wallet._id, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true, session: activeSession, runValidators: true }
            );
            if (!updatedWallet) throw new AppError('Insufficient wallet balance', 400);

            const createdTransactions = await WalletTransaction.create([{
                walletId: updatedWallet._id,
                type: 'DEBIT',
                amount,
                reason,
                referenceId,
                balanceAfter: updatedWallet.balance
            }], { session: activeSession });

            return createdTransactions[0];
        });
    } catch (error) {
        throwDuplicateTransactionConflict(error);
    }
};

export {
    CreateWalletService,
    getWalletBalanceService,
    getWalletTransactionsService,
    creditWalletService,
    debitWalletService
};
