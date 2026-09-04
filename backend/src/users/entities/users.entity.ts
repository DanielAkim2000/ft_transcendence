import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

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

export class RefreshToken {
  @ApiProperty({
    description: 'The id of the refresh token',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
  @ApiProperty({
    description: 'The tokenHash of the refresh token',
    example: '1234567890',
  })
  tokenHash: string;
  @ApiProperty({
    description: 'The expiresAt date of the refresh token',
  })
  expiresAt: Date;
  @ApiProperty({
    description: 'The createdAt date of the refresh token',
    example: '2021-01-01',
  })
  createdAt: Date;

  constructor(refreshToken: Partial<RefreshToken>) {
    Object.assign(this, refreshToken);
  }
}

export class UserEntity {
  @ApiProperty({
    description: 'The id of the user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;
  @ApiProperty({
    description: 'The login42 of the user',
    example: 'john_doe',
  })
  login42: string | null;
  @ApiProperty({
    description: 'The email of the user',
    example: 'john.doe@example.com',
  })
  email: string;
  @ApiProperty({
    description: 'The displayname of the user',
    example: 'John Doe',
  })
  displayname: string;
  @ApiProperty({
    description: 'The avatarUrl of the user',
    example: 'https://example.com/avatar.png',
  })
  avatarUrl: string | null;
  @ApiProperty({
    description: 'The twoFactorEnabled of the user',
    example: true,
  })
  twoFactorEnabled: boolean;
  @ApiProperty({
    description: 'The twoFactorSecret of the user',
    example: '1234567890',
  })
  @Exclude()
  twoFactorSecret: string | null;
  @Exclude()
  twoFactorPendingSecret: string | null;
  @ApiProperty({
    description: 'The isOnline of the user',
    example: true,
  })
  isOnline: boolean;
  @ApiProperty({
    description: 'The status of the user',
    example: 'ONLINE',
  })
  status: Status;

  @ApiProperty({
    description: 'Preferred UI theme',
    example: 'system',
    enum: ['light', 'dark', 'system'],
  })
  theme: ThemePreference;

  @ApiProperty({
    description: 'Preferred UI language',
    example: 'fr',
    enum: ['en', 'fr', 'es'],
  })
  language: LanguagePreference;

  @ApiProperty({
    description: 'The passwordHash of the user',
    example: '1234567890',
  })
  @Exclude()
  passwordHash: string | null;

  @ApiProperty({
    description: 'The refreshTokens of the user',
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
      },
    ],
  })
  @Exclude()
  refreshTokens: RefreshToken[];

  @ApiProperty({
    description: 'The role of the user',
    example: 'ADMIN',
  })
  role: Role;
  @ApiProperty({
    description: 'The createdAt date of the user',
    example: '2021-01-01',
  })
  createdAt: Date;
  @ApiProperty({
    description: 'The updatedAt date of the user',
    example: '2021-01-01',
  })
  updatedAt: Date;

  constructor(user: Partial<UserEntity>) {
    Object.assign(this, user);
  }
}
