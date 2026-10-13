import { IsNotEmpty, IsString } from 'class-validator';

/** [Major · Interaction entre utilisateurs] Corps validé de création de conversation (interlocuteur). */
export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  otherUserId!: string;
}
