import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** [Major · Gestion des utilisateurs] Corps validé de mise à jour du profil. */
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  displayname!: string;
}
