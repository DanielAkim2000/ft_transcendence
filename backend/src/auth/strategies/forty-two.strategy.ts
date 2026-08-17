import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-42';
import { AuthService } from '../auth.service';
import { Profile42Dto } from '../dtos/profile42.dto';
import { FOURTY_TWO_STRATEGY } from '../constants/injection-tokens';

interface StrategyOptions {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[];
}

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(
  Strategy,
  FOURTY_TWO_STRATEGY,
) {
  constructor(private readonly authService: AuthService) {
    const clientID = process.env.CLIENT_ID;
    if (!clientID) {
      throw new Error('CLIENT_ID is not defined');
    }
    const clientSecret = process.env.CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('CLIENT_SECRET is not defined');
    }
    const callbackURL = process.env.REDIRECT_URI;
    if (!callbackURL) {
      throw new Error('REDIRECT_URI is not defined');
    }
    const options: StrategyOptions = {
      clientID,
      clientSecret,
      callbackURL,
      scope: ['public'],
    };
    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile42Dto,
  ) {
    return await this.authService.validateUserFrom42Profile(
      accessToken,
      refreshToken,
      profile,
    );
  }
}
