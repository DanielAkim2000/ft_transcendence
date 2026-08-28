import { forwardRef, Module } from '@nestjs/common';
import { PresenceGateway } from './presence.gateway';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [PresenceGateway],
  exports: [PresenceGateway],
})
export class PresenceModule {}
