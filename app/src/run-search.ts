import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeederService } from './common/database/seeds/seeder.service';
import { ElasticsearchService } from './common/elasticsearch/elasticsearch.service';
import { UserPreferences } from './common/elasticsearch/interfaces/scoring-config.interface';
import { Stock } from './stocks/entities/stock.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  console.log('--- Démarrage du script de recherche ---');

  // 1. Lancer le seeder pour (ré)indexer les données
  console.log('\n--- Lancement du seeder ---');
  const seederService = app.get(SeederService);
  await seederService.seedAll();
  console.log('--- Seeder terminé ---');

  // 2. Préparer les données de recherche
  const elasticsearchService = app.get(ElasticsearchService);
  const userStocks: Stock[] = [
    {
      id: 'c8a0b2d8-9e7f-4c3a-8b1e-6d9f2c7b1a0d',
      quantity: 200,
      dlc: new Date('2025-12-31'),
      product: { id: '3017620422003' } as any,
      user: { id: 'test-user-id' } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const query = 'pâtes';

  // 3. Lancer la recherche
  console.log(`\n--- Lancement de la recherche pour "${query}" ---`);
  const searchResults = await elasticsearchService.searchRecipes(
    query,
    userStocks,
    {} as UserPreferences,
  );

  // 4. Afficher les résultats
  console.log('\n--- Résultats de la recherche ---');
  console.log(JSON.stringify(searchResults, null, 2));

  await app.close();
  console.log('\n--- Script terminé ---');
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Error running script', err);
  process.exit(1);
});
