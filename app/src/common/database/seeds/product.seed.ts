import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductSeedService {
  private readonly logger = new Logger(ProductSeedService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async seed(): Promise<Product[]> {
    const ingredients = await this.ingredientRepository.find();
    if (ingredients.length === 0) {
      throw new Error(
        "Aucun ingrédient trouvé. Veuillez d'abord exécuter le seed des ingrédients.",
      );
    }

    const productDefinitions = [
      {
        name: 'Pâtes Penne Rigate Barilla',
        barcode: '8076809513722',
        description: 'Pâtes de semoule de blé dur',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/807/680/951/3722/front_fr.465.400.jpg',
        ingredientOffTag: 'en:durum-wheat-semolina',
      },
      {
        name: 'Thon au naturel Petit Navire',
        barcode: '3560070394173',
        description: 'Thon albacore au naturel, pêche responsable',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/356/007/039/4173/front_fr.25.400.jpg',
        ingredientOffTag: 'en:yellowfin-tuna',
      },
      {
        name: "Huile d'olive vierge extra Puget",
        barcode: '3032940000019',
        description:
          "Huile d'olive de catégorie supérieure obtenue directement des olives",
        imageUrl:
          'https://images.openfoodfacts.org/images/products/303/294/000/0019/front_fr.102.400.jpg',
        ingredientOffTag: 'en:olive-oil',
      },
      {
        name: 'Tomates pelées en jus Mutti',
        barcode: '8005110130048',
        description: 'Tomates 100% italiennes',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/800/511/013/0048/front_fr.66.400.jpg',
        ingredientOffTag: 'en:tomato',
      },
      {
        name: 'Oignon Jaune',
        barcode: '3276559322237',
        description: 'Oignon jaune de calibre moyen',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/327/655/932/2237/front_fr.3.400.jpg',
        ingredientOffTag: 'en:onion',
      },
      {
        name: 'Ail',
        barcode: '2000000001034',
        description: 'Ail blanc',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/200/000/000/1034/front_fr.3.400.jpg',
        ingredientOffTag: 'en:garlic',
      },
      {
        name: 'Lardons fumés Herta',
        barcode: '3011360005285',
        description: 'Lardons fumés de qualité supérieure',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/301/136/000/5285/front_fr.55.400.jpg',
        ingredientOffTag: 'en:lardon',
      },
      {
        name: 'Oeufs frais de poules élevées en plein air',
        barcode: '3245412383726',
        description: 'Boîte de 6 oeufs frais, catégorie A',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/324/541/238/3726/front_fr.110.400.jpg',
        ingredientOffTag: 'en:egg',
      },
      {
        name: 'Parmigiano Reggiano Giovanni Ferrari',
        barcode: '8002720000000',
        description: 'Fromage à pâte dure, affinage 22 mois',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/800/272/000/0000/front_it.12.400.jpg',
        ingredientOffTag: 'en:parmigiano-reggiano',
      },
    ];

    const createdProducts: Product[] = [];
    this.logger.log('Début de la création des produits...');

    for (const productDef of productDefinitions) {
      const existingProduct = await this.productRepository.findOne({
        where: { code: productDef.barcode },
      });

      if (existingProduct) {
        this.logger.log(
          `Le produit "${productDef.name}" existe déjà. Il est ignoré.`,
        );
        continue;
      }

      const { ingredientOffTag, ...productData } = productDef;
      const ingredient = ingredients.find((i) => i.offTag === ingredientOffTag);
      if (!ingredient) {
        this.logger.warn(
          `Ingrédient OFF "${ingredientOffTag}" non trouvé pour le produit "${productData.name}". Le produit est ignoré.`,
        );
        continue;
      }
      const product = this.productRepository.create({
        ...productData,
        code: productData.barcode, // 'code' est le nom de la propriété dans l'entité Product
        ingredients: [ingredient], // Assigner l'ingrédient dans un tableau
      });
      const savedProduct = await this.productRepository.save(product);
      createdProducts.push(savedProduct);
    }

    this.logger.log('Tous les produits ont été créés.');
    return createdProducts;
  }
}
