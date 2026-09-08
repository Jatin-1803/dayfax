import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { ValidationError } from '../../common/errors/app-error.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { createId } from '../../common/utils/id.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../public/catalog/uploads');

fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] ?? '.jpg';
    cb(null, `${createId()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new ValidationError('Only JPEG, PNG, or WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const adminUploadsRouter = Router();
adminUploadsRouter.use(authenticate, requireAdminPrincipal());

adminUploadsRouter.post(
  '/image',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            next(new ValidationError('Image must be 2MB or smaller'));
            return;
          }
          next(new ValidationError(err.message));
          return;
        }
        next(err);
        return;
      }
      next();
    });
  },
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ValidationError('Image file is required (field name: file)');
      }
      const imageUrl = `/media/catalog/uploads/${req.file.filename}`;
      sendSuccess(res, { imageUrl }, 'Image uploaded', 201);
    } catch (error) {
      next(error);
    }
  },
);
