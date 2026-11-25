import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/userModel.js';
import { comparePassword } from '../utils/passwordUtils.js';
import { requestAdminPasswordReset, resetAdminPassword } from '../services/adminService.js';

const makeQuery = (value) => ({
    select() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

test('admin reset request sends an OTP only for an active admin account', async () => {
    const originalFindOne = User.findOne;
    let requestedFilter;
    let sentOtp;
    try {
        User.findOne = (filter) => {
            requestedFilter = filter;
            return makeQuery({ _id: 'admin-id' });
        };
        await requestAdminPasswordReset(' ADMIN@EXAMPLE.INVALID ', async (email, purpose) => {
            sentOtp = { email, purpose };
        });
        assert.deepEqual(requestedFilter, {
            email: 'admin@example.invalid', role: 'ADMIN', status: 'ACTIVE'
        });
        assert.deepEqual(sentOtp, { email: 'admin@example.invalid', purpose: 'ADMIN_PASSWORD_RESET' });
    } finally {
        User.findOne = originalFindOne;
    }
});

test('admin password reset consumes its scoped OTP and revokes existing sessions', async () => {
    const originalFindOne = User.findOne;
    const originalUpdateOne = User.updateOne;
    let updateFilter;
    let update;
    let consumedOtp;
    try {
        User.findOne = () => makeQuery({ _id: 'admin-id' });
        User.updateOne = async (filter, changes) => {
            updateFilter = filter;
            update = changes;
            return { matchedCount: 1 };
        };
        await resetAdminPassword('ADMIN@EXAMPLE.INVALID', '123456', 'a-new-strong-password', async (...args) => {
            consumedOtp = args;
        });

        assert.deepEqual(consumedOtp, ['admin@example.invalid', '123456', 'ADMIN_PASSWORD_RESET']);
        assert.deepEqual(updateFilter, { _id: 'admin-id', role: 'ADMIN', status: 'ACTIVE' });
        assert.equal(update.$inc.tokenVersion, 1);
        assert.equal(await comparePassword('a-new-strong-password', update.$set.password), true);
    } finally {
        User.findOne = originalFindOne;
        User.updateOne = originalUpdateOne;
    }
});
