/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { APIResponse, OFF as OFFClass } from 'openfoodfacts-nodejs';
import { ProductData, ProductDataService } from './product-data.interface';
const OFF = require('openfoodfacts-nodejs');

@Injectable()
export class OpenFoodFactsService implements ProductDataService {
  private readonly logger = new Logger(OpenFoodFactsService.name);
  private readonly client: OFFClass;

  constructor() {
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

      // Mapper chaque produit vers notre format ProductData
      return limitedProducts
        .map((product) => {
          // Vérifier que le produit est bien un objet valide
          if (!product) {
            this.logger.warn('Produit invalide dans les résultats');
            return null;
          }
          return this.mapToProductData(product);
        })
        .filter((product): product is ProductData => product !== null);
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
  private mapToProductData(
    openFoodFactsProduct: APIResponse.ProductsEntity | APIResponse.Product,
  ): ProductData {
    // Assurons-nous que name est toujours défini comme une chaîne
    const name: string = openFoodFactsProduct.product_name || 'Nom inconnu';

    return {
      code: openFoodFactsProduct.code || openFoodFactsProduct._id,
      name, // Maintenant name est garanti d'être une chaîne
      description: openFoodFactsProduct.ingredients_text || '',
      imageUrl:
        openFoodFactsProduct.image_url || openFoodFactsProduct.image_front_url,
      nutriments: openFoodFactsProduct.nutriments,
      rawData: openFoodFactsProduct,
      // categories: openFoodFactsProduct.categories,
      // categories_tags: openFoodFactsProduct.categories_tags,
      // categories_properties: openFoodFactsProduct.categories_properties,
      // categories_properties_tags:
      //   openFoodFactsProduct.categories_properties_tags,
    };
  }
}
