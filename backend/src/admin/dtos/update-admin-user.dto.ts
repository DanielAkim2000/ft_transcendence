import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { Role } from '../../users/entities/users.entity';

/** Tous les champs sont optionnels : seuls ceux fournis sont modifiés. */
export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(32)
  displayname?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /** Nouveau mot de passe : toutes les sessions de l'utilisateur sont alors déconnectées. */
  @IsOptional()
  @IsString()
  @IsStrongPassword()
  password?: string;
}
