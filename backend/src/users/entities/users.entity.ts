import { ApiProperty } from '@nestjs/swagger';

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Status {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IN_GAME = 'IN_GAME',
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
  login42: string;
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
  twoFactorSecret: string | null;
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

  constructor(user: UserEntity) {
    this.id = user.id;
    this.login42 = user.login42;
    this.email = user.email;
    this.displayname = user.displayname;
    this.avatarUrl = user.avatarUrl;
    this.twoFactorEnabled = user.twoFactorEnabled;
    this.twoFactorSecret = user.twoFactorSecret;
    this.isOnline = user.isOnline;
    this.status = user.status;
    this.role = user.role;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
