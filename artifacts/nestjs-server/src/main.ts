import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SeedService } from './modules/seed/seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: '*' });
  app.setGlobalPrefix('api', { exclude: ['/', 'nestjs-backend'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Abajiraf Restaurant API')
    .setDescription('Cafe & Restaurant Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 NestJS server running on port ${port}`);

  void app.get(SeedService).ensureRequiredAccounts()
    .then(accountSetup => {
      console.log(`✓ Ensured ${accountSetup.count} required staff accounts`);
    })
    .catch(error => {
      console.error('Failed to ensure required staff accounts after startup', error);
    });
}
bootstrap();
