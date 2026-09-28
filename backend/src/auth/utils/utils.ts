import { createHash } from 'crypto';

/** Retourne le hash SHA-256 (hexadécimal) d'un refresh token, pour ne jamais stocker le token en clair. */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export { hashRefreshToken };
