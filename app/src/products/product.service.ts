/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';
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
    @Inject('PRODUCT_DATA_SERVICE')
    private readonly productDataService: ProductDataService,
  ) {}

  async create(createProductDto: CreateProductDto, user?: User) {
    // Création d'un nouveau produit
    const productData: any = { ...createProductDto };

    // Associer à l'utilisateur si c'est un produit manuel (sans code-barres)
    if (!createProductDto.code && user?.id) {
      productData.createdBy = user.id;
    }

    const product = this.productRepository.create(productData);
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

    // Pagination
    if (filterDto.limit) {
      queryBuilder.take(filterDto.limit);
    }
    if (filterDto.offset) {
      queryBuilder.skip(filterDto.offset);
    }

    // Tri par défaut
    queryBuilder.orderBy('product.createdAt', 'DESC');

    return queryBuilder.getMany();
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
