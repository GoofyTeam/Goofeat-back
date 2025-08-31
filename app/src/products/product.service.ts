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

      const productToSave = this.productRepository.create(productData);
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
        console.warn('Erreur recherche OpenFoodFacts:', error);
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
        console.warn('Erreur sauvegarde produit OFF:', error);
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
