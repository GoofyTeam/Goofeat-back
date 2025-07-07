/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { Ingredient } from './ingredients/entities/ingredient.entity';

const TAXONOMY_URL =
  'https://world.openfoodfacts.org/data/taxonomies/ingredients.json';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(Ingredient);

  console.log('Téléchargement de la taxonomie OFF...');
  const response = await axios.get(TAXONOMY_URL);
  const data = response.data;
  const seen = new Set<string>();
  let count = 0;

  for (const [offTagRaw, ingredientDataRaw] of Object.entries(data)) {
    const cleanedOffTag = offTagRaw.replace(/\s+/g, '').trim();
    if (!cleanedOffTag) continue;
    if (seen.has(cleanedOffTag)) {
      console.warn('Doublon OFF ignoré:', cleanedOffTag);
      continue;
    }
    seen.add(cleanedOffTag);
    const ingredientData = ingredientDataRaw as any;
    const nameFr =
      ingredientData.name?.fr || ingredientData.name?.en || cleanedOffTag;
    const nameEn =
      ingredientData.name?.en || ingredientData.name?.fr || cleanedOffTag;
    const wikidata = ingredientData.wikidata?.en || undefined;
    const parentOffTags = ingredientData.parents || undefined;
    const ingredient = repo.create({
      offTag: cleanedOffTag,
      nameFr,
      nameEn,
      wikidata,
      parentOffTags,
      name: nameFr,
    });
    try {
      await repo.save(ingredient);
      count++;
    } catch (err: any) {
      console.error('Erreur insertion:', cleanedOffTag, err.message);
    }
  }
  console.log(`Import terminé. ${count} ingrédients importés.`);
  await app.close();
}

bootstrap().catch((e) => {
  console.error('Erreur générale:', e);
  process.exit(1);
});
