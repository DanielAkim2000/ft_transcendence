import { IsJWT } from 'class-validator';

export class ConfirmDeletionDto {
  /** Jeton reçu par email dans le lien de confirmation. */
  @IsJWT()
  token!: string;
}
