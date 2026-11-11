import { Global, Module } from '@nestjs/common';
import { RealtimeSessionInvalidatorService } from './realtime-session-invalidator.service.js';

@Global()
@Module({
  providers: [RealtimeSessionInvalidatorService],
  exports: [RealtimeSessionInvalidatorService],
})
export class RealtimeSessionInvalidatorModule {}
