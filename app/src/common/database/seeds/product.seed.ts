import { DataSource } from 'typeorm';
import { Product } from '../../../products/product/entities/product.entity';

export const productSeed = async (dataSource: DataSource): Promise<void> => {
  const productRepository = dataSource.getRepository(Product);

  // Vérifier si des produits existent déjà
  const existingProductsCount = await productRepository.count();
  if (existingProductsCount > 0) {
    console.log(
      `${existingProductsCount} produits existent déjà, seed ignoré.`,
    );
    return;
  }

  // Données de produits à insérer
  const products: Partial<Product>[] = [
    {
      id: '3017620422003',
      code: '3017620422003',
      name: 'Nutella',
      description: 'Pâte à tartiner aux noisettes et au cacao',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.400.jpg',
      defaultDlcTime: '180 days',
    },
    {
      id: '3017620425252',
      code: '3017620425252',
      name: 'Nutella & Go',
      description:
        'Pâte à tartiner aux noisettes et au cacao avec bâtonnets de pain',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/301/762/042/5252/front_fr.248.400.jpg',
      defaultDlcTime: '90 days',
    },
    {
      id: '8000500310427',
      code: '8000500310427',
      name: 'Kinder Bueno',
      description:
        'Gaufrettes enrobées de chocolat au lait fourrées au lait et aux noisettes',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/800/050/031/0427/front_fr.166.400.jpg',
      defaultDlcTime: '120 days',
    },
    {
      id: '3228857000166',
      code: '3228857000166',
      name: 'Eau de source Cristaline',
      description: 'Eau de source naturelle',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/322/885/700/0166/front_fr.294.400.jpg',
      defaultDlcTime: '365 days',
    },
    {
      id: '3228857000906',
      code: '3228857000906',
      name: 'Eau minérale naturelle Cristaline',
      description: 'Eau minérale naturelle de source',
      imageUrl:
        'https://images.openfoodfacts.org/images/products/322/885/700/0906/front_fr.184.400.jpg',
      defaultDlcTime: '365 days',
    },
  ];

  // Insérer les produits
  await productRepository.save(products);
  console.log(`${products.length} produits insérés avec succès.`);
};
