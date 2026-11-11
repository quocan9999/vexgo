import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminAccountsController } from './admin-accounts.controller.js';
import { AdminAccountsService } from './admin-accounts.service.js';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AdminAccountsController],
  providers: [AdminAccountsService],
})
export class AdminAccountsModule {}
