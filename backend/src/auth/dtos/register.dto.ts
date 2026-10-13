import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsStrongPassword,
} from 'class-validator';

/** [Major · Gestion des utilisateurs] Corps validé de l'inscription (pseudo, email, mot de passe fort). */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @IsString()
  username!: string;
}
