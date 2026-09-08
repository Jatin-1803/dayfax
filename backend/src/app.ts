import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler.js';
import { requestContext } from './common/middleware/request-context.js';
import { requestTiming } from './common/middleware/request-timing.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { addressesRouter } from './modules/addresses/addresses.routes.js';
import { adminAuthRouter } from './modules/admin-auth/admin-auth.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { adminCatalogRouter } from './modules/admin-catalog/admin-catalog.routes.js';
import { adminOrdersRouter } from './modules/admin-orders/admin-orders.routes.js';
import { adminBannersRouter } from './modules/admin-banners/admin-banners.routes.js';
import { adminStoresRouter } from './modules/admin-stores/admin-stores.routes.js';
import { bannersRouter } from './modules/banners/banners.routes.js';
import { adminUploadsRouter } from './modules/admin-uploads/admin-uploads.routes.js';
import { adminUsersRouter } from './modules/admin-users/admin-users.routes.js';
import { adminZonesRouter } from './modules/admin-zones/admin-zones.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { i18nAdminRouter, i18nPublicRouter } from './modules/i18n/i18n.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { deliveryRouter } from './modules/delivery/delivery.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import {
  adminProductSearchRouter,
  searchAdminRouter,
} from './modules/search-admin/search-admin.routes.js';
import { handleRazorpayWebhook } from './modules/payments/razorpay-webhook.controller.js';
import { storesRouter } from './modules/stores/stores.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestContext);
  app.post(
    `${env.API_PREFIX}/webhooks/razorpay`,
    express.raw({ type: 'application/json' }),
    (req, res, next) => {
      void handleRazorpayWebhook(req, res).catch(next);
    },
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Admin HTML uses inline styles/scripts; API responses do not need strict CSP.
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }
  app.use(requestTiming);
  app.use(
    '/media',
    express.static(publicDir, {
      maxAge: env.NODE_ENV === 'production' ? '7d' : 0,
      fallthrough: true,
    }),
  );
  app.use(
    '/admin',
    express.static(path.join(publicDir, 'admin'), {
      maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
      fallthrough: true,
      index: 'index.html',
    }),
  );

  app.use(
    rateLimit({
      // Per-IP abuse guard — not a system capacity cap.
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.path.endsWith('/health') ||
        req.originalUrl.split('?')[0]?.endsWith('/health') === true ||
        req.originalUrl.includes('/webhooks/razorpay'),
    }),
  );

  const api = Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/i18n', i18nPublicRouter);
  api.use('/admin/auth', adminAuthRouter);
  api.use('/admin/uploads', adminUploadsRouter);
  api.use('/admin', adminRouter);
  api.use('/admin/i18n', i18nAdminRouter);
  api.use('/admin/catalog', adminCatalogRouter);
  api.use('/admin/stores', adminStoresRouter);
  api.use('/admin/banners', adminBannersRouter);
  api.use('/admin/orders', adminOrdersRouter);
  api.use('/admin/users', adminUsersRouter);
  api.use('/admin/zones', adminZonesRouter);
  api.use('/stores', storesRouter);
  api.use('/banners', bannersRouter);
  api.use('/categories', categoriesRouter);
  api.use('/products', productsRouter);
  api.use('/admin/search', searchAdminRouter);
  api.use('/admin/products', adminProductSearchRouter);
  api.use('/addresses', addressesRouter);
  api.use('/cart', cartRouter);
  api.use('/orders', ordersRouter);
  api.use('/delivery', deliveryRouter);
  api.use('/notifications', notificationsRouter);

  app.use(env.API_PREFIX, api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
