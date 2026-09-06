import { Router } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'dailyfax-api',
    timestamp: new Date().toISOString(),
  });
});
