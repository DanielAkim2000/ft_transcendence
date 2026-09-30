import { IsIn, IsOptional } from 'class-validator';
import {
  ACCENT_PREFERENCES,
  RADIUS_PREFERENCES,
} from '../entities/user.entity';
import type {
  AccentPreference,
  RadiusPreference,
} from '../entities/user.entity';

export class UpdateSettingsDto {
  @IsIn(['light', 'dark', 'system'])
  theme!: 'light' | 'dark' | 'system';

  @IsIn(['en', 'fr', 'es'])
  language!: 'en' | 'fr' | 'es';

  /** Couleur principale ; absente = inchangée. */
  @IsOptional()
  @IsIn(ACCENT_PREFERENCES)
  accent?: AccentPreference;

  /** Arrondi des bordures ; absent = inchangé. */
  @IsOptional()
  @IsIn(RADIUS_PREFERENCES)
  radius?: RadiusPreference;
}
