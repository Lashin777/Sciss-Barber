import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validationSignup,
    validationProfileUpdate,
    validationResetPassword
} from '../middlewares/validation.js';

const invoke = async (validator, body, params = {}, file = undefined) => {
    let statusCode;
    let payload;
    let nextCalled = false;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(value) {
            payload = value;
            return this;
        }
    };

    await validator({ body, params, file }, res, () => { nextCalled = true; });
    return { statusCode, payload, nextCalled };
};

test('signup validation accepts valid data and rejects weak passwords', async () => {
    const valid = await invoke(validationSignup, {
        name: 'Ava Barber', email: 'ava@example.invalid', phone: '9876543210', password: 'strong-password'
    });
    assert.equal(valid.nextCalled, true);

    const weakPassword = await invoke(validationSignup, {
        name: 'Ava Barber', email: 'ava@example.invalid', phone: '9876543210', password: 'short12'
    });
    assert.equal(weakPassword.statusCode, 400);
    assert.match(weakPassword.payload.message, /8 characters/i);

});

test('profile validation rejects invalid names and empty changes', async () => {
    const invalidName = await invoke(validationProfileUpdate, { name: 'Ava---Barber' });
    assert.equal(invalidName.statusCode, 400);

    const emptyChange = await invoke(validationProfileUpdate, {});
    assert.equal(emptyChange.statusCode, 400);
    assert.equal(emptyChange.nextCalled, false);
});

test('password reset validation requires a valid email, six-digit OTP, and eight-character password', async () => {
    const invalidOtp = await invoke(validationResetPassword, {
        email: 'ava@example.invalid', otp: '123', password: 'strong-password'
    });
    assert.equal(invalidOtp.statusCode, 400);
    assert.match(invalidOtp.payload.message, /6-digit/i);

    const weakPassword = await invoke(validationResetPassword, {
        email: 'ava@example.invalid', otp: '123456', password: 'short'
    });
    assert.equal(weakPassword.statusCode, 400);
    assert.match(weakPassword.payload.message, /8 characters/i);

    const valid = await invoke(validationResetPassword, {
        email: 'ava@example.invalid', otp: '123456', password: 'strong-password'
    });
    assert.equal(valid.nextCalled, true);
});
