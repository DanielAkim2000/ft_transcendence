import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Re-confirmation de l'identité avant de régénérer les codes de secours : code TOTP actuel ou mot de passe. */
export class RegenerateRecoveryCodesDto {
  @ApiPropertyOptional({ description: 'The 6-digit TOTP code', example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  code?: string;

  @ApiPropertyOptional({ description: 'The account password' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;
}
