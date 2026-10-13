import { forwardRef, Module } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway';
import { UsersModule } from '../users/users.module';

/** Présence en temps réel (en ligne / hors ligne) via WebSocket. Exporte PresenceGateway. */
/** [Major · Temps réel WebSockets] Module NestJS de la présence en ligne : regroupe contrôleur, services et dépendances. */
@Module({
  imports: [forwardRef(() => UsersModule)],

  providers: [PresenceGateway],
  exports: [PresenceGateway],
})
export class PresenceModule {}
