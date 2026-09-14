import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdminPrincipal, requirePermission } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { readClientContext } from '../../common/http/client-context.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AppControlsService } from './app-controls.service.js';

const service = new AppControlsService();
export const appPublicRouter = Router();
export const adminSystemRouter = Router();

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });

appPublicRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const data = await service.bootstrap(readClientContext(req));
    sendSuccess(res, data, 'App bootstrap');
  } catch (error) {
    next(error);
  }
});

appPublicRouter.get('/version-policy', async (req, res, next) => {
  try {
    const platform = readClientContext(req).platform ?? 'ANDROID';
    const data = await service.versionPolicy(platform, readClientContext(req));
    sendSuccess(res, data, 'Version policy');
  } catch (error) {
    next(error);
  }
});

adminSystemRouter.use(authenticate, requireAdminPrincipal());

adminSystemRouter.get('/releases', requirePermission('version_control.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.listReleases(), 'Releases');
  } catch (error) {
    next(error);
  }
});

const releaseSchema = z.object({
  platform: z.enum(['ANDROID', 'IOS']),
  version: z.string().trim().min(1).max(32),
  buildNumber: z.number().int().positive(),
  minVersion: z.string().trim().min(1).max(32),
  minBuild: z.number().int().nonnegative(),
  storeUrl: z.string().trim().url().max(512).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(1000),
  forceUpdate: z.boolean(),
  enforceAt: z.string().datetime().nullable().optional(),
  releaseNotes: z.string().trim().max(5000).nullable().optional(),
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

adminSystemRouter.post(
  '/releases',
  requirePermission('version_control.manage'),
  validateRequest(releaseSchema),
  async (req, res, next) => {
    try {
      sendSuccess(res, await service.createRelease(req.user!.id, req.body, req.requestId), 'Release saved', 201);
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.post(
  '/releases/:id/activate',
  requirePermission('version_control.manage'),
  validateRequest(z.object({ id: z.string().uuid() }), 'params'),
  validateRequest(reasonSchema),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await service.activateRelease(req.user!.id, String(req.params.id), req.body.reason, req.requestId),
        'Release activated',
      );
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/feature-flags', requirePermission('feature_flags.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.listFlags(), 'Feature flags');
  } catch (error) {
    next(error);
  }
});

const flagSchema = z.object({
  flagKey: z.string().trim().regex(/^[a-z0-9_]+$/).max(64),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean(),
  platform: z.enum(['ALL', 'ANDROID', 'IOS']),
  minVersion: z.string().trim().max(32).nullable().optional(),
  maxVersion: z.string().trim().max(32).nullable().optional(),
  rolloutPercentage: z.number().int().min(0).max(100),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  environment: z.string().trim().max(32).default('ALL'),
  reason: z.string().trim().min(3).max(500).optional(),
});

adminSystemRouter.post(
  '/feature-flags',
  requirePermission('feature_flags.manage'),
  validateRequest(flagSchema),
  async (req, res, next) => {
    try {
      sendSuccess(res, await service.saveFlag(req.user!.id, req.body, undefined, req.requestId), 'Flag saved', 201);
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.put(
  '/feature-flags/:id',
  requirePermission('feature_flags.manage'),
  validateRequest(z.object({ id: z.string().uuid() }), 'params'),
  validateRequest(flagSchema),
  async (req, res, next) => {
    try {
      sendSuccess(res, await service.saveFlag(req.user!.id, req.body, String(req.params.id), req.requestId), 'Flag updated');
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/app-config', requirePermission('app_config.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.listSettings(), 'App config');
  } catch (error) {
    next(error);
  }
});

adminSystemRouter.put(
  '/app-config/:key',
  requirePermission('app_config.manage'),
  validateRequest(z.object({ key: z.string().trim().min(1).max(64) }), 'params'),
  validateRequest(z.object({ value: z.string().trim().min(1).max(2000), reason: z.string().trim().min(3).max(500) })),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await service.updateSetting(req.user!.id, String(req.params.key), req.body.value, req.body.reason, req.requestId),
        'Setting updated',
      );
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/controls', requirePermission('app_config.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.listControls(), 'Controls');
  } catch (error) {
    next(error);
  }
});

adminSystemRouter.put(
  '/controls/:code',
  requirePermission('app_config.manage'),
  validateRequest(z.object({ code: z.string().trim().min(1).max(64) }), 'params'),
  validateRequest(
    z.object({
      enabled: z.boolean(),
      reason: z.string().trim().min(3).max(500),
      expiresAt: z.string().datetime().nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await service.setControl(
          req.user!.id,
          String(req.params.code),
          req.body.enabled,
          req.body.reason,
          req.body.expiresAt,
          req.requestId,
        ),
        'Control updated',
      );
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/maintenance', requirePermission('maintenance.manage'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.getMaintenance(), 'Maintenance');
  } catch (error) {
    next(error);
  }
});

adminSystemRouter.put(
  '/maintenance',
  requirePermission('maintenance.manage'),
  validateRequest(
    z.object({
      enabled: z.boolean(),
      title: z.string().trim().min(1).max(160),
      message: z.string().trim().min(1).max(1000),
      expectedEndAt: z.string().datetime().nullable().optional(),
      allowAdmin: z.boolean(),
      imageUrl: z.string().trim().max(512).nullable().optional(),
      allowUserIds: z.array(z.string().uuid()).max(50).optional(),
      reason: z.string().trim().min(3).max(500),
    }),
  ),
  async (req, res, next) => {
    try {
      sendSuccess(res, await service.setMaintenance(req.user!.id, req.body, req.requestId), 'Maintenance updated');
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/announcements', requirePermission('app_config.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.listAnnouncements(), 'Announcements');
  } catch (error) {
    next(error);
  }
});

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(1000),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  dismissible: z.boolean(),
  platform: z.enum(['ALL', 'ANDROID', 'IOS']),
  minVersion: z.string().trim().max(32).nullable().optional(),
  maxVersion: z.string().trim().max(32).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

adminSystemRouter.post(
  '/announcements',
  requirePermission('app_config.manage'),
  validateRequest(announcementSchema),
  async (req, res, next) => {
    try {
      sendSuccess(res, await service.saveAnnouncement(req.user!.id, req.body, undefined, req.requestId), 'Announcement saved', 201);
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.patch(
  '/announcements/:id',
  requirePermission('app_config.manage'),
  validateRequest(z.object({ id: z.string().uuid() }), 'params'),
  validateRequest(z.object({
    isActive: z.boolean(),
    reason: z.string().trim().min(3).max(500).optional(),
  })),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await service.setAnnouncementActive(req.user!.id, String(req.params.id), req.body.isActive, req.body.reason, req.requestId),
        'Announcement updated',
      );
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.delete(
  '/announcements/:id',
  requirePermission('app_config.manage'),
  validateRequest(z.object({ id: z.string().uuid() }), 'params'),
  async (req, res, next) => {
    try {
      sendSuccess(
        res,
        await service.deleteAnnouncement(req.user!.id, String(req.params.id), undefined, req.requestId),
        'Announcement deleted',
      );
    } catch (error) {
      next(error);
    }
  },
);

adminSystemRouter.get('/audit-logs', requirePermission('audit_logs.view'), async (req, res, next) => {
  try {
    const { listAuditLogs } = await import('../../common/audit/audit-log.js');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await listAuditLogs({
      limit,
      offset: (page - 1) * limit,
      module: typeof req.query.module === 'string' ? req.query.module : undefined,
      entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
    });
    sendSuccess(res, { items: result.rows, page, limit, total: result.total }, 'Audit logs');
  } catch (error) {
    next(error);
  }
});

adminSystemRouter.get('/health', requirePermission('app_config.view'), async (_req, res, next) => {
  try {
    sendSuccess(res, await service.health(), 'System health');
  } catch (error) {
    next(error);
  }
});
