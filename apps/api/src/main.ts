import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApi } from './common/configure-api.js';
import { configureSwagger } from './common/configure-swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApi(app);
  configureSwagger(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
