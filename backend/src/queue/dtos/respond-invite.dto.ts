import { IsBoolean } from 'class-validator';

/** [Socle produit babyfoot (hors module)] Corps validé de la réponse à une invitation de file. */
export class RespondInviteDto {
  @IsBoolean()
  accept!: boolean;
}
