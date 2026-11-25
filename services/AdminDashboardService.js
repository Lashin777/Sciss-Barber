import Booking from '../models/bookingModel.js';
import ShopRules from '../models/ShopRules.js';
import Payment from '../models/PaymentModel.js';
import WalletTransaction from '../models/WalletTransactionModel.js';
import User from '../models/userModel.js';
import AppError from '../utils/AppError.js';
import ShopAvailability from '../models/shopAvailabilityModel.js';
import BarberUnavailability from '../models/barberUnavailabilityModel.js';

const INDIA_OFFSET_MS = 330 * 60 * 1000;

const indiaDateStart = (year, month, day) =>
    new Date(Date.UTC(year, month - 1, day) - INDIA_OFFSET_MS);

const getIndiaTodayRange = (date = new Date()) => {
    const indiaDate = new Date(date.getTime() + INDIA_OFFSET_MS);
    const start = indiaDateStart(
        indiaDate.getUTCFullYear(),
        indiaDate.getUTCMonth() + 1,
        indiaDate.getUTCDate()
    );
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

const parseIndiaDate = (value, fieldName) => {
    if (value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new AppError(`${fieldName} must use YYYY-MM-DD format`, 400);
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new AppError(`${fieldName} must be a valid date`, 400);
    }
    return { value, start: indiaDateStart(year, month, day) };
};

const buildDateFilter = (from, to) => {
    const startDate = parseIndiaDate(from, 'from');
    const endDate = parseIndiaDate(to, 'to');
    if (startDate && endDate && startDate.value > endDate.value) {
        throw new AppError('from must be on or before to', 400);
    }

    const createdAt = {};
    if (startDate) createdAt.$gte = startDate.start;
    if (endDate) createdAt.$lt = new Date(endDate.start.getTime() + 24 * 60 * 60 * 1000);
    return {
        filter: Object.keys(createdAt).length ? { createdAt } : {},
        range: {
            from: startDate?.value || null,
            to: endDate?.value || null,
            timezone: 'Asia/Kolkata'
        }
    };
};

const getPaymentTotals = async (dateFilter) => {
    const [totals] = await Payment.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: null,
                paymentRecords: { $sum: 1 },
                successfulPayments: {
                    $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
                },
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$status', 'SUCCESS'] }, { $eq: ['$method', 'RAZORPAY'] }] },
                            '$amount',
                            0
                        ]
                    }
                },
                totalBookingSales: {
                    $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] }
                },
                onlinePaymentRevenue: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$status', 'SUCCESS'] }, { $eq: ['$method', 'RAZORPAY'] }] },
                            '$amount',
                            0
                        ]
                    }
                },
                walletPaymentRevenue: {
                    $sum: {
                        $cond: [
                            { $and: [{ $eq: ['$status', 'SUCCESS'] }, { $eq: ['$method', 'WALLET'] }] },
                            '$amount',
                            0
                        ]
                    }
                }
            }
        }
    ]);
    return totals || {
        paymentRecords: 0,
        successfulPayments: 0,
        totalRevenue: 0,
        totalBookingSales: 0,
        onlinePaymentRevenue: 0,
        walletPaymentRevenue: 0
    };
};

const buildRevenueChartData = async ({ view, from, to, now = new Date() }) => {
    const selectedDate = to || from;
    const selectedParts = selectedDate
        ? selectedDate.split('-').map(Number)
        : (() => {
            const indiaDate = new Date(now.getTime() + INDIA_OFFSET_MS);
            return [indiaDate.getUTCFullYear(), indiaDate.getUTCMonth() + 1, indiaDate.getUTCDate()];
        })();
    const [selectedYear, selectedMonth, selectedDay] = selectedParts;
    let periodStart;
    let periodEnd;
    let keys;
    let periodLabel;
    let format;

    if (view === 'weekly') {
        const selectedUtcDate = new Date(Date.UTC(selectedYear, selectedMonth - 1, selectedDay));
        const daysSinceMonday = (selectedUtcDate.getUTCDay() + 6) % 7;
        const monday = new Date(selectedUtcDate.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
        periodStart = indiaDateStart(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
        periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        keys = Array.from({ length: 7 }, (_, index) => {
            const indiaDate = new Date(periodStart.getTime() + index * 24 * 60 * 60 * 1000 + INDIA_OFFSET_MS);
            return `${indiaDate.getUTCFullYear()}-${String(indiaDate.getUTCMonth() + 1).padStart(2, '0')}-${String(indiaDate.getUTCDate()).padStart(2, '0')}`;
        });
        format = '%Y-%m-%d';
        const startLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(periodStart);
        const endLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(periodEnd.getTime() - 1));
        periodLabel = `${startLabel} – ${endLabel}`;
    } else if (view === 'monthly') {
        periodStart = indiaDateStart(selectedYear, selectedMonth, 1);
        periodEnd = indiaDateStart(selectedMonth === 12 ? selectedYear + 1 : selectedYear, selectedMonth === 12 ? 1 : selectedMonth + 1, 1);
        const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
        keys = Array.from({ length: daysInMonth }, (_, index) => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
        format = '%Y-%m-%d';
        periodLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(periodStart);
    } else {
        periodStart = indiaDateStart(selectedYear, 1, 1);
        periodEnd = indiaDateStart(selectedYear + 1, 1, 1);
        keys = Array.from({ length: 12 }, (_, index) => `${selectedYear}-${String(index + 1).padStart(2, '0')}`);
        format = '%Y-%m';
        periodLabel = String(selectedYear);
    }

    const fromDate = parseIndiaDate(from, 'from');
    const toDate = parseIndiaDate(to, 'to');
    const matchStart = fromDate && fromDate.start > periodStart ? fromDate.start : periodStart;
    const toExclusive = toDate ? new Date(toDate.start.getTime() + 24 * 60 * 60 * 1000) : null;
    const matchEnd = toExclusive && toExclusive < periodEnd ? toExclusive : periodEnd;
    const groupedPayments = await Payment.aggregate([
        {
            $match: {
                status: 'SUCCESS',
                method: 'RAZORPAY',
                createdAt: { $gte: matchStart, $lt: matchEnd }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format,
                        date: '$createdAt',
                        timezone: 'Asia/Kolkata'
                    }
                },
                amount: { $sum: '$amount' },
                payments: { $sum: 1 }
            }
        }
    ]);
    const amountByPeriod = new Map(groupedPayments.map((payment) => [payment._id, payment]));
    const points = keys.map((key) => {
        const payment = amountByPeriod.get(key);
        return { key, amount: payment?.amount || 0, payments: payment?.payments || 0 };
    });

    return {
        view,
        periodLabel,
        points,
        hasPayments: points.some((point) => point.payments > 0)
    };
};

const getAdminRevenueReport = async ({
    from,
    to,
    page = 1,
    limit = 10,
    search = '',
    method = '',
    chartView = 'monthly'
} = {}) => {
    const { filter: dateFilter, range } = buildDateFilter(from, to);
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        throw new AppError('page must be a positive integer', 400);
    }
    if (![10, 25, 50].includes(parsedLimit)) {
        throw new AppError('limit must be 10, 25, or 50', 400);
    }
    if (typeof search !== 'string' || search.length > 100) {
        throw new AppError('search must be 100 characters or fewer', 400);
    }
    if (method && !['RAZORPAY', 'WALLET'].includes(method)) {
        throw new AppError('method must be RAZORPAY or WALLET', 400);
    }
    if (!['weekly', 'monthly', 'yearly'].includes(chartView)) {
        throw new AppError('chartView must be weekly, monthly, or yearly', 400);
    }

    const now = new Date();
    const { start: todayStart, end: todayEnd } = getIndiaTodayRange(now);
    const indiaNow = new Date(now.getTime() + INDIA_OFFSET_MS);
    const daysSinceMonday = (indiaNow.getUTCDay() + 6) % 7;
    const weekStart = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    const monthStart = indiaDateStart(indiaNow.getUTCFullYear(), indiaNow.getUTCMonth() + 1, 1);

    const [selectedTotals, todayTotals, weekTotals, monthTotals, bookingStatusCounts, refundTotals] = await Promise.all([
        getPaymentTotals(dateFilter),
        getPaymentTotals({ status: 'SUCCESS', createdAt: { $gte: todayStart, $lt: todayEnd } }),
        getPaymentTotals({ status: 'SUCCESS', createdAt: { $gte: weekStart, $lt: todayEnd } }),
        getPaymentTotals({ status: 'SUCCESS', createdAt: { $gte: monthStart, $lt: todayEnd } }),
        Booking.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        WalletTransaction.aggregate([
            {
                $match: {
                    ...dateFilter,
                    type: 'CREDIT',
                    reason: 'BOOKING_REFUND'
                }
            },
            { $group: { _id: null, totalRefundedAmount: { $sum: '$amount' }, refunds: { $sum: 1 } } }
        ])
    ]);

    const statusCounts = Object.fromEntries(bookingStatusCounts.map(({ _id, count }) => [_id, count]));
    const refundSummary = refundTotals[0] || { totalRefundedAmount: 0, refunds: 0 };

    const [dailyRevenue, chartData] = await Promise.all([
        Payment.aggregate([
            { $match: { ...dateFilter, status: 'SUCCESS', method: 'RAZORPAY' } },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                            timezone: 'Asia/Kolkata'
                        }
                    },
                    amount: { $sum: '$amount' },
                    payments: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        buildRevenueChartData({ view: chartView, from, to, now })
    ]);

    const paymentMatch = { ...dateFilter };
    if (method) paymentMatch.method = method;
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const transactionPipeline = [
        { $match: paymentMatch },
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
        ...(escapedSearch ? [{
            $match: {
                $or: [
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
                    { $skip: (parsedPage - 1) * parsedLimit },
                    { $limit: parsedLimit },
                    {
                        $project: {
                            _id: 1,
                            amount: 1,
                            currency: 1,
                            method: 1,
                            status: 1,
                            createdAt: 1,
                            booking: { bookingId: '$booking._id', bookingToken: '$booking.bookingToken' },
                            customer: { name: '$customer.name', email: '$customer.email', phone: '$customer.phone' }
                        }
                    }
                ],
                metadata: [{ $count: 'total' }]
            }
        }
    ];

    const [transactionResult] = await Payment.aggregate(transactionPipeline);
    const transactions = transactionResult?.records || [];
    const totalTransactions = transactionResult?.metadata?.[0]?.total || 0;
    const totalPages = Math.ceil(totalTransactions / parsedLimit);

    return {
        range,
        summary: {
            totalRevenue: selectedTotals.totalRevenue,
            totalBookingSales: selectedTotals.totalBookingSales,
            totalBookings: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
            completedBookings: statusCounts.COMPLETED || 0,
            cancelledBookings: statusCounts.CANCELLED || 0,
            totalRefundedAmount: refundSummary.totalRefundedAmount,
            refundCount: refundSummary.refunds,
            onlinePaymentRevenue: selectedTotals.onlinePaymentRevenue,
            walletPaymentRevenue: selectedTotals.walletPaymentRevenue,
            successfulPayments: selectedTotals.successfulPayments,
            paymentRecords: selectedTotals.paymentRecords,
            todayRevenue: todayTotals.totalRevenue,
            thisWeekRevenue: weekTotals.totalRevenue,
            thisMonthRevenue: monthTotals.totalRevenue
        },
        dailyRevenue,
        chartData,
        transactions,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total: totalTransactions,
            totalPages
        }
    };
};

const getIndiaDayRange = (date = new Date()) => {
    const indiaOffset = 330 * 60 * 1000;
    const indiaDate = new Date(date.getTime() + indiaOffset);
    const start = Date.UTC(indiaDate.getUTCFullYear(), indiaDate.getUTCMonth(), indiaDate.getUTCDate()) - indiaOffset;
    return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
}).format(amount);

const getAdminDashboardData = async () => {
    const { start, end } = getIndiaDayRange();
    const bookings = await Booking.find({ appointmentStart: { $gte: start, $lt: end } })
        .populate('userId', 'name')
        .populate('walkInCustomerId', 'name')
        .populate('serviceId', 'name')
            .populate('serviceIds', 'name')
        .sort({ appointmentStart: 1 });
    const [todayPayments] = await Payment.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end }, status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' }, razorpay: { $sum: { $cond: [{ $eq: ['$method', 'RAZORPAY'] }, '$amount', 0] } }, wallet: { $sum: { $cond: [{ $eq: ['$method', 'WALLET'] }, '$amount', 0] } } } }
    ]);

    const completedToday = bookings.filter((booking) => booking.status === 'COMPLETED');
    const cancelledToday = bookings.filter((booking) => booking.status === 'CANCELLED');

    const appointments = bookings.map((booking) => {
        const appointmentStart = new Date(booking.appointmentStart);
        const time = appointmentStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        const [appointmentTime, period] = time.split(' ');

        return {
            bookingId: booking._id,
            time: appointmentTime,
            period,
            customer: booking.userId?.name || booking.walkInCustomerId?.name || 'Customer unavailable',
            service: booking.serviceIds?.length
                ? booking.serviceIds.map((service) => service.name).join(', ')
                : booking.serviceId?.name || 'Service unavailable',
            amount: formatCurrency(Number(booking.servicePrice) || 0),
            status: booking.status
        };
    });

    return {
        dailyRevenue: formatCurrency(todayPayments?.total || 0),
        dailyRazorpay: formatCurrency(todayPayments?.razorpay || 0),
        dailyWallet: formatCurrency(todayPayments?.wallet || 0),
        totalBookings: bookings.length,
        pendingBookings: bookings.filter((booking) => booking.status === 'PENDING').length,
        completedBookings: completedToday.length,
        cancelledBookings: cancelledToday.length,
        appointments
    };
};


const getAdminCalendarBookings = async (month) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
        const error=new Error("choose a valid calender Month");
        error.statusCode = 400;
        throw error
    }

    const [year,monthNumber]= month.split('-').map(Number);
    const indiaOffset = 330*60*1000;
    const start = new Date(Date.UTC(year,monthNumber -1,1)-indiaOffset);
    const end = new Date(Date.UTC(year,monthNumber,1)-indiaOffset);


    const shopRules = await ShopRules.findOne().lean();
    const bookings = await Booking.find({appointmentStart: { $gte: start, $lt: end }})
        .populate('userId','name email phone')
        .populate('walkInCustomerId', 'name phone')
        .populate('serviceId', 'name')
        .populate('serviceIds', 'name')
        .populate('barberId', 'name')
        .sort({ appointmentStart: 1 }).lean()
    const closures = await ShopAvailability.find({ date: { $gte: start, $lt: end }, isActive: true })
        .sort({ date: 1, startTime: 1 }).lean();
    const barberBlocks = await BarberUnavailability.find({ startTime: { $lt: end }, endTime: { $gt: start } })
        .populate('barberId', 'name').sort({ startTime: 1 }).lean();


    const indiaDate = (date) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);

    const indiaTime = (date) => new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);

    const indiaTimeMinutes = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);

    const hour = Number(parts.find(part => part.type === 'hour').value);
    const minute = Number(parts.find(part => part.type === 'minute').value);

    return hour * 60 + minute;
  };


    const calendarBookings = bookings.map((booking)=>({
        id:String(booking._id),
        token: booking.bookingToken || 'Booking',
        date: indiaDate(booking.appointmentStart),
        startTime: indiaTime(booking.appointmentStart),
        startMinutes: indiaTimeMinutes(booking.appointmentStart),
        endTime: indiaTime(booking.appointmentEnd),
        endMinutes: indiaTimeMinutes(booking.appointmentEnd),
        customer: booking.userId?.name || booking.walkInCustomerId?.name || 'Customer unavailable',
        phone: booking.userId?.phone || booking.walkInCustomerId?.phone || '',
        service: booking.serviceSnapshots?.length ? booking.serviceSnapshots.map((service) => service.name).filter(Boolean).join(', ') : booking.serviceIds?.length ? booking.serviceIds.map((service) => service.name).filter(Boolean).join(', ') : booking.serviceId?.name || 'Service unavailable',
        barber: booking.barberId?.name || 'Barber unavailable',
        status: booking.status || 'UNKNOWN'
    }));
    const calendarClosures = closures.map((closure) => ({
        id: String(closure._id),
        date: indiaDate(closure.date),
        type: closure.type,
        startTime: closure.startTime ? indiaTime(closure.startTime) : null,
        startMinutes: closure.startTime ? indiaTimeMinutes(closure.startTime) : null,
        endTime: closure.endTime ? indiaTime(closure.endTime) : null,
        endMinutes: closure.endTime ? indiaTimeMinutes(closure.endTime) : null,
        reason: closure.reason || ''
    }));
    const calendarUnavailabilities = barberBlocks.flatMap((block) => {
        const blockEnd = new Date(Math.min(block.endTime.getTime(), end.getTime()));
        let segmentStart = new Date(Math.max(block.startTime.getTime(), start.getTime()));
        const segments = [];
        while (segmentStart < blockEnd) {
            const date = indiaDate(segmentStart);
            const [segmentYear, segmentMonth, segmentDay] = date.split('-').map(Number);
            const nextDate = new Date(Date.UTC(segmentYear, segmentMonth - 1, segmentDay + 1) - indiaOffset);
            const segmentEnd = new Date(Math.min(blockEnd.getTime(), nextDate.getTime()));
            segments.push({
                id: `${String(block._id)}:${date}`,
                date,
                startTime: indiaTime(segmentStart),
                startMinutes: indiaTimeMinutes(segmentStart),
                endTime: indiaTime(segmentEnd),
                endMinutes: indiaTimeMinutes(segmentEnd),
                barber: block.barberId?.name || 'Barber unavailable',
                reason: block.reason || ''
            });
            segmentStart = segmentEnd;
        }
        return segments;
    });

    return {
            bookings: calendarBookings,
            closures: calendarClosures,
            unavailabilities: calendarUnavailabilities,
            shopRules: shopRules ? {
            openingTime: shopRules.openingTime,
            closingTime: shopRules.closingTime,
            weeklyOff: shopRules.weeklyOff
        } : null
    };
}
export { getAdminDashboardData, getAdminCalendarBookings, getAdminRevenueReport };
