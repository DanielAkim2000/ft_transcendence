import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PRISMA_ADAPTER } from './constants/injection-tokens';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    {
      provide: PRISMA_ADAPTER,
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not set');
        }
        return new PrismaPg({
          connectionString: databaseUrl,
        });
      },
      inject: [ConfigService],
    },
    PrismaService,
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
