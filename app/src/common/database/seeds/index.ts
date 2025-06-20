import { DataSource } from 'typeorm';
import { productSeed } from './product.seed';
import { stockSeed } from './stock.seed';

export const runSeeds = async (dataSource: DataSource): Promise<void> => {
  console.log('Démarrage du processus de seed...');

  try {
    // Exécuter les seeds dans l'ordre (d'abord les produits, puis les stocks)
    await productSeed(dataSource);
    await stockSeed(dataSource);

    console.log('Processus de seed terminé avec succès.');
  } catch (error) {
    console.error('Erreur lors du processus de seed:', error);
    throw error;
  }
};
