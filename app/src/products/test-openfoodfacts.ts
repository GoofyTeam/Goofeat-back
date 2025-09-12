/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Import correct de la classe OFF
const OFF = require('openfoodfacts-nodejs');
import { APIResponse } from 'openfoodfacts-nodejs';
import { Unit } from 'src/common/units/unit.enums';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { parseQuantity } from '../common/units/unit.utils';
import { ProductData } from './lib/product-data.interface';

/**
 * Script de test pour valider l'intégration avec l'API OpenFoodFacts
 */
async function testOpenFoodFacts() {
  console.log('Démarrage du test OpenFoodFacts...');

  const client = new OFF();

  try {
    // Test de récupération par code-barres (Nutella)
    console.log("Test 1: Récupération d'un produit par code-barres (Nutella)");
    const barcode = '3017620422003';
    const productData = (await client.getProduct(barcode)) as {
      product: APIResponse.Product;
    };

    if (productData?.product) {
      console.log('✅ Produit trouvé:', productData.product.product_name);
      console.log('Code:', productData.product.code);
      console.log('Marque:', productData.product.brands);
      console.log("URL de l'image:", productData.product.image_url);
    } else {
      console.log('❌ Produit non trouvé');
    }

    // Test de recherche par marque (puisque search n'existe pas)
    console.log('\nTest 2: Recherche de produits par marque (Nutella)');
    const searchResult = await client.getBrand('nutella');

    if (searchResult?.products?.length > 0) {
      console.log(`✅ ${searchResult.products.length} produits trouvés`);
      console.log('Premier produit:', searchResult.products[0].product_name);
    } else {
      console.log('❌ Aucun produit trouvé');
    }

    // Test de mappage des données
    console.log('\nTest 3: Mappage des données vers notre format ProductData');
    if (productData?.product) {
      const mappedProduct: ProductData = {
        barcode: productData.product.code || productData.product._id,
        name: productData.product.product_name || 'Nom inconnu',
        description: productData.product.ingredients_text || '',
        imageUrl:
          productData.product.image_url || productData.product.image_front_url,
        nutriments: productData.product.nutriments,
        rawData: productData.product,
        packagingSize: 0,
        defaultUnit: Unit.G,
        ingredients: [
          {
            id: 'temp-ingredient-id',
            nameFr: 'temp-ingredient-id',
            nameEn: 'temp-ingredient-id',
            offTag: 'temp-ingredient-id',
          },
        ] as Ingredient[],
      };

      const parsed = parseQuantity(productData.product.quantity);
      if (parsed.value !== null && parsed.unit !== null) {
        mappedProduct.packagingSize = parsed.value;
        mappedProduct.defaultUnit = parsed.unit;
      } else {
        console.warn(
          `Quantité non reconnue pour ${mappedProduct.name}: ${productData.product.quantity}`,
        );
      }

      console.log('✅ Produit mappé:', mappedProduct.name);
      console.log(
        'Description:',
        mappedProduct.description ? '✅ Présente' : '❌ Absente',
      );
      console.log(
        'Image URL:',
        mappedProduct.imageUrl ? '✅ Présente' : '❌ Absente',
      );
      console.log(
        'Nutriments:',
        mappedProduct.nutriments ? '✅ Présents' : '❌ Absents',
      );
    }
  } catch (error) {
    console.error(
      '❌ Erreur lors du test:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Exécution du test
testOpenFoodFacts()
  .then(() => console.log('\nTests terminés!'))
  .catch((err) => console.error('Erreur fatale:', err));
