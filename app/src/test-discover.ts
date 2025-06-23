import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from 'src/app.module';
import { SeederService } from 'src/common/database/seeds/seeder.service';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { UserPreferences } from 'src/common/elasticsearch/interfaces/scoring-config.interface';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { In, Repository } from 'typeorm';

async function testDiscover() {
  const app = await NestFactory.create(AppModule, {
    logger: ['debug', 'log', 'warn', 'error'],
  });
  const elasticsearchService = app.get(ElasticsearchService);
  const ingredientRepository = app.get<Repository<Ingredient>>(
    getRepositoryToken(Ingredient),
  );
  const seederService = app.get(SeederService);

  console.log('--- Démarrage du script de test de découverte ---');

  // Lancement du seeding pour s'assurer que les données sont à jour
  console.log('--- Lancement du seeding complet... ---');
  await seederService.seedAll();
  console.log('--- Seeding terminé ---');

  // Attendre que les événements d'indexation se propagent
  console.log("--- Attente de 2 secondes pour l'indexation... ---");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // 1. Créer un stock utilisateur fictif
    console.log('Récupération des ingrédients pour le stock fictif...');
    const ingredientNames = [
      'Pâtes',
      'Lardons',
      'Oeuf',
      'Parmesan',
      'Tomate',
      'Oignon',
    ];
    const ingredients = await ingredientRepository.find({
      where: { name: In(ingredientNames) },
      relations: ['products'],
    });

    if (ingredients.length < ingredientNames.length) {
      console.warn(
        'Certains ingrédients de base manquent dans la base de données. Avez-vous lancé le seed ?',
      );
    }

    const today = new Date();
    const dlcTresProche = new Date();
    dlcTresProche.setDate(today.getDate() + 2); // DLC dans 2 jours

    const userStocks: Stock[] = ingredients
      .filter((ing) => ing.products && ing.products.length > 0)
      .map((ing) => {
        const stock = new Stock();
        stock.product = ing.products[0];
        stock.quantity = 150;
        stock.unit = 'g';
        // Simuler une DLC très proche pour les lardons pour tester l'anti-gaspillage
        stock.dlc =
          ing.name === 'Lardons'
            ? dlcTresProche
            : new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000); // DLC dans 20 jours pour les autres
        return stock;
      });

    if (userStocks.length === 0) {
      throw new Error(
        "Impossible de créer un stock. Aucun des ingrédients spécifiés n'a de produits associés.",
      );
    }
    console.log(
      'Stock utilisateur créé:',
      userStocks.map((s) => ({
        name: s.product.name,
        dlc: s.dlc.toISOString().split('T')[0],
      })),
    );

    // 2. Définir les préférences utilisateur
    const userPreferences: UserPreferences = {
      allergenes: ['Gluten'], // Exclure les recettes avec du gluten
      preferredCategories: ['Plat principal', 'Rapide'], // Préférer ces catégories
      dietaryRestrictions: [],
    };
    console.log('Préférences utilisateur:', userPreferences);

    // 3. Lancer la recherche/découverte
    console.log('--- Lancement de la recherche/découverte de recettes ---');
    const searchResults = await elasticsearchService.searchRecipes(
      '', // Pas de requête textuelle, on se base sur le stock et les préférences pour la découverte
      userStocks,
      userPreferences,
    );

    // 4. Afficher les résultats
    console.log(`\n--- Résultats de la découverte ---`);
    if (searchResults.results.length > 0) {
      console.log(`Total de recettes trouvées: ${searchResults.total}`);
      searchResults.results.forEach((recipe) => {
        console.log(
          `- ${recipe.name} (Score: ${recipe.score.toFixed(2)}) - Ingrédients: ${recipe.ingredients.map((i) => i.name).join(', ')}`,
        );
      });
    } else {
      console.log('Aucune recette suggérée.');
    }
  } catch (error) {
    const errorMessage = error.meta?.body
      ? JSON.stringify(error.meta.body, null, 2)
      : error;
    console.error('Le script de test a échoué:', errorMessage);
  } finally {
    await app.close();
    console.log('\n--- Script de test de découverte terminé ---');
  }
}

testDiscover();
