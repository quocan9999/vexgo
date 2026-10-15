import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SupportChatService } from './support-chat.service.js';
import { SupportChatGateway } from './support-chat.gateway.js';
import { SupportChatController } from './support-chat.controller.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SupportChatController],
  providers: [SupportChatService, SupportChatGateway],
  exports: [SupportChatService, SupportChatGateway],
})
export class SupportChatModule {}
