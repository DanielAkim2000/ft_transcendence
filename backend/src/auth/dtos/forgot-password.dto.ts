import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** [Major · Gestion des utilisateurs] Corps validé de la demande de réinitialisation (email). */
export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}
