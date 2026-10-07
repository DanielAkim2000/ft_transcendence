import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RecoveryCodeDto {
  @ApiProperty({
    description: 'A single-use 2FA recovery code',
    example: 'ABCDE-FGHJK',
  })
  @IsString({ message: 'Recovery code must be a string' })
  @IsNotEmpty({ message: 'Recovery code is required' })
  @MaxLength(32, { message: 'Recovery code is too long' })
  recoveryCode!: string;
}
