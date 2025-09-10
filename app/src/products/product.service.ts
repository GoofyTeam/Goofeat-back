/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { User } from 'src/users/entity/user.entity';
import { In, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto, ProductTypeFilter } from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductDataService } from './lib/product-data.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @Inject('PRODUCT_DATA_SERVICE')
    private readonly productDataService: ProductDataService,
  ) {}

  async create(createProductDto: CreateProductDto, user?: User) {
    // Gérer les ingrédients si fournis
    let ingredients: Ingredient[] = [];
    if (
      createProductDto.ingredients &&
      createProductDto.ingredients.length > 0
    ) {
      ingredients = await this.ingredientRepository.find({
        where: { id: In(createProductDto.ingredients) },
      });
      if (ingredients.length !== createProductDto.ingredients.length) {
        throw new NotFoundException(
          "Certains ingrédients spécifiés n'ont pas été trouvés",
        );
      }
    }

    // Préparer les données du produit sans le champ ingredients
    const { ingredients: _, ...productData } = createProductDto;

    // Associer à l'utilisateur si c'est un produit manuel (sans code-barres)
    if (!createProductDto.code && user?.id) {
      (productData as any).createdBy = user.id;
    }

    const product = this.productRepository.create(productData);
    product.ingredients = ingredients;

    return this.productRepository.save(product);
  }

  /**
   * Crée un produit à partir des données récupérées via le code-barres
   * @param barcode Code-barres du produit à créer
   */
  /**
   * Recherche d'abord le produit en base, sinon création via Open Food Facts
   */
  async createFromBarcode(barcode: string) {
    const existingProduct = await this.productRepository.findOne({
      where: { code: barcode },
      relations: ['ingredients'],
    });

    if (existingProduct) {
      return existingProduct;
    }

    try {
      const productData =
        await this.productDataService.getProductByBarcode(barcode);

      // Matching avec les ingrédients existants basé sur les catégories OFF
      // Catégories OFF trouvées
      const matchedIngredients = await this.matchIngredientsFromCategories(
        productData.categoriesHierarchy || [],
      );
      // Ingrédients matchés trouvés

      const productToSave = this.productRepository.create({
        ...productData,
        ingredients: matchedIngredients,
      });
      await this.productRepository.save(productToSave);
      return this.productRepository.findOne({
        where: { code: barcode },
        relations: ['ingredients'],
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(
        `Impossible de créer le produit à partir du code-barres ${barcode}: ${errorMessage}`,
      );
    }
  }

  async findAll(filterDto: Partial<FilterProductDto> = {}, user?: User) {
    // 1. Recherche locale d'abord
    const localResults = await this.searchLocal(filterDto, user);

    // 2. Décider si chercher dans OpenFoodFacts avec garde-fous
    if (this.shouldSearchOpenFoodFacts(localResults, filterDto)) {
      try {
        // 3. Recherche OpenFoodFacts et populate
        const externalResults = await this.searchAndPopulateFromOFF(filterDto);

        // 4. Fusionner les résultats (locale en premier, puis OFF)
        return this.mergeResults(localResults, externalResults);
      } catch (error) {
        // En cas d'erreur OFF, retourner les résultats locaux
        // Erreur OpenFoodFacts, utilisation cache local
        return localResults;
      }
    }

    return localResults;
  }

  private async searchLocal(filterDto: Partial<FilterProductDto>, user?: User) {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.creator', 'creator')
      .leftJoinAndSelect('product.ingredients', 'ingredients');

    // Recherche par nom
    if (filterDto.search) {
      queryBuilder.andWhere('LOWER(product.name) LIKE LOWER(:search)', {
        search: `%${filterDto.search}%`,
      });
    }

    // Recherche par code-barres exact
    if (filterDto.code) {
      queryBuilder.andWhere('product.code = :code', { code: filterDto.code });
    }

    // Filtrer par type de produit
    if (filterDto.type && filterDto.type !== ProductTypeFilter.ALL) {
      if (filterDto.type === ProductTypeFilter.BARCODE) {
        queryBuilder.andWhere('product.code IS NOT NULL');
      } else if (filterDto.type === ProductTypeFilter.MANUAL) {
        queryBuilder.andWhere('product.code IS NULL');
      }
    }

    // Filtrer uniquement les produits de l'utilisateur (pour les produits manuels)
    if (filterDto.onlyMyProducts && user) {
      queryBuilder.andWhere(
        '(product.createdBy = :userId OR product.code IS NOT NULL)',
        { userId: user.id },
      );
    }

    // Pagination pour résultats locaux seulement
    const localLimit = filterDto.limit ? Math.min(filterDto.limit, 10) : 10;
    queryBuilder.take(localLimit);

    if (filterDto.offset) {
      queryBuilder.skip(filterDto.offset);
    }

    // Tri par défaut
    queryBuilder.orderBy('product.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  private shouldSearchOpenFoodFacts(
    localResults: Product[],
    filterDto: Partial<FilterProductDto>,
  ): boolean {
    // Garde-fous : ne pas chercher dans OFF si :

    // 1. Pas de terme de recherche textuel
    if (!filterDto.search || filterDto.search.length < 3) {
      return false;
    }

    // 2. Recherche par code-barres exact (déjà géré par endpoint dédié)
    if (filterDto.code) {
      return false;
    }

    // 3. Filtrage sur produits manuels uniquement
    if (filterDto.type === ProductTypeFilter.MANUAL) {
      return false;
    }

    // 4. Filtrage sur "mes produits" uniquement
    if (filterDto.onlyMyProducts) {
      return false;
    }

    // 5. Résultats locaux déjà suffisants (seuil configurable)
    const minResultsThreshold = 5;
    if (localResults.length >= minResultsThreshold) {
      return false;
    }

    // 6. Pagination avec offset (ne chercher OFF que sur la première page)
    if (filterDto.offset && filterDto.offset > 0) {
      return false;
    }

    return true;
  }

  private async searchAndPopulateFromOFF(
    filterDto: Partial<FilterProductDto>,
  ): Promise<Product[]> {
    if (!filterDto.search) return [];

    // Limiter la recherche OFF (coût réseau)
    const offLimit = Math.min(filterDto.limit || 10, 15);

    const externalProducts = await this.productDataService.searchProductsByName(
      filterDto.search,
      offLimit,
    );

    const savedProducts: Product[] = [];

    for (const productData of externalProducts) {
      try {
        // Vérifier si le produit existe déjà (par code-barres)
        if (productData.barcode) {
          const existing = await this.productRepository.findOne({
            where: { code: productData.barcode },
          });

          if (existing) {
            savedProducts.push(existing);
            continue;
          }
        }

        // Créer et sauvegarder le nouveau produit
        const newProduct = this.productRepository.create(productData);
        const saved = await this.productRepository.save(newProduct);
        savedProducts.push(saved);
      } catch (error) {
        // Continue avec les autres produits en cas d'erreur
        // Erreur lors de la sauvegarde du produit
      }
    }

    return savedProducts;
  }

  private mergeResults(
    localResults: Product[],
    externalResults: Product[],
  ): Product[] {
    // Créer un Map pour éviter les doublons (par code-barres ou nom)
    const resultMap = new Map<string, Product>();

    // Ajouter les résultats locaux en priorité
    localResults.forEach((product) => {
      const key = product.code || product.name.toLowerCase();
      resultMap.set(key, product);
    });

    // Ajouter les résultats externes s'ils n'existent pas déjà
    externalResults.forEach((product) => {
      const key = product.code || product.name.toLowerCase();
      if (!resultMap.has(key)) {
        resultMap.set(key, product);
      }
    });

    return Array.from(resultMap.values());
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Produit avec l'ID ${id} non trouvé`);
    }

    return product;
  }

  /**
   * Recherche des produits par nom via l'API externe
   * @param name Nom du produit à rechercher
   * @param limit Nombre maximum de résultats
   */
  async searchExternalProducts(name: string, limit = 10) {
    return this.productDataService.searchProductsByName(name, limit);
  }

  /**
   * Trouve un produit par son code-barres
   */
  async findByBarcode(barcode: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { code: barcode },
      relations: ['categories', 'ingredients'],
    });
  }

  /**
   * Récupère tous les produits pour le matching OCR
   */
  async findAllForMatching(): Promise<Product[]> {
    return this.productRepository.find({
      select: ['id', 'name'],
    });
  }

  /**
   * Match les catégories OpenFoodFacts avec les ingrédients existants
   * IMPORTANT: Cette fonction implémente un matching taxonomique hiérarchique.
   * Elle ne lie que l'ingrédient le plus générique pour éviter le sur-comptage
   * dans les suggestions de recettes.
   *
   * Exemple: Bouteille d'eau → seulement "eau" (pas "eau minérale" + "eau de source")
   *
   * @param categoriesHierarchy Liste des catégories OFF du produit (ordre du plus général au plus spécifique)
   */
  private async matchIngredientsFromCategories(
    categoriesHierarchy: string[],
  ): Promise<Ingredient[]> {
    if (!categoriesHierarchy || categoriesHierarchy.length === 0) {
      return [];
    }

    // Convertir les catégories plurielles en tags d'ingrédients singuliers
    const ingredientTags =
      this.convertCategoriesToIngredientTags(categoriesHierarchy);
    // Conversion catégories vers tags ingrédients

    if (ingredientTags.length === 0) {
      return [];
    }

    // Chercher des ingrédients dont l'off_tag match une des catégories converties
    const allMatchingIngredients = await this.ingredientRepository.find({
      where: ingredientTags.map((tag) => ({
        offTag: tag,
      })),
    });

    // RÈGLE ANTI-SUR-COMPTAGE : Ne garder que l'ingrédient le plus générique
    // pour éviter qu'un produit compte plusieurs fois dans les recettes
    const prioritizedIngredient = this.selectMostGenericIngredient(
      allMatchingIngredients,
    );
    const result = prioritizedIngredient ? [prioritizedIngredient] : [];

    // Ingrédient générique sélectionné

    return result;
  }

  /**
   * Convertit les catégories de produits OFF (plurielles) en tags d'ingrédients (singuliers)
   * @param categories Liste des catégories de produits OFF
   */
  private convertCategoriesToIngredientTags(categories: string[]): string[] {
    const conversionMap: { [key: string]: string | null } = {
      // Beverages and preparations -> not directly mappable to ingredient
      'en:beverages-and-beverages-preparations': null,
      'en:beverages': null, // Too generic
      'en:unsweetened-beverages': null, // Too generic

      // Water categories - convert plural to singular
      'en:waters': 'en:water',
      'en:spring-waters': 'en:spring-water',
      'en:mineral-waters': 'en:mineral-water',
      'en:natural-mineral-waters': 'en:natural-mineral-water',

      // Add more mappings as needed
    };

    const convertedTags: string[] = [];

    for (const category of categories) {
      if (Object.hasOwn(conversionMap, category)) {
        const converted = conversionMap[category];
        if (converted) {
          convertedTags.push(converted);
        }
        // If conversion is null, we skip this category (too generic or unmappable)
      } else {
        // If no mapping exists, try the category as-is (might already be correct)
        convertedTags.push(category);
      }
    }

    return [...new Set(convertedTags)]; // Remove duplicates
  }

  /**
   * Sélectionne l'ingrédient le plus générique parmi une liste d'ingrédients matchés
   * pour éviter le sur-comptage dans les suggestions de recettes.
   *
   * LOGIQUE DE PRIORITÉ (du plus générique au plus spécifique):
   * 1. "water" (eau) > "mineral-water" (eau minérale) > "natural-mineral-water"
   * 2. "flour" (farine) > "wheat-flour" (farine de blé) > "whole-wheat-flour"
   *
   * @param ingredients Liste des ingrédients matchés
   * @returns L'ingrédient le plus générique ou null si liste vide
   */
  private selectMostGenericIngredient(
    ingredients: Ingredient[],
  ): Ingredient | null {
    if (!ingredients || ingredients.length === 0) {
      return null;
    }

    if (ingredients.length === 1) {
      return ingredients[0];
    }

    // Système de score : plus le score est bas, plus l'ingrédient est générique
    const genericityScores: { [key: string]: number } = {
      // Eau (scores croissants = plus spécifique)
      'en:water': 1,
      'en:spring-water': 2,
      'en:mineral-water': 2,
      'en:natural-mineral-water': 3,
      'en:carbonated-water': 2,
      'en:distilled-water': 2,

      // Farine
      'en:flour': 1,
      'en:wheat-flour': 2,
      'en:whole-wheat-flour': 3,
      'en:all-purpose-flour': 2,

      // Lait
      'en:milk': 1,
      'en:cow-milk': 2,
      'en:whole-milk': 3,
      'en:skimmed-milk': 3,

      // Score par défaut pour les tags inconnus (considérés comme génériques)
    };

    let mostGeneric = ingredients[0];
    let lowestScore = genericityScores[ingredients[0].offTag] || 5; // Score par défaut

    for (const ingredient of ingredients) {
      const score = genericityScores[ingredient.offTag] || 5;
      if (score < lowestScore) {
        lowestScore = score;
        mostGeneric = ingredient;
      }
    }

    // Sélection générique parmi plusieurs ingrédients

    return mostGeneric;
  }

  async update(id: string, updateProductDto: UpdateProductDto, user?: User) {
    const product = await this.findOne(id);

    // Vérifier les permissions pour les produits manuels
    if (product.createdBy && user) {
      if (product.createdBy !== user.id) {
        throw new ForbiddenException(
          'Vous ne pouvez modifier que vos propres produits',
        );
      }
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: string, user?: User) {
    const product = await this.findOne(id);

    // Vérifier les permissions pour les produits manuels
    if (product.createdBy && user) {
      if (product.createdBy !== user.id) {
        throw new ForbiddenException(
          'Vous ne pouvez supprimer que vos propres produits',
        );
      }
    }

    return this.productRepository.remove(product);
  }
}
