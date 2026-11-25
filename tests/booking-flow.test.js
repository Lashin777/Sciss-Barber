import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.RAZORPAY_KEY_ID ||= 'rzp_test_sciss';
process.env.RAZORPAY_KEY_SECRET ||= 'test-signing-secret';
process.env.JWT_SECRET ||= 'sciss-test-jwt-secret';

const [mongooseModule, bookingModel, serviceModel, rulesModel, barberModel, unavailableModel,
    userModel, counterModel, paymentModel, otpModel, razorpayModule, bookingService, paymentService,
    adminBookingService, emailService, userService, otpService] = await Promise.all([
    import('mongoose'),
    import('../models/bookingModel.js'),
    import('../models/Service.js'),
    import('../models/ShopRules.js'),
    import('../models/barberModel.js'),
    import('../models/barberUnavailabilityModel.js'),
    import('../models/userModel.js'),
    import('../models/counterModel.js'),
    import('../models/PaymentModel.js'),
    import('../models/otpmodel.js'),
    import('../config/razorpay.js'),
    import('../services/BookingService.js'),
    import('../services/PaymentService.js'),
    import('../services/AdminBookingService.js'),
    import('../services/emailService.js'),
    import('../services/UserService.js'),
    import('../services/otpService.js')
]);

const mongoose = mongooseModule.default;
const Booking = bookingModel.default;
const Service = serviceModel.default;
const ShopRules = rulesModel.default;
const Barber = barberModel.default;
const BarberUnavailability = unavailableModel.default;
const User = userModel.default;
const Counter = counterModel.default;
const Payment = paymentModel.default;
const Otp = otpModel.default;
const razorpay = razorpayModule.default;

const makeQuery = (value) => ({
    session() { return this; },
    populate() { return this; },
    select() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test('signup, email verification, login, multi-service booking, notification, payment, and admin completion', async () => {
    const replacements = [];
    const replace = (target, key, value) => {
        replacements.push([target, key, target[key]]);
        target[key] = value;
    };

    const services = [
        { _id: '65aa00000000000000000001', name: 'Haircut', price: 500, duration: 30, isActive: true },
        { _id: '65aa00000000000000000002', name: 'Beard trim', price: 250, duration: 15, isActive: true }
    ];
    const barber = { _id: '65aa00000000000000000003', name: 'Test Barber', isActive: true };
    const rules = {
        _id: '65aa00000000000000000004', openingTime: '10:00', closingTime: '18:00',
        weeklyOff: 'SUNDAY', maxConcurrentBookings: 2, bufferMinutes: 0, advancePayment: 100
    };
    let bookingRecord;
    let paymentRecord;
    let notification;
    let razorpayOrderInput;
    let customer;
    let otpRecord;

    try {
        replace(mongoose, 'startSession', async () => ({
            withTransaction: async (callback) => callback(),
            endSession: async () => {}
        }));
        replace(User, 'findOne', (filter) => {
            if (filter.role === 'ADMIN') return makeQuery({ email: 'shop@example.invalid' });
            return makeQuery(customer || null);
        });
        replace(User, 'create', async (record) => {
            customer = {
                ...record,
                _id: '65aa00000000000000000006',
                role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0,
                isEmailVerified: false
            };
            return customer;
        });
        replace(User, 'updateOne', async () => {
            customer.isEmailVerified = true;
            return { modifiedCount: 1 };
        });
        replace(Otp, 'findOne', () => makeQuery(otpRecord));
        replace(Otp, 'findOneAndUpdate', async () => otpRecord);

        let requestedOtp;
        const created = await userService.UsersignUp(
            'test.customer@example.invalid', 'Test Customer', 'strong-password-1', '9876543210',
            async (email, purpose) => { requestedOtp = { email, purpose }; return '123456'; }
        );
        assert.equal(created.phone, '9876543210');
        assert.deepEqual(requestedOtp, { email: 'test.customer@example.invalid', purpose: 'EMAIL_VERIFICATION' });

        otpRecord = {
            _id: '65aa00000000000000000009', email: customer.email, otp: '123456',
            purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 60_000), isUsed: false
        };
        await otpService.verifyOtp(customer.email, '123456', 'EMAIL_VERIFICATION');
        const login = await userService.userLogin(customer.email, 'strong-password-1');
        assert.equal(login.user.id, customer._id);
        assert.ok(login.token);

        replace(Service, 'findOne', () => makeQuery(services[0]));
        replace(Service, 'find', () => makeQuery(services));
        replace(ShopRules, 'findOne', () => makeQuery(rules));
        replace(ShopRules, 'updateOne', async () => ({ modifiedCount: 1 }));
        replace(Barber, 'find', () => makeQuery([barber]));
        replace(Booking, 'find', () => makeQuery([]));
        replace(BarberUnavailability, 'find', () => makeQuery([]));
        replace(Counter, 'findByIdAndUpdate', async () => ({ sequence: 42 }));
        replace(Booking, 'create', async ([record]) => {
            bookingRecord = { ...record, _id: '65aa00000000000000000005', async save() {} };
            return [bookingRecord];
        });
        replace(Booking, 'findById', () => makeQuery({
            ...bookingRecord,
            userId: { name: 'Test Customer', email: 'test@example.invalid' },
            serviceId: services[0], serviceIds: services, barberId: barber
        }));
        const mailer = async (message) => { notification = message; return { accepted: [message.to] }; };
        const notifyAdmin = (payload) => emailService.sendBookingNotification(payload, mailer);
        const appointmentDate = '2035-11-19';
        const appointmentStart = new Date(2035, 10, 19, 10, 45, 0);
        const booking = await bookingService.createBookingService({
            userId: customer._id,
            serviceIds: services.map((service) => service._id),
            date: appointmentDate,
            startTime: appointmentStart.toISOString(),
            notificationSender: notifyAdmin
        });

        assert.equal(booking.servicePrice, 750);
        assert.equal(booking.serviceDuration, 45);
        assert.equal(booking.serviceIds.length, 2);
        assert.equal(booking.appointmentEnd.getTime() - booking.appointmentStart.getTime(), 45 * 60 * 1000);
        assert.equal(notification.to, 'shop@example.invalid');
        assert.match(notification.text, /Haircut, Beard trim/);

        replace(Booking, 'findOne', () => makeQuery({
            ...booking, userId: customer._id, status: 'PENDING'
        }));
        replace(Payment, 'findOne', () => makeQuery(null));
        replace(Payment, 'create', async (record) => { paymentRecord = record; return record; });
        const originalCreateOrder = razorpay.orders.create;
        razorpay.orders.create = async (order) => {
            razorpayOrderInput = order;
            return { id: 'order_test_sciss', amount: order.amount, currency: order.currency };
        };

        try {
            const order = await paymentService.createPaymentOrderService(
                booking._id,
                services.map((service) => service._id),
                customer._id
            );
            assert.equal(order.amount, 10000);
            assert.equal(razorpayOrderInput.currency, 'INR');
            assert.equal(paymentRecord.amount, 100);
            assert.equal(paymentRecord.status, 'PENDING');
        } finally {
            razorpay.orders.create = originalCreateOrder;
        }

        const paidBooking = { ...booking, status: 'PENDING', async save() {} };
        paymentRecord = {
            _id: '65aa00000000000000000007', bookingId: booking._id,
            userId: customer._id, razorpayOrderId: 'order_test_sciss',
            amount: 100, currency: 'INR', status: 'PENDING', async save() {}
        };
        replace(Payment, 'findOne', (filter) => makeQuery(filter.razorpayOrderId ? paymentRecord : paymentRecord));
        replace(Booking, 'findOne', () => makeQuery(paidBooking));
        const originalFetchPayment = razorpay.payments.fetch;
        razorpay.payments.fetch = async () => ({
            order_id: 'order_test_sciss', status: 'captured', amount: 10000, currency: 'INR'
        });
        try {
            const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update('order_test_sciss|pay_test_sciss').digest('hex');
            const verified = await paymentService.verifyPaymentService(
                'order_test_sciss', 'pay_test_sciss', signature, customer._id
            );
            assert.equal(verified.payment.status, 'SUCCESS');
            assert.equal(verified.booking.status, 'CONFIRMED');
            assert.equal(paymentRecord.razorpayPaymentId, 'pay_test_sciss');
        } finally {
            razorpay.payments.fetch = originalFetchPayment;
        }

        replace(Booking, 'findById', () => makeQuery(paidBooking));
        await adminBookingService.updateBookingStatusService(booking._id, 'COMPLETED');
        assert.equal(paidBooking.status, 'COMPLETED');
    } finally {
        for (const [target, key, original] of replacements.reverse()) target[key] = original;
    }
});
