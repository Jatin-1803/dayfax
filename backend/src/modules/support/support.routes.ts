import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { ValidationError } from '../../common/errors/app-error.js';
import { createId } from '../../common/utils/id.js';
import { SupportController } from './support.controller.js';
import {
  openConversationSchema,
  reportDamagedItemsSchema,
  sendSupportMessageSchema,
} from './support.schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../public/returns/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] ?? '.jpg';
      cb(null, `${createId()}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new ValidationError('Only JPEG, PNG, or WebP images are allowed'));
      return;
    }
    cb(null, true);
  },
});

const controller = new SupportController();
export const supportRouter = Router();

supportRouter.use(authenticate, requireRoles('CUSTOMER', 'ADMIN'));

supportRouter.post(
  '/orders/:idOrNumber/conversations',
  validateRequest(openConversationSchema),
  controller.open,
);
supportRouter.get('/orders/:idOrNumber/conversations', controller.get);
supportRouter.post(
  '/orders/:idOrNumber/messages',
  validateRequest(sendSupportMessageSchema),
  controller.send,
);
supportRouter.post(
  '/uploads/damage-photo',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            next(new ValidationError('Image must be 4MB or smaller'));
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
  controller.uploadPhoto,
);
supportRouter.post(
  '/orders/:idOrNumber/returns',
  validateRequest(reportDamagedItemsSchema),
  controller.report,
);
