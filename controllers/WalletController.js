import {
    getWalletBalanceService,
    getWalletTransactionsService,
} from "../services/WalletService.js";


const getWalletBalanceController = async (req, res, next) => {
    try {
        const balance = await getWalletBalanceService(req.user._id);

        return res.status(200).json({
            success: true,
            balance
        });
    } catch (error) {
        return next(error);
    }
};


const getWalletTransactionsController = async (req, res, next) => {
    try {
        const result = await getWalletTransactionsService(req.user._id, {
            page: req.query.page === undefined ? 1 : req.query.page,
            limit: req.query.limit === undefined ? 10 : req.query.limit
        });

        return res.status(200).json({
            success: true,
            transactions: result.transactions,
            pagination: result.pagination
        });
    } catch (error) {
        return next(error);
    }
};






export{
    getWalletBalanceController,
    getWalletTransactionsController
}
