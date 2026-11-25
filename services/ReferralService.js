import Referral from '../models/ReferralModel.js';
import User from '../models/userModel.js';
import AppError from '../utils/AppError.js';
import { creditWalletService } from './WalletService.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rewardReferralOnFirstBookingService = async (referredUserId, session) => {
    const referral = await Referral.findOne({
        referredUserId,
        rewardStatus: 'PENDING_POLICY'
    }).session(session);

    if (!referral) return null;

    const walletTransaction = await creditWalletService(
        referral.referrerId,
        50,
        'REFERRAL_REWARD',
        referral._id,
        session
    );

    const updatedReferral = await Referral.findOneAndUpdate(
        { _id: referral._id, rewardStatus: 'PENDING_POLICY' },
        {
            $set: {
                rewardStatus: 'REWARDED',
                rewardAmount: 50,
                walletTransactionId: walletTransaction._id
            }
        },
        { new: true, runValidators: true, session }
    );

    if (!updatedReferral) {
        throw new AppError('Referral reward status changed before it could be recorded', 409);
    }

    return updatedReferral;
};

const getUserReferralsService = async (userId) => Referral.find({ referrerId: userId })
    .populate('referredUserId', 'name email')
    .sort({ createdAt: -1, _id: -1 })
    .lean();

const getAdminReferralsService = async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
    const currentPage = Number(page);
    const pageSize = Number(limit);
    if (!Number.isInteger(currentPage) || currentPage < 1) {
        throw new AppError('page must be a positive integer', 400);
    }
    if (![10, 25, 50].includes(pageSize)) {
        throw new AppError('limit must be 10, 25, or 50', 400);
    }
    if (typeof search !== 'string' || search.length > 100) {
        throw new AppError('search must be 100 characters or fewer', 400);
    }
    if (status && !['PENDING_POLICY', 'REWARDED'].includes(status)) {
        throw new AppError('status must be PENDING_POLICY or REWARDED', 400);
    }

    const filter = {};
    if (status) filter.rewardStatus = status;
    const escapedSearch = escapeRegExp(search.trim());
    if (escapedSearch) {
        const matchingUsers = await User.find({
            $or: [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { email: { $regex: escapedSearch, $options: 'i' } },
                { phone: { $regex: escapedSearch, $options: 'i' } }
            ]
        }).select('_id').lean();
        const matchingUserIds = matchingUsers.map((user) => user._id);
        filter.$or = [
            { referralCode: { $regex: escapedSearch, $options: 'i' } },
            { referrerId: { $in: matchingUserIds } },
            { referredUserId: { $in: matchingUserIds } }
        ];
    }

    const [totalReferrals, rewardPending, rewardsIssued, rewardTotals, filteredCount, referrals] = await Promise.all([
        Referral.countDocuments(),
        Referral.countDocuments({ rewardStatus: 'PENDING_POLICY' }),
        Referral.countDocuments({ rewardStatus: 'REWARDED' }),
        Referral.aggregate([
            { $match: { rewardStatus: 'REWARDED' } },
            { $group: { _id: null, amount: { $sum: '$rewardAmount' } } }
        ]),
        Referral.countDocuments(filter),
        Referral.find(filter)
            .populate('referrerId', 'name email phone referralCode')
            .populate('referredUserId', 'name email phone')
            .sort({ createdAt: -1, _id: -1 })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .lean()
    ]);

    return {
        summary: {
            totalReferrals,
            verifiedSignups: totalReferrals,
            rewardPolicyPending: rewardPending,
            rewardsIssued,
            rewardAmountIssued: rewardTotals[0]?.amount || 0
        },
        referrals,
        pagination: {
            page: currentPage,
            limit: pageSize,
            total: filteredCount,
            totalPages: Math.ceil(filteredCount / pageSize)
        }
    };
};

export { getAdminReferralsService, getUserReferralsService, rewardReferralOnFirstBookingService };
