import { Injectable } from '@nestjs/common';
import { ProductData, ProductDataService } from './product-data.interface';

/**
 * Service de données produits simulé pour les tests ou lorsque l'API externe est indisponible
 */
@Injectable()
export class MockProductService implements ProductDataService {
  // Base de données simulée pour les tests
  private readonly mockProducts: ProductData[] = [
    {
      barcode: '3017620422003',
      name: 'Nutella',
      description: 'Pâte à tartiner aux noisettes et au cacao',
      price: 3.99,
      imageUrl:
        'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.429.400.jpg',
    },
    {
      barcode: '3017620425035',
      name: 'Biscuits Petit Beurre',
      description: 'Biscuits au beurre',
      price: 1.99,
      imageUrl:
        'https://images.openfoodfacts.org/images/products/301/762/042/5035/front_fr.69.400.jpg',
    },
    // Ajoutez d'autres produits simulés selon vos besoins
  ];

  async getProductByBarcode(barcode: string): Promise<ProductData> {
    // Simulation d'une opération
    await new Promise((resolve) => setTimeout(resolve, 100));

    const product = this.mockProducts.find((p) => p.barcode === barcode);

    if (!product) {
      throw new Error(`Produit non trouvé avec le code-barres ${barcode}`);
    }

    return product;
  }

  async searchProductsByName(name: string, limit = 10): Promise<ProductData[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const normalizedName = name.toLowerCase();

    return this.mockProducts
      .filter((product) => product.name.toLowerCase().includes(normalizedName))
      .slice(0, limit);
  }
}
