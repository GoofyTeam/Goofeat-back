import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const config = new DocumentBuilder()
    .setTitle('Goofeat API')
    .setDescription('API pour Goofeat')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const port = process.env.PORT ?? 3000;
  logger.log(`Application démarrée sur le port ${port}`, 'Bootstrap');

  await app.listen(port);
}
void bootstrap();
