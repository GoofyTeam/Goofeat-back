import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Command, CommandRunner, Option } from 'nest-commander';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Repository } from 'typeorm';
interface ImportIngredientsOptions {
  limit?: number;
  force?: boolean;
}
interface OffIngredientData {
  name?: {
    fr?: string;
    en?: string;
  };
  wikidata?: {
    en?: string;
  };
  parents?: string[];
}
interface OffTaxonomy {
  [offTag: string]: OffIngredientData;
}
@Injectable()
@Command({
  name: 'import:ingredients',
  description: 'Import ingredients from OpenFoodFacts taxonomy',
})
export class ImportIngredientsCommand extends CommandRunner {
  private readonly TAXONOMY_URL =
    'https://world.openfoodfacts.org/data/taxonomies/ingredients.json';
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {
    super();
  }
  async run(
    passedParams: string[],
    options?: ImportIngredientsOptions,
  ): Promise<void> {
    console.log('Import des ingrédients depuis OpenFoodFacts...');
    try {
      console.log('Téléchargement taxonomie...');
      const response = await axios.get<OffTaxonomy>(this.TAXONOMY_URL);
      const data = response.data;
      const seen = new Set<string>();
      let count = 0;
      let processed = 0;
      const entries = Object.entries(data);
      const totalEntries = options?.limit || entries.length;
      console.log(`Traitement de ${totalEntries} entrées...`);
      for (const [offTagRaw, ingredientDataRaw] of entries) {
        if (options?.limit && processed >= options.limit) {
          console.log(`Limite atteinte: ${options.limit}`);
          break;
        }
        processed++;
        const cleanedOffTag = offTagRaw.replace(/\s+/g, '').trim();
        if (!cleanedOffTag) continue;
        if (seen.has(cleanedOffTag)) {
          console.warn('Doublon OFF ignoré:', cleanedOffTag);
          continue;
        }
        seen.add(cleanedOffTag);
        // Vérifier si l'ingrédient existe déjà (sauf si force)
        if (!options?.force) {
          const existing = await this.ingredientRepository.findOne({
            where: { offTag: cleanedOffTag },
          });
          if (existing) {
            console.log(`Ingrédient existant ignoré: ${cleanedOffTag}`);
            continue;
          }
        }
        const nameFr =
          ingredientDataRaw.name?.fr ||
          ingredientDataRaw.name?.en ||
          cleanedOffTag;
        const nameEn =
          ingredientDataRaw.name?.en ||
          ingredientDataRaw.name?.fr ||
          cleanedOffTag;
        const wikidata = ingredientDataRaw.wikidata?.en || undefined;
        const parentOffTags = ingredientDataRaw.parents || undefined;
        const ingredient = this.ingredientRepository.create({
          offTag: cleanedOffTag,
          nameFr,
          nameEn,
          wikidata,
          parentOffTags,
          name: nameFr,
        });
        try {
          await this.ingredientRepository.save(ingredient);
          count++;
          if (count % 100 === 0) {
            console.log(`${count} ingrédients importés...`);
          }
        } catch (err) {
          console.error(
            'Erreur insertion:',
            cleanedOffTag,
            err instanceof Error ? err.message : err,
          );
        }
      }
      console.log(`Import terminé: ${count}/${processed} ingrédients traités`);
    } catch (error) {
      console.error('Erreur import:', error);
      throw error;
    }
  }
  @Option({
    flags: '-l, --limit <number>',
    description: 'Limit number of ingredients to import',
  })
  parseLimit(val: string): number {
    return Number(val);
  }
  @Option({
    flags: '-f, --force',
    description: 'Force reimport existing ingredients',
  })
  parseForce(): boolean {
    return true;
  }
}
