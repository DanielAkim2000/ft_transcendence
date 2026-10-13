import { ApiProperty } from '@nestjs/swagger';

/** [Minor · Chat avancé] Blocage d'un utilisateur par un autre (empêche les messages et les invitations). */
export class BlockEntity {
  @ApiProperty({
    description: 'The id of the user who blocked another user',
    example: 'clx123456789',
  })
  blockerId!: string;
  @ApiProperty({
    description: 'The id of the user who was blocked',
    example: 'clx456789123',
  })
  blockedId!: string;
  @ApiProperty({
    description: 'The date when the block was created',
    example: '2026-01-01T12:00:00.000Z',
  })
  createdAt!: Date;

  /** [Minor · Chat avancé] Copie dans l'instance les champs fournis. */
  constructor(block: Partial<BlockEntity>) {
    Object.assign(this, block);
  }
}
