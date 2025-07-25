import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Queue } from 'bull'
import { getQueueToken } from '@nestjs/bull';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
