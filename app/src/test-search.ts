import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from 'src/app.module';
import { SeederService } from 'src/common/database/seeds/seeder.service';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { UserPreferences } from 'src/common/elasticsearch/interfaces/scoring-config.interface';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { In, Repository } from 'typeorm';

async function testSearch() {
  const app = await NestFactory.create(AppModule, {
    logger: ['debug', 'log', 'warn', 'error'],
  });
  const elasticsearchService = app.get(ElasticsearchService);
  const ingredientRepository = app.get<Repository<Ingredient>>(
    getRepositoryToken(Ingredient),
  );
  // const recipeRepository = app.get<Repository<Recipe>>(
  //   getRepositoryToken(Recipe),
  // );
  const seederService = app.get(SeederService);

  console.log('--- Démarrage du script de test de recherche ---');

  try {
    // 1. Créer un stock utilisateur fictif
    console.log('Récupération des ingrédients pour le stock fictif...');
    const ingredientNames = [
      'Pâtes',
      'Lardons',
      'Oeuf',
      'Parmesan',
      'Tomate',
      'Pâtes',
    ];
    const ingredients = await ingredientRepository.find({
      where: { name: In(ingredientNames) },
      relations: ['products'],
    });

    console.log('Ingrédients récupérés:', JSON.stringify(ingredients, null, 2));

    if (ingredients.length < 3) {
      throw new Error(
        "Impossible de récupérer suffisamment d'ingrédients pour le test. Avez-vous lancé le seed ?",
      );
    }

    const today = new Date();
    const dlcProche = new Date();
    dlcProche.setDate(today.getDate() + 3); // DLC dans 3 jours

    const userStocks: Stock[] = ingredients
      .filter((ing) => ing.products && ing.products.length > 0) // Assurer qu'il y a des produits associés
      .map((ing) => {
        const stock = new Stock();
        stock.product = ing.products[0]; // Utiliser le premier produit de la liste
        stock.quantity = 200; // Quantité généreuse
        stock.unit = 'g';
        // Simuler une DLC proche pour les lardons pour tester l'anti-gaspillage
        stock.dlc =
          ing.name === 'Lardons'
            ? dlcProche
            : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // DLC dans 30 jours pour les autres
        return stock;
      });

    if (userStocks.length < 3) {
      throw new Error(
        "Impossible de créer un stock suffisant. Certains ingrédients n'ont pas de produits associés.",
      );
    }

    // 2. Définir les préférences utilisateur
    const userPreferences: UserPreferences = {
      allergenes: [],
      preferredCategories: ['Plat principal', 'Pâtes'],
      dietaryRestrictions: [],
    };

    // 3. Lancer la recherche
    const query = 'pâtes';

    // Log the mapping to debug

    const searchResults = await elasticsearchService.searchRecipes(
      query,
      userStocks,
      userPreferences,
    );

    // 4. Afficher les résultats
    console.log(`\n--- Résultats de la recherche ---`);
    if (searchResults.results.length > 0) {
      searchResults.results.forEach((recipe) => {
        console.log(`- ${recipe.name} (Score: ${recipe.score})`);
      });
    } else {
      console.log('Aucune recette trouvée.');
    }
  } catch (error) {
    console.error(
      'Le script de test a échoué:',
      JSON.stringify(error.meta?.body || error, null, 2),
    );
  } finally {
    await app.close();
    console.log('\n--- Script de test terminé ---');
  }
}

testSearch();
