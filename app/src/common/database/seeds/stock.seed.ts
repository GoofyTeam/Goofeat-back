import { add } from 'date-fns';
import { DataSource } from 'typeorm';
import { Product } from '../../../products/product/entities/product.entity';
import { Stock } from '../../../stocks/stock/entities/stock.entity';
import { User } from '../../../users/entity/user.entity';

export const stockSeed = async (dataSource: DataSource): Promise<void> => {
  const stockRepository = dataSource.getRepository(Stock);
  const productRepository = dataSource.getRepository(Product);
  const userRepository = dataSource.getRepository(User);

  // Vérifier si des stocks existent déjà
  const existingStocksCount = await stockRepository.count();
  if (existingStocksCount > 0) {
    console.log(`${existingStocksCount} stocks existent déjà, seed ignoré.`);
    return;
  }

  // Récupérer les produits et utilisateurs existants
  const products = await productRepository.find();
  const users = await userRepository.find();

  if (products.length === 0) {
    console.log('Aucun produit trouvé, impossible de créer des stocks.');
    return;
  }

  if (users.length === 0) {
    console.log('Aucun utilisateur trouvé, impossible de créer des stocks.');
    return;
  }

  // Créer des stocks aléatoires pour chaque utilisateur
  const stocks: Stock[] = [];

  for (const user of users) {
    // Chaque utilisateur aura entre 2 et 5 produits en stock
    const numberOfStocks = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < numberOfStocks; i++) {
      // Sélectionner un produit aléatoire
      const randomProduct =
        products[Math.floor(Math.random() * products.length)];

      // Créer un stock avec une quantité et une DLC aléatoires
      const stock = new Stock();
      stock.product = randomProduct;
      stock.user = user;
      stock.quantity = parseFloat((Math.random() * 10 + 1).toFixed(1)); // Quantité entre 1 et 11

      // DLC entre aujourd'hui + 10 jours et aujourd'hui + 100 jours
      const daysToAdd = Math.floor(Math.random() * 90) + 10;
      stock.dlc = add(new Date(), { days: daysToAdd });

      stocks.push(stock);
    }
  }

  await stockRepository.save(stocks);
  console.log(`${stocks.length} stocks insérés avec succès.`);
};
