import { ApiProperty } from '@nestjs/swagger';

/** [Major · Gestion des utilisateurs] Refresh token stocké (haché) avec son expiration. */
export class RefreshToken {
  @ApiProperty({
    description: 'The id of the refresh token',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;
  @ApiProperty({
    description: 'The tokenHash of the refresh token',
    example: '1234567890',
  })
  tokenHash!: string;
  @ApiProperty({ description: 'The expiresAt date of the refresh token' })
  expiresAt!: Date;
  @ApiProperty({
    description: 'The createdAt date of the refresh token',
    example: '2021-01-01',
  })
  createdAt!: Date;

  /** [Major · Gestion des utilisateurs] Copie dans l'instance les champs fournis. */
  constructor(refreshToken: Partial<RefreshToken>) {
    Object.assign(this, refreshToken);
  }
}
