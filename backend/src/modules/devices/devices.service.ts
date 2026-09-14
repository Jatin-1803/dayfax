import type { RoleCode } from '../../common/middleware/auth.js';
import { ForbiddenError } from '../../common/errors/app-error.js';
import { DevicesRepository } from './devices.repository.js';
import type { RegisterDeviceInput, UnregisterDeviceInput } from './devices.schema.js';

export class DevicesService {
  constructor(private readonly repo = new DevicesRepository()) {}

  async register(userId: string, roles: RoleCode[], input: RegisterDeviceInput): Promise<void> {
    if (!roles.includes(input.appRole)) {
      throw new ForbiddenError('This account cannot register that app role');
    }
    await this.repo.upsert({
      userId,
      token: input.token,
      platform: input.platform,
      locale: input.locale,
      appRole: input.appRole,
    });
  }

  async unregister(userId: string, input: UnregisterDeviceInput): Promise<void> {
    await this.repo.deleteForUser(userId, input.token);
  }
}
