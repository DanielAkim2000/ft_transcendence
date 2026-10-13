import { IsJWT } from 'class-validator';

/** [Minor · RGPD] Corps validé de confirmation de suppression (jeton signé). */
export class ConfirmDeletionDto {
  /** Jeton reçu par email dans le lien de confirmation. */
  @IsJWT()
  token!: string;
}
