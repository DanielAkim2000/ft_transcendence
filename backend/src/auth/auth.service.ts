import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/services/users.services';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async validateUser(accessToken: string, refreshToken: string, profile: any) {
    const user = await this.usersService.findUserByIntraId(profile.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
