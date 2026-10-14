import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UserEntity } from '../users/entities/users.entity';
import { ExportQueryDto } from './dtos/export-query.dto';
import { ConfirmDeletionDto } from './dtos/confirm-deletion.dto';
import { GdprService } from './gdpr.service';

/** [Minor · RGPD] Contrôleur HTTP RGPD (export des données et suppression du compte) : routes REST protégées par les guards d'authentification. */
@Controller('gdpr')
export class GdprController {
  /** Injecte les dépendances : GdprService. */
  constructor(private readonly gdprService: GdprService) {}

  /** [Minor · RGPD] GET /gdpr/export?format=json|csv : télécharge toutes les données personnelles de l'utilisateur connecté ; un email l'en informe. */
  @Get('export')
  @UseGuards(AccessTokenGuard)
  async exportData(
    @Req() req: Request & { user: UserEntity },
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const file = await this.gdprService.exportData(req.user, query.format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return file.body;
  }

  /** [Minor · RGPD] POST /gdpr/deletion-request : envoie par email un lien de confirmation (1 h) pour supprimer le compte. */
  @Post('deletion-request')
  @HttpCode(202)
  @UseGuards(AccessTokenGuard)
  async requestDeletion(@Req() req: Request & { user: UserEntity }) {
    await this.gdprService.requestDeletion(req.user);
    return { message: 'Confirmation email sent' };
  }

  /** [Minor · RGPD] POST /gdpr/deletion-confirm : public (le jeton signé reçu par email fait foi) ; supprime définitivement le compte. */
  @Post('deletion-confirm')
  @HttpCode(200)
  async confirmDeletion(@Body() dto: ConfirmDeletionDto) {
    await this.gdprService.confirmDeletion(dto.token);
    return { message: 'Account deleted' };
  }
}
