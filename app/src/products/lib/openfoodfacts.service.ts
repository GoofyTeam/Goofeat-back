/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { APIResponse, OFF as OFFClass } from 'openfoodfacts-nodejs';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Repository } from 'typeorm';
import { ProductData, ProductDataService } from './product-data.interface';
const OFF = require('openfoodfacts-nodejs');

@Injectable()
export class OpenFoodFactsService implements ProductDataService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly client: OFFClass;

  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {
    this.client = new OFF() as OFFClass;
  }

  /**
   * Récupère les informations d'un produit par son code-barres
   * @param barcode Code-barres du produit
   */
  async getProductByBarcode(barcode: string): Promise<ProductData> {
    try {
      const response = await this.client.getProduct(barcode);

      if (!response || !response.product) {
        throw new Error(`Produit non trouvé avec le code-barres ${barcode}`);
      }

      return this.mapToProductData(response.product);
    } catch (error: unknown) {
      this.logger.error(
        `Erreur lors de la récupération du produit ${barcode}`,
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Recherche des produits par nom
   * @param name Nom du produit à rechercher
   * @param limit Nombre maximum de résultats (par défaut 10)
   */
  async searchProductsByName(name: string, limit = 10): Promise<ProductData[]> {
    try {
      const brandResult = await this.client.getBrand(name);

      if (
        !brandResult ||
        !brandResult.products ||
        brandResult.products.length === 0
      ) {
        this.logger.warn(`Aucun produit trouvé pour la marque ${name}`);
        return [];
      }

      // Limiter le nombre de résultats
      const limitedProducts = brandResult.products.slice(0, limit);

      // Mapper chaque produit vers notre format ProductData (async)
      const mappedProducts = await Promise.all(
        limitedProducts.map((product) =>
          product ? this.mapToProductData(product) : null,
        ),
      );
      return mappedProducts.filter(
        (product): product is ProductData => product !== null,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Erreur lors de la recherche de produits avec le nom ${name}`,
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Transforme les données d'OpenFoodFacts en format ProductData
   * @param openFoodFactsProduct Produit provenant de l'API OpenFoodFacts (peut être de type Product ou ProductsEntity)
   */
  /**
   * Transforme les données d'OpenFoodFacts en format ProductData conforme à notre modèle
   * - mappe le code-barres dans id ET code
   * - tente de lier l'ingrédient par tag OFF ou nom (si service disponible)
   */
  private async mapToProductData(
    openFoodFactsProduct: APIResponse.ProductsEntity | APIResponse.Product,
  ): Promise<ProductData> {
    // Assurons-nous que name est toujours défini comme une chaîne
    const name: string = openFoodFactsProduct.product_name || 'Nom inconnu';
    const barcode: string =
      openFoodFactsProduct.code || openFoodFactsProduct._id;

    // Recherche de l'ingrédient correspondant (par offTag ou nom)
    // Nécessite l'accès au repo Ingredient (injection à ajouter au service)
    let ingredientId: string | undefined = undefined;
    if (this.ingredientRepository) {
      // Essayer de trouver par tag OFF
      const offTag = openFoodFactsProduct.ingredients_tags?.[0];
      let ingredient: Ingredient | null = null;
      if (offTag) {
        ingredient = await this.ingredientRepository.findOne({
          where: { offTag },
        });
      }

      // essayer par nom
      if (!ingredient && name) {
        ingredient = await this.ingredientRepository.findOne({
          where: [{ nameFr: name }, { nameEn: name }, { name: name }],
        });
      }
      if (ingredient) {
        ingredientId = ingredient.id;
      }
    }

    return {
      id: barcode, // code-barres = clé primaire
      code: barcode,
      name,
      description: openFoodFactsProduct.ingredients_text || '',
      imageUrl:
        openFoodFactsProduct.image_url || openFoodFactsProduct.image_front_url,
      nutriments: openFoodFactsProduct.nutriments,
      ingredientId,
      rawData: openFoodFactsProduct,
      // categories: openFoodFactsProduct.categories,
      // categories_tags: openFoodFactsProduct.categories_tags,
      // categories_properties: openFoodFactsProduct.categories_properties,
      // categories_properties_tags:
      //   openFoodFactsProduct.categories_properties_tags,
    };
  }
}
