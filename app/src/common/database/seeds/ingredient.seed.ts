import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Repository } from 'typeorm';

@Injectable()
export class IngredientSeedService {
  private readonly logger = new Logger(IngredientSeedService.name);

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async seed(): Promise<Ingredient[]> {
    const categories = await this.categoryRepository.find();
    if (categories.length === 0) {
      throw new Error(
        "Aucune catégorie trouvée. Veuillez d'abord exécuter le seed des catégories.",
      );
    }

    const categoryMap: Record<string, Category> = {};
    categories.forEach((cat) => {
      categoryMap[cat.name] = cat;
    });

    const ingredientDefinitions = [
      // Légumes
      { name: 'Tomate', categoryName: 'Légumes' },
      { name: 'Oignon jaune', categoryName: 'Légumes' },
      { name: 'Ail', categoryName: 'Légumes' },
      { name: 'Champignons de Paris', categoryName: 'Légumes' },
      { name: 'Carotte', categoryName: 'Légumes' },
      { name: 'Courgette', categoryName: 'Légumes' },
      { name: 'Poivron rouge', categoryName: 'Légumes' },
      { name: 'Citron', categoryName: 'Fruits' },

      // Féculents
      { name: 'Pâtes', categoryName: 'Pâtes' },
      { name: 'Riz Arborio', categoryName: 'Riz' },
      { name: 'Lentilles vertes', categoryName: 'Légumes secs' },

      // Protéines
      { name: 'Thon au naturel', categoryName: 'Poissons en conserve' },
      { name: 'Filet de poulet', categoryName: 'Viandes' },
      { name: 'Lardons', categoryName: 'Viandes' },
      { name: 'Oeuf', categoryName: 'Oeufs' },

      // Produits Laitiers
      { name: 'Parmesan', categoryName: 'Fromages' },
      {
        name: 'Crème fraîche épaisse',
        categoryName: 'Produits laitiers et Oeufs',
      },

      // Herbes et Condiments
      { name: 'Basilic frais', categoryName: 'Herbes fraîches' },
      { name: 'Persil plat', categoryName: 'Herbes fraîches' },
      { name: 'Sel de Guérande', categoryName: 'Épices et condiments' },
      { name: 'Poivre noir', categoryName: 'Épices et condiments' },
      { name: 'Bouillon de volaille', categoryName: 'Aides culinaires' },

      // Matières grasses
      { name: "Huile d'olive vierge extra", categoryName: 'Huiles' },

      // Autres
      { name: 'Vin blanc sec', categoryName: 'Vins' },
      { name: 'Vinaigre de vin', categoryName: 'Épices et condiments' },
    ];

    const createdIngredients: Ingredient[] = [];
    this.logger.log('Début de la création des ingrédients génériques...');

    for (const ingDef of ingredientDefinitions) {
      const category = categoryMap[ingDef.categoryName];
      if (!category) {
        this.logger.warn(
          `Catégorie non trouvée pour l'ingrédient "${ingDef.name}". L'ingrédient est ignoré.`,
        );
        continue;
      }

      // Génère un offTag unique basé sur le nom
      // const offTag =
      //   ingDef.offTag ||
      //   ingDef.name
      //     .toLowerCase()
      //     .normalize('NFD')
      //     .replace(/[\u0300-\u036f]/g, '') // supprime accents
      //     .replace(/\s+/g, '-') // espaces → tirets
      //     .replace(/[^a-z0-9\-]/g, ''); // caractères spéciaux

      const ingredient = this.ingredientRepository.create({
        name: ingDef.name,
        categoryId: category.id,
        // offTag,≠ // champ obligatoire !
      });

      const savedIngredient = await this.ingredientRepository.save(ingredient);
      createdIngredients.push(savedIngredient);
    }

    this.logger.log('Tous les ingrédients génériques ont été créés.');
    return createdIngredients;
  }
}
