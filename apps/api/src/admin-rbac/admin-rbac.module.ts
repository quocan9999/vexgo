import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminRbacController } from './admin-rbac.controller.js';
import { AdminRbacService } from './admin-rbac.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdminRbacController],
  providers: [AdminRbacService],
})
export class AdminRbacModule {}
