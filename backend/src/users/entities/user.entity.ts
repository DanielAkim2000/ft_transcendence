import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { RefreshToken } from './refresh-token.entity';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Status {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IN_GAME = 'IN_GAME',
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type LanguagePreference = 'en' | 'fr' | 'es';

export class UserEntity {
  @ApiProperty({
    description: 'The id of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;
  @ApiProperty({ description: 'The login42 of the user', example: 'john_doe' })
  login42!: string | null;
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  email!: string;
  @ApiProperty({
    description: 'The displayname of the user',
    example: 'John Doe',
  })
  displayname!: string;
  @ApiProperty({
    description: 'The avatarUrl of the user',
    example: 'https://example.com/avatar.png',
  })
  avatarUrl!: string | null;
  @ApiProperty({
    description: 'The twoFactorEnabled of the user',
    example: true,
  })
  twoFactorEnabled!: boolean;
  @Exclude()
  twoFactorSecret!: string | null;
  @Exclude()
  twoFactorPendingSecret!: string | null;
  @ApiProperty({ description: 'The isOnline of the user', example: true })
  isOnline!: boolean;
  @ApiProperty({ description: 'The status of the user', example: 'ONLINE' })
  status!: Status;
  @ApiProperty({ description: 'Preferred UI theme', example: 'system' })
  theme!: ThemePreference;
  @ApiProperty({ description: 'Preferred UI language', example: 'fr' })
  language!: LanguagePreference;
  @Exclude()
  passwordHash!: string | null;
  @Exclude()
  refreshTokens!: RefreshToken[];
  @ApiProperty({ description: 'The role of the user', example: 'ADMIN' })
  role!: Role;
  @ApiProperty({
    description: 'The createdAt date of the user',
    example: '2021-01-01',
  })
  createdAt!: Date;
  @ApiProperty({
    description: 'The updatedAt date of the user',
    example: '2021-01-01',
  })
  updatedAt!: Date;

  /** Copie dans l'instance les champs fournis. */
  constructor(user: Partial<UserEntity>) {
    Object.assign(this, user);
  }
}
