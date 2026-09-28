import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Démarre l'application Nest : logger, filtre d'exceptions global, validation stricte des DTO, cookies, sérialisation des entités, fichiers statiques /uploads, CORS, puis écoute sur le port configuré. */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'FT_TRANSCENDANCE',
      colors: true,
      logLevels: ['error', 'warn', 'log', 'verbose', 'debug', 'verbose'],
      timestamp: true,
    }),
  });
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(cookieParser());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Set-Cookie'],
  });
  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch(console.error);
