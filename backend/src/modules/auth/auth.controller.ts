import type { NextFunction, Request, Response } from 'express';
import { readClientContext } from '../../common/http/client-context.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AuthService } from './auth.service.js';
import type {
  ChangePasswordInput,
  GoogleLoginInput,
  LinkPhoneDirectInput,
  LinkPhoneRequestInput,
  LinkPhoneVerifyInput,
  PasswordLoginInput,
  PasswordRegisterInput,
  PasswordStatusInput,
  RefreshTokenInput,
  RequestOtpInput,
  SetPasswordInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from './auth.schema.js';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.requestOtp(req.body as RequestOtpInput, readClientContext(req));
      sendSuccess(res, data, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.verifyOtp(req.body as VerifyOtpInput, readClientContext(req));
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  };

  loginWithGoogle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.loginWithGoogle(
        req.body as GoogleLoginInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  };

  requestLinkPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.requestLinkPhone(
        req.user!.id,
        req.body as LinkPhoneRequestInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyLinkPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.verifyLinkPhone(
        req.user!.id,
        req.body as LinkPhoneVerifyInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'Phone linked');
    } catch (error) {
      next(error);
    }
  };

  linkPhoneDirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.linkPhoneDirect(
        req.user!.id,
        req.body as LinkPhoneDirectInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'Phone linked');
    } catch (error) {
      next(error);
    }
  };

  loginWithPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.loginWithPassword(
        req.body as PasswordLoginInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  };

  passwordStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.passwordStatus(req.body as PasswordStatusInput);
      sendSuccess(res, data, 'Password status');
    } catch (error) {
      next(error);
    }
  };

  registerWithPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.registerWithPassword(
        req.body as PasswordRegisterInput,
        readClientContext(req),
      );
      sendSuccess(res, data, 'Account created');
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RefreshTokenInput;
      const data = await this.service.refresh(body.refreshToken, readClientContext(req));
      sendSuccess(res, data, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.me(req.user!.id);
      sendSuccess(res, data, 'Profile fetched');
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.updateProfile(req.user!.id, req.body as UpdateProfileInput);
      sendSuccess(res, data, 'Profile updated');
    } catch (error) {
      next(error);
    }
  };

  setPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.setPassword(req.user!.id, req.body as SetPasswordInput);
      sendSuccess(res, data, 'Password set');
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.changePassword(req.user!.id, req.body as ChangePasswordInput);
      sendSuccess(res, data, 'Password changed');
    } catch (error) {
      next(error);
    }
  };

  sessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listSessions(req.user!.id, req.user!.sessionId);
      sendSuccess(res, data, 'Sessions fetched');
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.revokeSession(req.user!.id, String(req.params.id), 'logout_device');
      sendSuccess(res, { revoked: true }, 'Device signed out');
    } catch (error) {
      next(error);
    }
  };

  revokeOthers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const current = req.user!.sessionId;
      if (!current) {
        sendSuccess(res, { revoked: false }, 'No current session to keep');
        return;
      }
      await this.service.revokeOthers(req.user!.id, current);
      sendSuccess(res, { revoked: true }, 'Other devices signed out');
    } catch (error) {
      next(error);
    }
  };
}
