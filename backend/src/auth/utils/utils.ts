import { createHash } from 'crypto';

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export { hashRefreshToken };
