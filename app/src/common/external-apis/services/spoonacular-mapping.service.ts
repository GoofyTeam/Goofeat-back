/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IngredientMatcherHelper } from 'src/common/helpers/ingredient-matcher.helper';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Repository } from 'typeorm';
import { SpoonacularIngredientMapping } from '../entities/spoonacular-ingredient-mapping.entity';

export interface SpoonacularIngredient {
  id: number;
  name: string;
  image?: string;
  aisle?: string;
  amount?: number;
  unit?: string;
  measures?: {
    metric?: { amount: number; unitLong: string };
    us?: { amount: number; unitLong: string };
  };
}

export interface MappingResult {
  ingredient: Ingredient | null;
  mapping: SpoonacularIngredientMapping | null;
  confidence: number;
  mappingType: 'cached' | 'exact_match' | 'fuzzy_match' | 'not_found';
}

@Injectable()
export class SpoonacularMappingService {
  private readonly logger = new Logger(SpoonacularMappingService.name);

  constructor(
    @InjectRepository(SpoonacularIngredientMapping)
    private readonly mappingRepository: Repository<SpoonacularIngredientMapping>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly ingredientMatcher: IngredientMatcherHelper,
  ) {}

  async findMapping(
    spoonacularIngredient: SpoonacularIngredient,
  ): Promise<MappingResult> {
    const { id, name } = spoonacularIngredient;

    // Check cache first
    const cachedMapping = await this.mappingRepository.findOne({
      where: { spoonacularId: id },
      relations: ['ingredient'],
    });

    if (cachedMapping) {
      await this.mappingRepository.increment(
        { id: cachedMapping.id },
        'usageCount',
        1,
      );

      return {
        ingredient: cachedMapping.ingredient,
        mapping: cachedMapping,
        confidence: cachedMapping.confidenceScore,
        mappingType: 'cached',
      };
    }

    const exactMatch = await this.findExactMatch(name);
    if (exactMatch) {
      const mapping = await this.createMapping(
        spoonacularIngredient,
        exactMatch,
        100,
        'exact_match',
      );
      return {
        ingredient: exactMatch,
        mapping,
        confidence: 100,
        mappingType: 'exact_match',
      };
    }

    const fuzzyMatch = await this.findFuzzyMatch(name);
    if (fuzzyMatch.ingredient && fuzzyMatch.confidence >= 80) {
      const mapping = await this.createMapping(
        spoonacularIngredient,
        fuzzyMatch.ingredient,
        fuzzyMatch.confidence,
        'fuzzy_match',
      );
      return {
        ingredient: fuzzyMatch.ingredient,
        mapping,
        confidence: fuzzyMatch.confidence,
        mappingType: 'fuzzy_match',
      };
    }

    this.logger.warn(
      `Aucun mapping trouvé pour l'ingrédient Spoonacular: ${name} (ID: ${id})`,
    );

    return {
      ingredient: null,
      mapping: null,
      confidence: 0,
      mappingType: 'not_found',
    };
  }

  private async findExactMatch(
    spoonacularName: string,
  ): Promise<Ingredient | null> {
    const normalizedName = this.normalizeIngredientName(spoonacularName);

    const ingredient = await this.ingredientRepository
      .createQueryBuilder('ingredient')
      .where(
        'LOWER(ingredient.name) = LOWER(:name) OR LOWER(ingredient.nameFr) = LOWER(:name) OR LOWER(ingredient.nameEn) = LOWER(:name)',
        { name: normalizedName },
      )
      .getOne();

    return ingredient;
  }

  private async findFuzzyMatch(spoonacularName: string): Promise<{
    ingredient: Ingredient | null;
    confidence: number;
  }> {
    const normalizedName = this.normalizeIngredientName(spoonacularName);

    const matchResult =
      await this.ingredientMatcher.findBestMatch(normalizedName);

    if (matchResult.ingredient && matchResult.confidence !== 'none') {
      let confidencePercentage = 0;
      switch (matchResult.confidence) {
        case 'high':
          confidencePercentage = 95;
          break;
        case 'medium':
          confidencePercentage = 85;
          break;
        case 'low':
          confidencePercentage = 70;
          break;
      }

      this.logger.log(
        `Spoonacular mapping: "${spoonacularName}" -> "${matchResult.ingredient.name}" (confidence: ${matchResult.confidence}, score: ${matchResult.score?.toFixed(3)})`,
      );

      return {
        ingredient: matchResult.ingredient,
        confidence: confidencePercentage,
      };
    }

    this.logger.warn(
      `Spoonacular mapping: Aucun match fiable pour "${spoonacularName}" (score: ${matchResult.score?.toFixed(3)})`,
    );

    return { ingredient: null, confidence: 0 };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    if (str1.includes(str2) || str2.includes(str1)) {
      return (
        Math.max(str2.length / str1.length, str1.length / str2.length) * 0.9
      );
    }

    const words1 = str1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = str2.split(/\s+/).filter((w) => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const commonWords = words1.filter((w) =>
      words2.some((w2) => w2.includes(w) || w.includes(w2)),
    );
    const similarity =
      commonWords.length / Math.max(words1.length, words2.length);

    return similarity;
  }

  private async createMapping(
    spoonacularIngredient: SpoonacularIngredient,
    ingredient: Ingredient,
    confidence: number,
    mappingType: 'exact_match' | 'fuzzy_match' | 'manual' | 'synonym',
  ): Promise<SpoonacularIngredientMapping> {
    const mapping = this.mappingRepository.create({
      spoonacularId: spoonacularIngredient.id,
      spoonacularName: spoonacularIngredient.name,
      ingredientId: ingredient.id,
      ingredient,
      confidenceScore: confidence,
      mappingType,
      usageCount: 1,
      metadata: {
        originalSpoonacularData: {
          name: spoonacularIngredient.name,
          image: spoonacularIngredient.image,
          aisle: spoonacularIngredient.aisle,
        },
      },
    });

    const savedMapping = await this.mappingRepository.save(mapping);
    this.logger.log(
      `Nouveau mapping créé: ${spoonacularIngredient.name} -> ${ingredient.name} (${confidence}% confidence)`,
    );

    return savedMapping;
  }

  async createManualMapping(
    spoonacularId: number,
    spoonacularName: string,
    ingredientId: string,
  ): Promise<SpoonacularIngredientMapping> {
    const ingredient = await this.ingredientRepository.findOne({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      throw new Error(`Ingrédient avec l'ID ${ingredientId} non trouvé`);
    }

    const mapping = await this.createMapping(
      { id: spoonacularId, name: spoonacularName },
      ingredient,
      100,
      'manual',
    );

    mapping.isValidated = true;
    return this.mappingRepository.save(mapping);
  }

  async validateMapping(
    mappingId: string,
  ): Promise<SpoonacularIngredientMapping> {
    const mapping = await this.mappingRepository.findOne({
      where: { id: mappingId },
    });

    if (!mapping) {
      throw new Error(`Mapping avec l'ID ${mappingId} non trouvé`);
    }

    mapping.isValidated = true;
    return this.mappingRepository.save(mapping);
  }

  private normalizeIngredientName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(
        /\b(fresh|dried|ground|chopped|sliced|diced|minced|organic|raw)\b/g,
        '',
      )
      .replace(/\b\d+\s*(cup|cups|tbsp|tsp|oz|lb|g|kg|ml|l)\b/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getMappingStats(): Promise<{
    total: number;
    validated: number;
    byType: Record<string, number>;
    avgConfidence: number;
  }> {
    const [total, validated, byTypeRaw, avgConfidenceRaw] = await Promise.all([
      this.mappingRepository.count(),
      this.mappingRepository.count({ where: { isValidated: true } }),
      this.mappingRepository
        .createQueryBuilder('mapping')
        .select('mapping.mappingType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('mapping.mappingType')
        .getRawMany(),
      this.mappingRepository
        .createQueryBuilder('mapping')
        .select('AVG(mapping.confidenceScore)', 'avgConfidence')
        .getRawOne(),
    ]);

    const byType: Record<string, number> = {};
    byTypeRaw.forEach((item) => {
      byType[item.type] = parseInt(item.count);
    });

    return {
      total,
      validated,
      byType,
      avgConfidence: parseFloat(avgConfidenceRaw?.avgConfidence || '0'),
    };
  }

  async getUnvalidatedMappings(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    mappings: SpoonacularIngredientMapping[];
    total: number;
  }> {
    const [mappings, total] = await this.mappingRepository.findAndCount({
      where: { isValidated: false },
      relations: ['ingredient'],
      order: { usageCount: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { mappings, total };
  }
}
