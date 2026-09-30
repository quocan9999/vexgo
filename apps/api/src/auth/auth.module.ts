import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OtpCryptoService } from './otp/otp-crypto.service.js';
import { OtpService } from './otp/otp.service.js';
import { ConsoleSmsSender } from './sms/console-sms.sender.js';
import { SMS_SENDER } from './sms/sms-sender.js';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './tokens/token.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { AuthorizationGuard } from './guards/authorization.guard.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PermissionResolverService } from './permissions/permission-resolver.service.js';
import { EffectiveRolePermissionLoaderService } from './permissions/effective-role-permission-loader.service.js';

const DEFAULT_LOGIN_RATE_LIMIT = 20;
const DEFAULT_LOGIN_RATE_TTL_MS = 15 * 60 * 1000;

function readPositiveInteger(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = Number(config.get<string>(key));
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          limit: readPositiveInteger(
            config,
            'AUTH_LOGIN_RATE_LIMIT',
            DEFAULT_LOGIN_RATE_LIMIT,
          ),
          ttl: readPositiveInteger(
            config,
            'AUTH_LOGIN_RATE_TTL_MS',
            DEFAULT_LOGIN_RATE_TTL_MS,
          ),
        },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PermissionResolverService,
    EffectiveRolePermissionLoaderService,
    OtpCryptoService,
    OtpService,
    TokenService,
    Reflector,
    AccessTokenGuard,
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    AuthorizationGuard,
    { provide: APP_GUARD, useExisting: AuthorizationGuard },
    ConsoleSmsSender,
    { provide: SMS_SENDER, useExisting: ConsoleSmsSender },
  ],
  exports: [TokenService, AccessTokenGuard, AuthorizationGuard, JwtModule],
})
export class AuthModule {}
