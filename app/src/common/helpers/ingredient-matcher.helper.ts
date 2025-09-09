/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

const Fuse = require('fuse.js');

export interface IngredientMatchResult {
  ingredient: Ingredient | null;
  score: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

@Injectable()
export class IngredientMatcherHelper {
  private fuse: any;
  private allIngredients: Ingredient[] = [];

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async initializeFuse(): Promise<void> {
    if (this.allIngredients.length === 0) {
      this.allIngredients = await this.ingredientRepository.find();
    }

    this.fuse = new Fuse(this.allIngredients, {
      keys: [
        { name: 'name', weight: 1.0 },
        { name: 'nameFr', weight: 0.9 },
        { name: 'nameEn', weight: 0.8 },
      ],
      threshold: 0.3,
      distance: 50,
      includeScore: true,
      minMatchCharLength: 3,
    });
  }

  private readonly synonyms: Record<string, string[]> = {
    œuf: [
      'œufs',
      'oeuf',
      'oeufs',
      "blanc d'œuf",
      "jaune d'œuf",
      "blanc d'oeuf",
      "jaune d'oeuf",
    ],
    pâtes: [
      'pâte',
      'penne',
      'spaghetti',
      'macaroni',
      'fusilli',
      'tagliatelles',
      'canneloni',
      'lasagne',
    ],
    riz: [
      'riz basmati',
      'riz blanc',
      'riz complet',
      'alcool de riz',
      'riz arborio',
    ],
    fromage: [
      'fromage râpé',
      'parmesan',
      'gruyère',
      'emmental',
      'abondance',
      'cheddar',
    ],
    bœuf: [
      'bœuf haché',
      "bœuf nourri à l'herbe",
      'steak',
      'entrecôte',
      'rumsteck',
    ],
    poulet: [
      'blanc de poulet',
      'cuisse de poulet',
      'filet de poulet',
      'escalope de poulet',
    ],
    oignon: ['oignons', 'oignon blanc', 'oignon rouge', 'échalote'],
    tomate: [
      'tomates fraîches',
      'tomate cerise',
      'tomate en conserve',
      'coulis de tomate',
    ],
    huile: ["huile d'olive", 'huile de tournesol', 'huile de colza'],
  };

  async findBestMatch(searchName: string): Promise<IngredientMatchResult> {
    if (!this.fuse) {
      await this.initializeFuse();
    }

    if (!searchName || searchName.trim().length < 2) {
      return {
        ingredient: null,
        score: null,
        confidence: 'none',
      };
    }

    const normalizedSearch = searchName.trim().toLowerCase();

    const synonymResult = this.findUsingSynonyms(normalizedSearch);
    if (synonymResult.ingredient) {
      return synonymResult;
    }

    const results = this.fuse.search(normalizedSearch);

    if (results.length === 0) {
      return {
        ingredient: null,
        score: null,
        confidence: 'none',
      };
    }

    const bestMatch = results[0];
    const score = bestMatch.score;

    let confidence: 'high' | 'medium' | 'low' | 'none';
    if (score <= 0.05) confidence = 'high';
    else if (score <= 0.15) confidence = 'medium';
    else if (score <= 0.3) confidence = 'low';
    else confidence = 'none';

    return {
      ingredient: confidence === 'none' ? null : bestMatch.item,
      score,
      confidence,
    };
  }

  private findUsingSynonyms(searchName: string): IngredientMatchResult {
    for (const [baseIngredient, synonyms] of Object.entries(this.synonyms)) {
      const exactMatch = synonyms.find(
        (synonym) =>
          synonym.toLowerCase() === searchName ||
          searchName === synonym.toLowerCase(),
      );

      if (exactMatch) {
        const ingredient = this.allIngredients.find(
          (ing) =>
            ing.name?.toLowerCase() === baseIngredient ||
            ing.nameFr?.toLowerCase() === baseIngredient ||
            ing.nameEn?.toLowerCase() === baseIngredient ||
            ing.name?.toLowerCase().includes(baseIngredient) ||
            ing.nameFr?.toLowerCase().includes(baseIngredient) ||
            ing.nameEn?.toLowerCase().includes(baseIngredient),
        );

        if (ingredient) {
          return {
            ingredient,
            score: 0.001,
            confidence: 'high',
          };
        }
      }
    }

    return {
      ingredient: null,
      score: null,
      confidence: 'none',
    };
  }

  async findMultipleMatches(
    searchName: string,
    limit: number = 5,
  ): Promise<IngredientMatchResult[]> {
    if (!this.fuse) {
      await this.initializeFuse();
    }

    if (!searchName || searchName.trim().length < 2) {
      return [];
    }

    const results = this.fuse.search(searchName.trim()).slice(0, limit);

    return results
      .map((result: any) => {
        const score = result.score;
        let confidence: 'high' | 'medium' | 'low' | 'none';

        if (score <= 0.05) confidence = 'high';
        else if (score <= 0.15) confidence = 'medium';
        else if (score <= 0.3) confidence = 'low';
        else confidence = 'none';

        return {
          ingredient: confidence === 'none' ? null : result.item,
          score,
          confidence,
        };
      })
      .filter((result) => result.ingredient !== null);
  }

  async findExactMatch(searchName: string): Promise<Ingredient | null> {
    const trimmedName = searchName.trim().toLowerCase();

    return await this.ingredientRepository
      .createQueryBuilder('ingredient')
      .where('LOWER(ingredient.name) = :name', { name: trimmedName })
      .orWhere('LOWER(ingredient.nameFr) = :name', { name: trimmedName })
      .orWhere('LOWER(ingredient.nameEn) = :name', { name: trimmedName })
      .getOne();
  }

  async refreshIngredients(): Promise<void> {
    this.allIngredients = await this.ingredientRepository.find();
    if (this.fuse) {
      await this.initializeFuse();
    }
  }

  async findIngredient(searchName: string): Promise<IngredientMatchResult> {
    const exactMatch = await this.findExactMatch(searchName);
    if (exactMatch) {
      return {
        ingredient: exactMatch,
        score: 0,
        confidence: 'high',
      };
    }

    return await this.findBestMatch(searchName);
  }
}
