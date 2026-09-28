import { ApiProperty } from '@nestjs/swagger';
import { MessageEntity } from './message.entity';

export class ConversationEntity {
  @ApiProperty({
    description: 'The id of the conversation',
    example: 'clx987654321',
  })
  id!: string;
  @ApiProperty({
    description: 'The id of the first user',
    example: 'clx123456789',
  })
  userAId!: string;
  @ApiProperty({
    description: 'The id of the second user',
    example: 'clx456789123',
  })
  userBId!: string;
  @ApiProperty({
    description: 'The last message of the conversation',
    type: MessageEntity,
    required: false,
  })
  lastMessage?: MessageEntity;
  @ApiProperty({
    description: 'Number of messages from the other user not read yet',
    example: 2,
  })
  unreadCount: number = 0;
  @ApiProperty({
    description: 'When the other participant last read this conversation',
    required: false,
    example: '2026-01-01T12:00:00.000Z',
  })
  peerLastReadAt?: Date;
  @ApiProperty({
    description: 'The date when the conversation was created',
    example: '2026-01-01T12:00:00.000Z',
  })
  createdAt!: Date;
  @ApiProperty({
    description: 'The date when the conversation was last updated',
    example: '2026-01-01T12:30:00.000Z',
  })
  updatedAt!: Date;

  /** Copie dans l'instance les champs fournis. */
  constructor(conversation: Partial<ConversationEntity>) {
    Object.assign(this, conversation);
  }
}
