import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { BadgesService } from './services/badges.service';

/** [Minor · Gamification] Contrôleur HTTP des badges, de l'XP et des niveaux : routes REST protégées par les guards d'authentification. */
@Controller('badges')
@UseGuards(AccessTokenGuard)
export class BadgesController {
  /** Injecte les dépendances : BadgesService. */
  constructor(private readonly badgesService: BadgesService) {}

  /** [Minor · Gamification] GET /badges/:userId : retourne le profil XP, niveau, statistiques et badges d'un joueur. */
  @Get(':userId')
  getProfile(@Param('userId') userId: string) {
    return this.badgesService.getProfile(userId);
  }
}
