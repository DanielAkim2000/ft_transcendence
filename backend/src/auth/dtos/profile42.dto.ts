import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class Profile42ImageDto {
  @IsOptional()
  @IsString()
  link?: string;
}

export class Profile42JsonDto {
  @IsString()
  email!: string;
  @IsString()
  login!: string;
  @IsString()
  first_name!: string;
  @IsString()
  last_name!: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Profile42ImageDto)
  image?: Profile42ImageDto;
  @IsBoolean()
  active!: boolean;
}

export class Profile42Dto {
  @IsNumber()
  id!: number;
  @IsString()
  username!: string;
  @IsString()
  displayname!: string;
  @IsString()
  profileUrl!: string;
  @IsObject()
  @ValidateNested()
  @Type(() => Profile42JsonDto)
  _json!: Profile42JsonDto;
}
