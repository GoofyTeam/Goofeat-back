import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CategorySeedService {
  private readonly logger = new Logger(CategorySeedService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async seed(): Promise<void> {
    this.logger.log('Début de la création des catégories hiérarchiques...');

    // 1. Créer les catégories parentes
    const parentCategoriesData = [
      { name: 'Fruits et Légumes', iconUrl: '🥦' },
      { name: 'Produits laitiers et Oeufs', iconUrl: '🥛' },
      { name: 'Viandes & Poissons', iconUrl: '🥩' },
      { name: 'Féculents', iconUrl: '🍞' },
      { name: 'Épicerie', iconUrl: '🛒' },
      { name: 'Boissons', iconUrl: '🍷' },
    ];

    const parentCategories = await this.categoryRepository.save(
      this.categoryRepository.create(parentCategoriesData),
    );

    this.logger.log('Catégories parentes créées.');

    // 2. Créer une map pour un accès facile
    const parentMap = parentCategories.reduce(
      (map, parent) => {
        map[parent.name] = parent.id;
        return map;
      },
      {} as Record<string, string>,
    );

    // 3. Créer les catégories enfants
    const childCategoriesData = [
      // Enfants de "Fruits et Légumes"
      {
        name: 'Légumes',
        iconUrl: '🥕',
        parentId: parentMap['Fruits et Légumes'],
      },
      {
        name: 'Fruits',
        iconUrl: '🍎',
        parentId: parentMap['Fruits et Légumes'],
      },

      // Enfants de "Produits laitiers"
      {
        name: 'Fromages',
        iconUrl: '🧀',
        parentId: parentMap['Produits laitiers et Oeufs'],
      },
      {
        name: 'Oeufs',
        iconUrl: '🥚',
        parentId: parentMap['Produits laitiers et Oeufs'],
      },

      // Enfants de "Féculents"
      { name: 'Pâtes', iconUrl: '🍝', parentId: parentMap['Féculents'] },
      { name: 'Riz', iconUrl: '🍚', parentId: parentMap['Féculents'] },

      // Enfants de "Viandes & Poissons"
      {
        name: 'Viandes',
        iconUrl: '🍗',
        parentId: parentMap['Viandes & Poissons'],
      },

      // Enfants de "Épicerie"
      {
        name: 'Poissons en conserve',
        iconUrl: '🐟',
        parentId: parentMap['Viandes & Poissons'],
      },
      {
        name: 'Herbes fraîches',
        iconUrl: '🌿',
        parentId: parentMap['Épicerie'],
      },
      {
        name: 'Épices et condiments',
        iconUrl: '🧂',
        parentId: parentMap['Épicerie'],
      },
      { name: 'Huiles', iconUrl: '🫒', parentId: parentMap['Épicerie'] },
      { name: 'Légumes secs', iconUrl: '🫘', parentId: parentMap['Épicerie'] },
      {
        name: 'Aides culinaires',
        iconUrl: '🧑‍🍳',
        parentId: parentMap['Épicerie'],
      },

      // Enfants de "Boissons"
      { name: 'Vins', iconUrl: '🍷', parentId: parentMap['Boissons'] },
    ];

    await this.categoryRepository.save(
      this.categoryRepository.create(childCategoriesData),
    );

    this.logger.log(
      'Toutes les catégories ont été créées avec leur hiérarchie.',
    );
  }
}
