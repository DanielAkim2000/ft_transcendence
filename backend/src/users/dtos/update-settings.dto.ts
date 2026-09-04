import { IsIn } from 'class-validator';

export class UpdateSettingsDto {
  @IsIn(['light', 'dark', 'system'])
  theme!: 'light' | 'dark' | 'system';

  @IsIn(['en', 'fr', 'es'])
  language!: 'en' | 'fr' | 'es';
}
