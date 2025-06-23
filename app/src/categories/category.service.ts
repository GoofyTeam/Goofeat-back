import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateQuery,
} from 'nestjs-paginate';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  /**
   * Obtient toutes les catégories avec pagination
   */
  async findAll(query: PaginateQuery): Promise<Paginated<Category>> {
    return paginate(query, this.categoryRepository, {
      sortableColumns: ['name', 'createdAt'],
      searchableColumns: ['name', 'description'],
      defaultSortBy: [['name', 'ASC']],
      filterableColumns: {
        name: [FilterOperator.EQ, FilterOperator.CONTAINS],
      },
    });
  }

  /**
   * Obtient une catégorie par son ID
   */
  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return category;
  }

  /**
   * Crée les catégories initiales de base
   */
  async createInitialCategories(): Promise<Category[]> {
    const existingCategories = await this.categoryRepository.find();
    if (existingCategories.length > 0) {
      // Des catégories existent déjà, on ne fait rien
      return existingCategories;
    }

    // Catégories précises pour les aliments, en cohérence avec les produits seeds et les futures recettes
    const categories = [
      {
        name: 'Pâtes Penne',
        description: 'Pâtes de type penne',
        iconUrl: 'https://example.com/icons/pasta.png',
      },
      {
        name: 'Yaourt nature',
        description: 'Yaourt nature au lait entier ou demi-écrémé',
        iconUrl: 'https://example.com/icons/yogurt.png',
      },
      {
        name: 'Filet de poulet',
        description: 'Filet de poulet frais ou sous vide',
        iconUrl: 'https://example.com/icons/chicken.png',
      },
      {
        name: 'Saumon',
        description: 'Saumon frais ou fumé',
        iconUrl: 'https://example.com/icons/salmon.png',
      },
      {
        name: 'Tomate',
        description: 'Tomates fraîches ou en conserve',
        iconUrl: 'https://example.com/icons/tomato.png',
      },
      {
        name: 'Pomme Golden',
        description: 'Pommes Golden de France',
        iconUrl: 'https://example.com/icons/apple.png',
      },
      {
        name: "Huile d'olive vierge extra",
        description: "Huile d'olive vierge extra de première pression à froid",
        iconUrl: 'https://example.com/icons/olive-oil.png',
      },
      {
        name: 'Thon au naturel',
        description: 'Thon albacore ou listao au naturel',
        iconUrl: 'https://example.com/icons/tuna.png',
      },
      // Ajoute d'autres catégories précises au besoin pour tes futures recettes
    ];

    const createdCategories: Category[] = [];
    for (const categoryData of categories) {
      const category = this.categoryRepository.create(categoryData);
      createdCategories.push(await this.categoryRepository.save(category));
    }

    return createdCategories;
  }
}
