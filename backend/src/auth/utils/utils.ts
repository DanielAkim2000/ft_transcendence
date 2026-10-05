import { createHash } from 'crypto';

/** Retourne le hash SHA-256 (hexadécimal) d'un jeton, pour ne jamais le stocker en clair. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Retourne le hash SHA-256 (hexadécimal) d'un refresh token, pour ne jamais stocker le token en clair. */
function hashRefreshToken(token: string): string {
  return hashToken(token);
}

export { hashRefreshToken, hashToken };
