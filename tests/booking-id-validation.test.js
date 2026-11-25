import test from 'node:test';
import assert from 'node:assert/strict';
import { validationBookingId } from '../middlewares/validation.js';

const invokeValidation = (bookingId) => {
    let statusCode;
    let payload;
    let nextCalled = false;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(body) {
            payload = body;
            return this;
        }
    };

    validationBookingId({ params: { bookingId } }, res, () => {
        nextCalled = true;
    });

    return { statusCode, payload, nextCalled };
};

test('booking ID validator accepts a 24-character hexadecimal ID', () => {
    assert.deepEqual(invokeValidation('65aa00000000000000000001'), {
        statusCode: undefined,
        payload: undefined,
        nextCalled: true
    });
});

test('booking ID validator returns a clear 400 before database access for malformed IDs', () => {
    const result = invokeValidation('not-an-object-id');
    assert.equal(result.statusCode, 400);
    assert.deepEqual(result.payload, { success: false, message: 'Invalid booking ID' });
    assert.equal(result.nextCalled, false);
});
