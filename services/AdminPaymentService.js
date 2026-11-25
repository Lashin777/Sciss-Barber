import Payment from '../models/PaymentModel.js';
import Booking from '../models/bookingModel.js';
import User from '../models/userModel.js';
import Service from '../models/Service.js';
import AppError from '../utils/AppError.js';

const INDIA_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const parseIndiaDate = (value, fieldName) => {
    if (value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppError(`${fieldName} must use YYYY-MM-DD format`, 400);
    }

    const [year, month, day] = value.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
    ) {
        throw new AppError(`${fieldName} must be a valid date`, 400);
    }

    return {
        value,
        start: new Date(Date.UTC(year, month - 1, day) - INDIA_OFFSET_MS)
    };
};

const getPaymentDateFilter = (from, to) => {
    const fromDate = parseIndiaDate(from, 'from');
    const toDate = parseIndiaDate(to, 'to');
    if (fromDate && toDate && fromDate.value > toDate.value) {
        throw new AppError('from must be on or before to', 400);
    }

    const createdAt = {};
    if (fromDate) createdAt.$gte = fromDate.start;
    if (toDate) createdAt.$lt = new Date(toDate.start.getTime() + DAY_MS);

    return {
        filter: Object.keys(createdAt).length ? { createdAt } : {},
        range: {
            from: fromDate?.value || null,
            to: toDate?.value || null,
            timezone: 'Asia/Kolkata'
        }
    };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdminPaymentsService = async ({
    from,
    to,
    page = 1,
    limit = 10,
    search = '',
    method = '',
    status = ''
} = {}) => {
    const { filter: dateFilter, range } = getPaymentDateFilter(from, to);
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
    if (method && !['RAZORPAY', 'WALLET'].includes(method)) {
        throw new AppError('method must be RAZORPAY or WALLET', 400);
    }
    if (status && !['CREATING', 'PENDING', 'SUCCESS', 'FAILED'].includes(status)) {
        throw new AppError('status must be CREATING, PENDING, SUCCESS, or FAILED', 400);
    }

    const [summaryResult] = await Payment.aggregate([
        { $match: dateFilter },
        {
            $facet: {
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalPayments: { $sum: 1 },
                            totalAmount: { $sum: '$amount' },
                            successfulPayments: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
                            pendingPayments: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
                            failedPayments: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
                            creatingPayments: { $sum: { $cond: [{ $eq: ['$status', 'CREATING'] }, 1, 0] } },
                            successfulAmount: {
                                $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] }
                            }
                        }
                    }
                ],
                methods: [
                    {
                        $group: {
                            _id: '$method',
                            payments: { $sum: 1 },
                            amount: { $sum: '$amount' },
                            successfulPayments: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
                            successfulAmount: {
                                $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] }
                            }
                        }
                    }
                ]
            }
        }
    ]);

    const totals = summaryResult?.totals?.[0] || {
        totalPayments: 0,
        totalAmount: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        creatingPayments: 0,
        successfulAmount: 0
    };
    const methodTotals = Object.fromEntries((summaryResult?.methods || []).map((item) => [item._id, {
        payments: item.payments,
        amount: item.amount,
        successfulPayments: item.successfulPayments,
        successfulAmount: item.successfulAmount
    }]));

    const recordMatch = { ...dateFilter };
    if (method) recordMatch.method = method;
    if (status) recordMatch.status = status;
    const escapedSearch = escapeRegExp(search.trim());

    const recordsPipeline = [
        { $match: recordMatch },
        {
            $lookup: {
                from: Booking.collection.name,
                localField: 'bookingId',
                foreignField: '_id',
                as: 'booking'
            }
        },
        { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: User.collection.name,
                localField: 'userId',
                foreignField: '_id',
                as: 'customer'
            }
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                _bookingServiceIds: {
                    $cond: [
                        { $gt: [{ $size: { $ifNull: ['$booking.serviceIds', []] } }, 0] },
                        '$booking.serviceIds',
                        ['$booking.serviceId']
                    ]
                },
                _paymentIdText: { $toString: '$_id' },
                _bookingIdText: { $toString: '$booking._id' }
            }
        },
        {
            $lookup: {
                from: Service.collection.name,
                localField: '_bookingServiceIds',
                foreignField: '_id',
                as: 'bookingServices'
            }
        },
        ...(escapedSearch ? [{
            $match: {
                $or: [
                    { _paymentIdText: { $regex: escapedSearch, $options: 'i' } },
                    { _bookingIdText: { $regex: escapedSearch, $options: 'i' } },
                    { 'booking.bookingToken': { $regex: escapedSearch, $options: 'i' } },
                    { 'customer.name': { $regex: escapedSearch, $options: 'i' } },
                    { 'customer.email': { $regex: escapedSearch, $options: 'i' } },
                    { 'customer.phone': { $regex: escapedSearch, $options: 'i' } }
                ]
            }
        }] : []),
        {
            $facet: {
                records: [
                    { $sort: { createdAt: -1, _id: -1 } },
                    { $skip: (currentPage - 1) * pageSize },
                    { $limit: pageSize },
                    {
                        $project: {
                            _id: 1,
                            amount: 1,
                            currency: 1,
                            method: 1,
                            status: 1,
                            createdAt: 1,
                            customer: {
                                name: '$customer.name',
                                email: '$customer.email',
                                phone: '$customer.phone'
                            },
                            booking: {
                                id: '$booking._id',
                                token: '$booking.bookingToken',
                                status: '$booking.status',
                                appointmentDate: '$booking.appointmentDate',
                                appointmentStart: '$booking.appointmentStart',
                                appointmentEnd: '$booking.appointmentEnd',
                                servicePrice: '$booking.servicePrice',
                                serviceDuration: '$booking.serviceDuration',
                                services: {
                                    $map: {
                                        input: '$bookingServices',
                                        as: 'service',
                                        in: '$$service.name'
                                    }
                                }
                            }
                        }
                    }
                ],
                metadata: [{ $count: 'total' }]
            }
        }
    ];

    const [recordsResult] = await Payment.aggregate(recordsPipeline);
    const payments = recordsResult?.records || [];
    const total = recordsResult?.metadata?.[0]?.total || 0;

    return {
        range,
        summary: {
            ...totals,
            totalAmount: Number(totals.totalAmount || 0),
            successfulAmount: Number(totals.successfulAmount || 0),
            methods: {
                RAZORPAY: methodTotals.RAZORPAY || { payments: 0, amount: 0, successfulPayments: 0, successfulAmount: 0 },
                WALLET: methodTotals.WALLET || { payments: 0, amount: 0, successfulPayments: 0, successfulAmount: 0 }
            }
        },
        payments,
        pagination: {
            page: currentPage,
            limit: pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

export { getAdminPaymentsService };
