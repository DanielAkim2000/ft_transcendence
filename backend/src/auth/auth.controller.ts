import { Controller, Get, Query, Redirect } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('login')
  @Redirect(
    `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&scope=public`,
  )
  login() {}

  @Get('callback')
  callback(@Query('code') code: string) {
    return `code: ${code}`;
  }
}
