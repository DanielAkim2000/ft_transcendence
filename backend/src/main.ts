import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'FT_TRANSCENDANCE',
      colors: true,
      logLevels: ['error', 'warn', 'log', 'verbose', 'debug', 'verbose'],
      timestamp: true,
    }),
  });
  await app.listen(process.env.PORT ?? 5000);
}

bootstrap().catch(console.error);
