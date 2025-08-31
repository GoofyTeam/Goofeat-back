/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { APIResponse, OFF as OFFClass } from 'openfoodfacts-nodejs';
import { OpenFoodFactsAnalyzerService } from 'src/common/units/openfoodfacts-analyzer.service';
import { parseQuantity } from 'src/common/units/unit.utils';
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
    private readonly offAnalyzer: OpenFoodFactsAnalyzerService,
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

  private async mapToProductData(
    openFoodFactsProduct: APIResponse.ProductsEntity | APIResponse.Product,
  ): Promise<ProductData> {
    const name: string = openFoodFactsProduct.product_name || 'Nom inconnu';
    const barcode: string =
      openFoodFactsProduct.code || openFoodFactsProduct._id;

    // Recherche des ingrédients correspondants
    const ingredients: Ingredient[] = [];
    if (this.ingredientRepository) {
      const tagsToSearch = [(openFoodFactsProduct as any).food_groups || []];

      const uniqueTags = [...new Set(tagsToSearch)];

      console.log(uniqueTags);
      for (const tag of uniqueTags) {
        const cleanedOffTag = tag.replace(/\s+/g, '').trim();
        const found = await this.ingredientRepository.findOne({
          where: { offTag: cleanedOffTag },
        });

        if (found) {
          console.log(`Ingrédient trouvé via le tag: ${cleanedOffTag}`);
          ingredients.push(found);
        }
      }
    }

    // Analyser les données de packaging avec le nouveau service
    const packagingInfo =
      this.offAnalyzer.analyzeOpenFoodFactsProduct(openFoodFactsProduct);

    if (!packagingInfo) {
      // Fallback sur l'ancien système si l'analyse échoue
      const parsedQuantity = parseQuantity(openFoodFactsProduct.quantity);

      if (parsedQuantity.value === null || parsedQuantity.unit === null) {
        throw new Error(
          `Quantité ou unité invalide pour le produit ${name} (${barcode})`,
        );
      }

      const productData: ProductData = {
        code: barcode,
        name,
        description: openFoodFactsProduct.ingredients_text || '',
        imageUrl:
          openFoodFactsProduct.image_url ||
          openFoodFactsProduct.image_front_url,
        nutriments: openFoodFactsProduct.nutriments,
        ingredients,
        packagingSize: parsedQuantity.value,
        defaultUnit: parsedQuantity.unit,
      };

      return productData;
    }

    // Utiliser les données analysées
    const productData: ProductData = {
      code: barcode,
      name,
      description: openFoodFactsProduct.ingredients_text || '',
      imageUrl:
        openFoodFactsProduct.image_url || openFoodFactsProduct.image_front_url,
      nutriments: openFoodFactsProduct.nutriments,
      ingredients,
      defaultUnit: packagingInfo.totalUnit,

      // Informations de packaging détectées
      ...(packagingInfo.isMultipack
        ? {
            packagingSize: packagingInfo.packagingSize || 1,
            unitSize: packagingInfo.unitSize,
          }
        : {
            // Produit simple
            packagingSize: packagingInfo.totalQuantity || 1,
          }),

      rawData: {
        originalQuantity: openFoodFactsProduct.quantity,
        detectedPackaging: packagingInfo,
        ...openFoodFactsProduct,
      },
    };

    // console.log((openFoodFactsProduct as any).food_groups);
    return productData;
  }
}
