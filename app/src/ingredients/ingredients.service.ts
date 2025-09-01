import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async findOneByOffTag(offTag: string): Promise<Ingredient | null> {
    return this.ingredientRepository.findOne({ where: { offTag } });
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id },
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingrédient avec l'ID ${id} non trouvé`);
    }

    return ingredient;
  }

  async searchIngredients(search?: string, limit = 10): Promise<Ingredient[]> {
    const queryBuilder = this.ingredientRepository
      .createQueryBuilder('ingredient')
      .take(limit);

    if (search && search.trim()) {
      const searchTerm = search.trim();
      queryBuilder.where(
        '(ingredient.name ILIKE :search OR ingredient.nameFr ILIKE :search OR ingredient.nameEn ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    return queryBuilder.orderBy('ingredient.name', 'ASC').getMany();
  }

  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    // Générer automatiquement les noms manquants
    const nameFr = createIngredientDto.nameFr || createIngredientDto.name;
    const nameEn = createIngredientDto.nameEn || createIngredientDto.name;

    // Générer un tag OFF basique si manquant
    const offTag =
      createIngredientDto.offTag ||
      `manual:${createIngredientDto.name.toLowerCase().replace(/\s+/g, '-')}`;

    const ingredient = this.ingredientRepository.create({
      ...createIngredientDto,
      nameFr,
      nameEn,
      offTag,
    });

    return this.ingredientRepository.save(ingredient);
  }
}
