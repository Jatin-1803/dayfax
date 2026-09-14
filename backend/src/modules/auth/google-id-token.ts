import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { env } from '../../config/env.js';
import { AppError, ValidationError } from '../../common/errors/app-error.js';

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!client) {
    client = new OAuth2Client();
  }
  return client;
}

/** Test hook — resets the cached OAuth client. */
export function resetGoogleAuthClientForTests(): void {
  client = null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
  const audiences = env.GOOGLE_CLIENT_IDS;
  if (audiences.length === 0) {
    throw new AppError('Google sign-in is not configured.', {
      statusCode: 503,
      code: 'GOOGLE_AUTH_DISABLED',
    });
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await getClient().verifyIdToken({
      idToken,
      audience: audiences,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ValidationError('Invalid Google sign-in token.');
  }

  if (!payload?.sub) {
    throw new ValidationError('Invalid Google sign-in token.');
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    throw new ValidationError('Google account email is required.');
  }

  if (payload.email_verified !== true) {
    throw new ValidationError('Verify your Google email, then try again.');
  }

  return {
    sub: payload.sub,
    email,
    emailVerified: true,
    name: payload.name?.trim() || null,
    picture: payload.picture?.trim() || null,
  };
}
