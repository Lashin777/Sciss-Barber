import multer from 'multer';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Worked by Codex: keep local uploads working until Cloudinary credentials are configured.
const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);
// Worked by Codex: write to the same project uploads directory served by app.js, regardless of launch cwd.
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        const extensionByMimeType = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif'
        };
        const uniqueName = `profile-${randomUUID()}${extensionByMimeType[file.mimetype] || ''}`;
        cb(null, uniqueName);
    }
});

if (!cloudinaryConfigured) fs.mkdirSync(uploadDirectory, { recursive: true });

const fileFilter = (req, file, cb) => {
    // Worked by Codex: allow raster formats only; SVG and user-controlled filenames are excluded.
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error('Choose a JPEG, PNG, WebP, or GIF image');
        error.statusCode = 400;
        cb(error, false);
    }
};

const upload = multer({
    storage: cloudinaryConfigured ? multer.memoryStorage() : localStorage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});

export default upload;
