import { createHash } from 'node:crypto';

// Worked by Codex: send a signed server-side image upload without a Cloudinary SDK dependency.
const uploadImageToCloudinary = async (file) => {
    if (!file?.buffer) throw new Error('The uploaded profile image is unavailable');

    const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
    if (!cloudName || !apiKey || !apiSecret) {
        const error = new Error('Profile image storage is not configured');
        error.statusCode = 503;
        throw error;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'sciss-barber/profiles';
    const signature = createHash('sha1')
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest('hex');
    const form = new FormData();
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);

    let response;
    try {
        response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(20000)
        });
    } catch (cause) {
        const error = new Error(cause.name === 'TimeoutError' ? 'Profile image upload timed out' : 'Could not connect to image storage');
        error.statusCode = cause.name === 'TimeoutError' ? 504 : 502;
        throw error;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.secure_url !== 'string') {
        const error = new Error(result.error?.message || 'Could not upload the profile image');
        error.statusCode = 502;
        throw error;
    }
    return result.secure_url;
};

// Worked by Codex: delete only profile assets owned by this app's Cloudinary folder.
const deleteCloudinaryProfileImage = async (imageUrl) => {
    const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
    if (!cloudName || !apiKey || !apiSecret || typeof imageUrl !== 'string') return false;

    let imagePath;
    try {
        const url = new URL(imageUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return false;
        imagePath = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
        return false;
    }

    if (imagePath[0] !== cloudName || imagePath[1] !== 'image' || imagePath[2] !== 'upload') return false;
    const folderIndex = imagePath.indexOf('sciss-barber', 3);
    if (folderIndex < 0 || imagePath[folderIndex + 1] !== 'profiles') return false;
    const publicIdParts = imagePath.slice(folderIndex);
    if (publicIdParts.length < 3) return false;
    const lastPart = publicIdParts[publicIdParts.length - 1];
    publicIdParts[publicIdParts.length - 1] = lastPart.replace(/\.[^.]+$/, '');
    const publicId = publicIdParts.join('/');
    if (!publicId || publicId.endsWith('/')) return false;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
        .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
        .digest('hex');
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    let response;
    try {
        response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(20000)
        });
    } catch (cause) {
        const error = new Error(cause.name === 'TimeoutError' ? 'Profile image cleanup timed out' : 'Could not connect to image storage');
        error.statusCode = cause.name === 'TimeoutError' ? 504 : 502;
        throw error;
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !['ok', 'not found'].includes(result.result)) {
        const error = new Error(result.error?.message || 'Could not remove the previous profile image');
        error.statusCode = 502;
        throw error;
    }
    return true;
};

export { uploadImageToCloudinary, deleteCloudinaryProfileImage };
