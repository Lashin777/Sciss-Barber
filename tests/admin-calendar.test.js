import test from 'node:test';
import assert from 'node:assert/strict';
import Booking from '../models/bookingModel.js';
import { getAdminCalendarBookings } from '../services/AdminDashboardService.js';

const makeBookingQuery = (value) => ({
    populate() { return this; },
    sort() { return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test('admin calendar queries the requested Kolkata month and returns booking details', async () => {
    const originalFind = Booking.find;
    let filter;
    try {
        Booking.find = (criteria) => {
            filter = criteria;
            return makeBookingQuery([{
                _id: '65aa00000000000000000001', bookingToken: 'SB-0042',
                appointmentStart: new Date('2026-11-01T00:15:00+05:30'),
                appointmentEnd: new Date('2026-11-01T00:45:00+05:30'), status: 'CONFIRMED',
                userId: { name: 'Ava Barber', phone: '9876543210' },
                serviceId: { name: 'Haircut' },
                serviceIds: [{ name: 'Haircut' }, { name: 'Beard trim' }],
                barberId: { name: 'Sam' }
            }]);
        };

        const bookings = await getAdminCalendarBookings('2026-11');
        assert.deepEqual(filter.appointmentStart, {
            $gte: new Date('2026-10-31T18:30:00.000Z'),
            $lt: new Date('2026-11-30T18:30:00.000Z')
        });
        assert.deepEqual(bookings, [{
            id: '65aa00000000000000000001', token: 'SB-0042', date: '2026-11-01',
            startTime: '12:15 am', endTime: '12:45 am', customer: 'Ava Barber',
            phone: '9876543210', service: 'Haircut, Beard trim', barber: 'Sam', status: 'CONFIRMED'
        }]);
    } finally {
        Booking.find = originalFind;
    }
});

test('admin calendar rejects malformed month keys before querying bookings', async () => {
    const originalFind = Booking.find;
    Booking.find = () => { throw new Error('Booking query should not run'); };
    try {
        await assert.rejects(getAdminCalendarBookings('2026-13'), (error) => error.statusCode === 400);
    } finally {
        Booking.find = originalFind;
    }
});
