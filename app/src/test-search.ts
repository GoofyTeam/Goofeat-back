/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from 'src/app.module';
import { SeederService } from 'src/common/database/seeds/seeder.service';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';

import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { In, Repository } from 'typeorm';
import { Unit } from './common/units/unit.enums';
import { UserPreferences } from './users/interfaces/user-preferences.interface';

async function testSearch() {
  const app = await NestFactory.create(AppModule, {
    logger: ['debug', 'log', 'warn', 'error'],
  });
  const elasticsearchService = app.get(ElasticsearchService);
  const ingredientRepository = app.get<Repository<Ingredient>>(
    getRepositoryToken(Ingredient),
  );
  const seederService = app.get(SeederService);

  console.log('--- Démarrage du script de test de recherche ---');

  // Lancement du seeding pour s'assurer que les données sont à jour
  // console.log('--- Lancement du seeding complet... ---');
  // await seederService.seedAll();
  // console.log('--- Seeding terminé ---');

  // Attendre que les événements d'indexation se propagent
  // console.log("--- Attente de 2 secondes pour l'indexation... ---");
  // await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // 1. Créer un stock utilisateur fictif
    console.log('Récupération des ingrédients pour le stock fictif...');
    // Utiliser les offTags OFF pour la recherche
    const ingredientOffTags = [
      'en:durum-wheat-semolina', // Pâtes
      'en:lardon', // Lardon
      'en:egg', // Oeuf
      'en:parmigiano-reggiano', // Parmesan
      'en:tomato', // Tomate
      'en:onion', // Oignon jaune
    ];
    const ingredients = await ingredientRepository.find({
      where: { offTag: In(ingredientOffTags) },
      relations: ['products'],
    });

    if (ingredients.length < ingredientOffTags.length) {
      console.warn(
        "Certains ingrédients n'ont pas pu être trouvés par offTag. Le stock sera partiel.",
      );
    }

    const today = new Date();
    const dlcProche = new Date();
    dlcProche.setDate(today.getDate() + 3); // DLC dans 3 jours

    const userStocks: Stock[] = ingredients
      .map((ing) => {
        if (!ing.products || ing.products.length === 0) {
          console.warn(
            `L'ingrédient "${ing.name}" n'a pas de produit associé et sera ignoré.`,
          );
          return null;
        }
        const stock = new Stock();
        stock.product = ing.products[0];
        stock.quantity = 200;
        stock.unit = Unit.G;
        stock.dlc =
          ing.name === 'Lardons'
            ? dlcProche
            : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        return stock;
      })
      .filter((stock): stock is Stock => stock !== null);

    console.log(
      'Stock utilisateur créé:',
      userStocks.map((s) => ({
        name: s.product.name,
        dlc: s.dlc.toISOString().split('T')[0],
        quantity: s.quantity,
        unit: s.unit,
      })),
    );

    // 2. Définir les préférences utilisateur
    const userPreferences: UserPreferences = {
      allergenes: [],
      preferredCategories: ['Plat principal', 'Pâtes'],
      dietaryRestrictions: [],
    };
    console.log('Préférences utilisateur:', userPreferences);

    // 3. Lancer la recherche
    const query = 'pâtes';
    console.log(`--- Lancement de la recherche pour "${query}" ---`);
    const searchResults = await elasticsearchService.searchRecipes(
      query,
      userPreferences,
      userStocks,
    );

    // 4. Afficher les résultats
    console.log(`\n--- Résultats de la recherche ---`);
    if (searchResults.results.length > 0) {
      console.log(`Total de recettes trouvées: ${searchResults.total}`);
      searchResults.results.forEach((recipe) => {
        console.log(
          `- ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i) => i.name).join(', ')}`,
        );
      });
    } else {
      console.log('Aucune recette trouvée.');
    }
  } catch (error) {
    // Type guard for Elasticsearch errors
    if (
      typeof error === 'object' &&
      error !== null &&
      'meta' in error &&
      error.meta?.body
    ) {
      console.error(
        'Le script de test a échoué (Elasticsearch error):',
        JSON.stringify(error.meta.body, null, 2),
      );
    } else {
      console.error('Le script de test a échoué:', error);
    }
  } finally {
    await app.close();
    console.log('\n--- Script de test terminé ---');
  }
}

void testSearch();
