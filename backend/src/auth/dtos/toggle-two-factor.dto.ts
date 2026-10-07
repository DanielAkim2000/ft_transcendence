import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Pour activer la 2FA : `code`. Pour la désactiver : `code` ou, si l'appli est perdue, `recoveryCode`. */
export class ToggleTwoFactorDto {
  @ApiPropertyOptional({ description: 'The 6-digit TOTP code', example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  code?: string;

  @ApiPropertyOptional({ description: 'A single-use recovery code (disable only)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;
}
