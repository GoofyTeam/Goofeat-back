import { NestFactory } from '@nestjs/core';
import { SeederModule } from './common/database/seeds/seeder.module';
import { SeederService } from './common/database/seeds/seeder.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(SeederModule);
  const seeder = appContext.get(SeederService);

  try {
    await seeder.seedAll();
    console.log('Seeding complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await appContext.close();
  }
}

void bootstrap();
