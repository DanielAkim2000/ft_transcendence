import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** [Major · Interaction entre utilisateurs] Corps validé d'un message (contenu non vide). */
export class SendMessageDto {
  @ApiProperty({
    description: 'The message content',
    example: 'Hello, how are you?',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
