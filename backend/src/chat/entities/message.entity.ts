import { ApiProperty } from '@nestjs/swagger';

export class MessageEntity {
  @ApiProperty({
    description: 'The id of the message',
    example: 'clx123456789',
  })
  id!: string;
  @ApiProperty({
    description: 'The id of the conversation',
    example: 'clx987654321',
  })
  conversationId!: string;
  @ApiProperty({
    description: 'The id of the user who sent the message',
    example: 'clx456789123',
  })
  senderId!: string;
  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, how are you?',
  })
  content!: string;
  @ApiProperty({
    description: 'The date when the message was created',
    example: '2026-01-01T12:00:00.000Z',
  })
  createdAt!: Date;

  constructor(message: Partial<MessageEntity>) {
    Object.assign(this, message);
  }
}
