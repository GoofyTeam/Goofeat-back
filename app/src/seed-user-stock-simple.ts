import { createConnection } from 'typeorm';
import { Unit } from './common/units/unit.enums';
import { Product } from './products/entities/product.entity';
import { Stock } from './stocks/entities/stock.entity';
import { User } from './users/entity/user.entity';

/**
 * Script simple pour ajouter du stock à un utilisateur
 * Usage: cd app && yarn ts-node src/seed-user-stock-simple.ts
 */
async function seedUserStock() {
  const connection = await createConnection();

  try {
    const userEmail = 'user@example.com';
    console.log(`🚀 Ajout de stock pour: ${userEmail}`);

    // Repositories
    const userRepo = connection.getRepository(User);
    const productRepo = connection.getRepository(Product);
    const stockRepo = connection.getRepository(Stock);

    // Trouver l'utilisateur
    const user = await userRepo.findOne({ where: { email: userEmail } });
    if (!user) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé !`);
      process.exit(1);
    }

    // Supprimer le stock existant
    await stockRepo.delete({ user: { id: user.id } });
    console.log('🧹 Stock existant supprimé');

    // Stock à ajouter (produits courants)
    const stockItems = [
      // Légumes frais
      { name: 'tomate', quantity: 800, unit: Unit.G, days: 5 },
      { name: 'oignon', quantity: 500, unit: Unit.G, days: 15 },
      { name: 'courgette', quantity: 600, unit: Unit.G, days: 7 },
      { name: 'carotte', quantity: 700, unit: Unit.G, days: 12 },
      { name: 'poivron', quantity: 400, unit: Unit.G, days: 8 },

      // Protéines
      { name: 'poulet', quantity: 1, unit: Unit.KG, days: 3 },
      { name: 'œuf', quantity: 12, unit: Unit.PIECE, days: 10 },
      { name: 'jambon', quantity: 200, unit: Unit.G, days: 7 },

      // Féculents
      { name: 'riz', quantity: 1, unit: Unit.KG, days: 365 },
      { name: 'pâtes', quantity: 500, unit: Unit.G, days: 200 },
      { name: 'pomme de terre', quantity: 1.5, unit: Unit.KG, days: 20 },

      // Produits laitiers
      { name: 'lait', quantity: 1, unit: Unit.L, days: 5 },
      { name: 'fromage', quantity: 300, unit: Unit.G, days: 12 },
      { name: 'beurre', quantity: 250, unit: Unit.G, days: 25 },

      // Condiments essentiels
      { name: 'huile', quantity: 500, unit: Unit.ML, days: 100 },
      { name: 'ail', quantity: 100, unit: Unit.G, days: 30 },
      { name: 'sel', quantity: 1, unit: Unit.KG, days: 1000 },
      { name: 'poivre', quantity: 100, unit: Unit.G, days: 200 },

      // Herbes aromatiques
      { name: 'persil', quantity: 50, unit: Unit.G, days: 5 },
      { name: 'basilic', quantity: 30, unit: Unit.G, days: 4 },
      { name: 'thym', quantity: 20, unit: Unit.G, days: 60 },
    ];

    let addedCount = 0;

    for (const item of stockItems) {
      // Recherche flexible du produit
      const product = await productRepo
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE :name', {
          name: `%${item.name.toLowerCase()}%`,
        })
        .getOne();

      if (product) {
        // Calculer la DLC
        const dlc = new Date();
        dlc.setDate(dlc.getDate() + item.days);

        // Créer le stock
        const stock = stockRepo.create({
          user,
          product,
          quantity: item.quantity,
          unit: item.unit,
          dlc,
        });

        await stockRepo.save(stock);
        addedCount++;

        const dlcStr = dlc.toISOString().split('T')[0];
        console.log(
          `✅ ${product.name}: ${item.quantity} ${item.unit} (DLC: ${dlcStr})`,
        );
      } else {
        console.log(`⚠️  Produit non trouvé: ${item.name}`);
      }
    }

    console.log(`
🎉 Terminé !
   - ${addedCount} produits ajoutés au stock de ${userEmail}
   - L'utilisateur peut maintenant voir des recettes réalisables
   - Testez l'onglet "Anti-Gaspillage" dans l'app Flutter
    `);
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await connection.close();
  }
}

seedUserStock();
