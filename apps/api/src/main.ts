import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApi } from './common/configure-api.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApi(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
