import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
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

  async create(createProductDto: CreateProductDto) {
    // Création d'un nouveau produit
    const product = this.productRepository.create(createProductDto);
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
    // 1. Chercher le produit dans la BDD
    const existing = await this.productRepository.findOne({
      where: { id: barcode }, // id = code-barres
    });
    if (existing) {
      return existing;
    }
    // 2. Sinon, récupérer les données via OFF puis créer
    try {
      const productData =
        await this.productDataService.getProductByBarcode(barcode);
      const product = this.productRepository.create(productData);
      const created = await this.productRepository.save(product);
      return this.productRepository.findOne({
        where: { id: created.id },
        relations: ['ingredient'],
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(
        `Impossible de créer le produit à partir du code-barres ${barcode}: ${errorMessage}`,
      );
    }
  }

  async findAll() {
    return this.productRepository.find();
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

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);

    Object.assign(product, updateProductDto);

    return this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    return this.productRepository.remove(product);
  }
}
