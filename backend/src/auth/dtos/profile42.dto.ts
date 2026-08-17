import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class Profile42ImageDto {
  @ApiProperty({
    description: 'The link of the image',
    example: 'https://example.com/image.png',
  })
  @IsOptional()
  @IsString({ message: 'Link must be a string' })
  @IsUrl({}, { message: 'Invalid URL' })
  link?: string;
}

export class Profile42JsonDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email' })
  @IsNotEmpty()
  email!: string;
  @ApiProperty({
    description: 'The login of the user',
    example: 'john_doe',
  })
  @IsString({ message: 'Login must be a string' })
  @IsNotEmpty()
  login!: string;
  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty()
  first_name!: string;
  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty()
  last_name!: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Profile42ImageDto)
  image?: Profile42ImageDto;
  @ApiProperty({
    description: 'The active status of the user',
    example: true,
  })
  @IsBoolean({ message: 'Active must be a boolean' })
  @IsNotEmpty()
  active!: boolean;
}

export class Profile42Dto {
  @IsNumber()
  id!: number;
  @ApiProperty({
    description: 'The username of the user',
    example: 'john_doe',
  })
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty()
  username!: string;
  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
  })
  @IsString({ message: 'Display name must be a string' })
  @IsNotEmpty()
  displayname!: string;
  @ApiProperty({
    description: 'The profile URL of the user',
    example: 'https://example.com/profile',
  })
  @IsString({ message: 'Profile URL must be a string' })
  @IsNotEmpty()
  @IsUrl({}, { message: 'Invalid URL' })
  profileUrl!: string;
  @ApiProperty({
    description: 'The JSON data of the user',
    example: {
      email: 'john.doe@example.com',
      login: 'john_doe',
      first_name: 'John',
      last_name: 'Doe',
    },
  })
  @IsObject({ message: 'JSON must be an object' })
  @IsNotEmpty()
  @Type(() => Profile42JsonDto)
  @ValidateNested()
  _json!: Profile42JsonDto;
}
