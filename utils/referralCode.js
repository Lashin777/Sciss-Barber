import { randomBytes } from 'node:crypto';

const generateReferralCode = () => `SB${randomBytes(8).toString('hex').toUpperCase()}`;

export { generateReferralCode };
