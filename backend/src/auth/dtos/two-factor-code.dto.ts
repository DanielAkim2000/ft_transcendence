import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/** [Minor · 2FA] Corps validé d'un code TOTP à 6 chiffres. */
export class TwoFactorCodeDto {
  @ApiProperty({
    description: 'The 6-digit TOTP code',
    example: '123456',
  })
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Length(6, 6, { message: 'Code must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  code!: string;
}
