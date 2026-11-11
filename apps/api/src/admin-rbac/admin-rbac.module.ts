import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminRbacController } from './admin-rbac.controller.js';
import { AdminRbacService } from './admin-rbac.service.js';
import { PlatformTenantRbacController } from './platform-tenant-rbac.controller.js';
import { TenantAdminRbacController } from './tenant-admin-rbac.controller.js';
import { TenantRolePermissionsService } from './tenant-role-permissions.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminRbacController,
    TenantAdminRbacController,
    PlatformTenantRbacController,
  ],
  providers: [AdminRbacService, TenantRolePermissionsService],
})
export class AdminRbacModule {}
