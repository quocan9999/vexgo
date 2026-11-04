import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CloudinaryProvider } from './cloudinary.provider.js';
import { MediaService } from './media.service.js';
import {
  PublicVehicleMediaController,
  VehicleMediaController,
} from './media.controller.js';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  providers: [CloudinaryProvider, MediaService],
  controllers: [PublicVehicleMediaController, VehicleMediaController],
})
export class MediaModule {}
