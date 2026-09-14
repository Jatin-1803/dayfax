import fs from 'node:fs/promises';
import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../common/errors/app-error.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { SupportService } from './support.service.js';
import type {
  OpenConversationInput,
  ReportDamagedItemsInput,
  SendSupportMessageInput,
} from './support.schema.js';

export class SupportController {
  constructor(private readonly service = new SupportService()) {}

  open = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = (req.body ?? {}) as OpenConversationInput;
      const data = await this.service.open(
        req.user!.id,
        req.params.idOrNumber as string,
        body.lang,
      );
      sendSuccess(res, data, 'Conversation ready');
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.get(req.user!.id, req.params.idOrNumber as string);
      sendSuccess(res, data, 'Conversation loaded');
    } catch (error) {
      next(error);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.sendMessage(
        req.user!.id,
        req.params.idOrNumber as string,
        req.body as SendSupportMessageInput,
      );
      sendSuccess(res, data, 'Message sent');
    } catch (error) {
      next(error);
    }
  };

  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('Image file is required (field name: file)');
      }
      const header = await readFileHeader(req.file.path);
      if (!matchesDeclaredImage(req.file.mimetype, header)) {
        await fs.unlink(req.file.path).catch(() => undefined);
        throw new ValidationError('Only JPEG, PNG, or WebP images are allowed');
      }
      sendSuccess(res, { imageUrl: `/media/returns/uploads/${req.file.filename}` }, 'Image uploaded', 201);
    } catch (error) {
      next(error);
    }
  };

  report = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.reportDamaged(
        req.user!.id,
        req.params.idOrNumber as string,
        req.body as ReportDamagedItemsInput,
      );
      sendSuccess(res, data, 'Return request sent');
    } catch (error) {
      next(error);
    }
  };
}

async function readFileHeader(filePath: string): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

function matchesDeclaredImage(mime: string, header: Buffer): boolean {
  if (mime === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mime === 'image/png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') {
    return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}
