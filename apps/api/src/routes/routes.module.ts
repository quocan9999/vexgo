import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RoutesController } from './routes.controller.js';
import { RoutesService } from './routes.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
