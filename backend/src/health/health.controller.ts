import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthReport, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  /** Injecte les dépendances : HealthService. */
  constructor(private readonly healthService: HealthService) {}

  /** GET /health : public (utilisé par Docker et la page de statut). 200 si la base répond, 503 sinon ; des sauvegardes trop anciennes rendent l'état « degraded » sans erreur HTTP. */
  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthReport> {
    const report = await this.healthService.check();
    if (report.status === 'down') {
      res.status(503);
    }
    return report;
  }
}
