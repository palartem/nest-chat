import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONT_URL || 'http://localhost:9000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
