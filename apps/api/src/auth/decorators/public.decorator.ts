import { SetMetadata } from '@nestjs/common';

export const AUTH_MODE_KEY = 'auth:mode';

export type EndpointAuthMode = 'public' | 'optional';

export const Public = () => SetMetadata(AUTH_MODE_KEY, 'public');

export const OptionalAuth = () => SetMetadata(AUTH_MODE_KEY, 'optional');
