import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { uploadImageToCloudinary, deleteCloudinaryProfileImage } from '../services/cloudinaryService.js';

test('Cloudinary upload reports an actionable configuration error when credentials are absent', async () => {
    const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

    try {
        for (const key of envKeys) delete process.env[key];
        await assert.rejects(
            uploadImageToCloudinary({ buffer: Buffer.from('test'), mimetype: 'image/png', originalname: 'photo.png' }),
            (error) => error.statusCode === 503 && error.message === 'Profile image storage is not configured'
        );
    } finally {
        for (const key of envKeys) {
            if (originalEnv[key] === undefined) delete process.env[key];
            else process.env[key] = originalEnv[key];
        }
    }
});

test('Cloudinary upload signs folder and timestamp and returns secure URL', async () => {
    const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    let request;

    try {
        process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
        process.env.CLOUDINARY_API_KEY = 'test-key';
        process.env.CLOUDINARY_API_SECRET = 'test-secret';
        globalThis.fetch = async (url, options) => {
            request = { url, options };
            return new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/photo.jpg' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const secureUrl = await uploadImageToCloudinary({
            buffer: Buffer.from('test image bytes'),
            mimetype: 'image/png',
            originalname: 'profile.png'
        });
        const form = request.options.body;
        const signatureInput = `folder=${form.get('folder')}&timestamp=${form.get('timestamp')}test-secret`;
        const expectedSignature = createHash('sha1').update(signatureInput).digest('hex');

        assert.equal(secureUrl, 'https://res.cloudinary.com/demo-cloud/image/upload/photo.jpg');
        assert.equal(request.options.method, 'POST');
        assert.equal(form.get('api_key'), 'test-key');
        assert.equal(form.get('signature'), expectedSignature);
        assert.equal(form.get('folder'), 'sciss-barber/profiles');
        assert.equal(form.get('file').type, 'image/png');
    } finally {
        globalThis.fetch = originalFetch;
        for (const key of envKeys) {
            if (originalEnv[key] === undefined) delete process.env[key];
            else process.env[key] = originalEnv[key];
        }
    }
});

test('Cloudinary upstream failures are surfaced with a gateway status', async () => {
    const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;

    try {
        process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
        process.env.CLOUDINARY_API_KEY = 'test-key';
        process.env.CLOUDINARY_API_SECRET = 'test-secret';
        globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Upload rejected' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });

        await assert.rejects(
            uploadImageToCloudinary({ buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'x.png' }),
            (error) => error.statusCode === 502 && error.message === 'Upload rejected'
        );
    } finally {
        globalThis.fetch = originalFetch;
        for (const key of envKeys) {
            if (originalEnv[key] === undefined) delete process.env[key];
            else process.env[key] = originalEnv[key];
        }
    }
});

test('Cloudinary cleanup signs and deletes only this application profile assets', async () => {
    const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    let request;

    try {
        process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
        process.env.CLOUDINARY_API_KEY = 'test-key';
        process.env.CLOUDINARY_API_SECRET = 'test-secret';
        globalThis.fetch = async (url, options) => {
            request = { url, options };
            return new Response(JSON.stringify({ result: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        };

        const removed = await deleteCloudinaryProfileImage(
            'https://res.cloudinary.com/demo-cloud/image/upload/v123/sciss-barber/profiles/member-photo.jpg'
        );
        const form = request.options.body;
        const signatureInput = `public_id=${form.get('public_id')}&timestamp=${form.get('timestamp')}test-secret`;
        assert.equal(removed, true);
        assert.equal(request.url, 'https://api.cloudinary.com/v1_1/demo-cloud/image/destroy');
        assert.equal(form.get('public_id'), 'sciss-barber/profiles/member-photo');
        assert.equal(form.get('signature'), createHash('sha1').update(signatureInput).digest('hex'));

        request = undefined;
        assert.equal(await deleteCloudinaryProfileImage('https://res.cloudinary.com/another-cloud/image/upload/sciss-barber/profiles/photo.jpg'), false);
        assert.equal(request, undefined);
    } finally {
        globalThis.fetch = originalFetch;
        for (const key of envKeys) {
            if (originalEnv[key] === undefined) delete process.env[key];
            else process.env[key] = originalEnv[key];
        }
    }
});
