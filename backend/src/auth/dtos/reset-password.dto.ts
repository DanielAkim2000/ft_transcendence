import {
    IsNotEmpty,
    IsString,
    IsStrongPassword,
    MinLength,
} from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @IsStrongPassword()
    password!: string;
}
