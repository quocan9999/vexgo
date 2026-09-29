import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { TripsService } from './src/trips/trips.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tripsService = app.get(TripsService);
  
  try {
    const res = await tripsService.search({ origin: 'Hồ Chí Minh', destination: 'Đà Lạt', date: '2026-10-15' });
    console.log(res);
  } catch (err) {
    console.error('ERROR HERE:', err);
  }
  
  await app.close();
}
bootstrap();
