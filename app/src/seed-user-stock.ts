/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

/**
 * Script pour ajouter du stock à un utilisateur spécifique
 * Utilise: yarn add-user-stock
 */
async function seedUserStock() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userEmail = 'user@example.com';
    console.log(`🚀 Ajout de stock pour: ${userEmail}`);

    // Récupérer la source de données TypeORM
    const dataSource = app.get(DataSource);

    // 1. Trouver l'utilisateur
    const userResult = await dataSource.query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail],
    );

    if (userResult.length === 0) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé !`);
      console.log(
        "💡 Créez d'abord cet utilisateur ou modifiez l'email dans le script.",
      );
      process.exit(1);
    }

    const userId = userResult[0].id;
    console.log(`👤 Utilisateur trouvé: ${userId}`);

    // 2. Supprimer le stock existant pour cet utilisateur
    const deleteResult = await dataSource.query(
      'DELETE FROM stocks WHERE "userId" = $1',
      [userId],
    );
    console.log(`🧹 ${deleteResult[1]} éléments de stock supprimés`);

    // 3. Liste des produits à ajouter avec des quantités généreuses
    const stockItems = [
      // Légumes de base - avec des quantités qui permettent plusieurs recettes
      { name: 'tomate', quantity: 1000, unit: 'g', days: 6 },
      { name: 'oignon', quantity: 800, unit: 'g', days: 20 },
      { name: 'carotte', quantity: 700, unit: 'g', days: 15 },
      { name: 'courgette', quantity: 600, unit: 'g', days: 8 },
      { name: 'poivron', quantity: 500, unit: 'g', days: 10 },
      { name: 'brocoli', quantity: 400, unit: 'g', days: 5 },

      // Protéines essentielles
      { name: 'poulet', quantity: 1200, unit: 'g', days: 4 },
      { name: 'bœuf', quantity: 800, unit: 'g', days: 3 },
      { name: 'saumon', quantity: 600, unit: 'g', days: 2 },
      { name: 'œuf', quantity: 18, unit: 'piece', days: 12 },
      { name: 'jambon', quantity: 300, unit: 'g', days: 8 },

      // Féculents et céréales
      { name: 'riz', quantity: 2000, unit: 'g', days: 400 },
      { name: 'pâtes', quantity: 1000, unit: 'g', days: 300 },
      { name: 'pomme de terre', quantity: 2000, unit: 'g', days: 25 },
      { name: 'pain', quantity: 500, unit: 'g', days: 4 },

      // Produits laitiers
      { name: 'lait', quantity: 1500, unit: 'ml', days: 6 },
      { name: 'fromage', quantity: 400, unit: 'g', days: 15 },
      { name: 'beurre', quantity: 300, unit: 'g', days: 30 },
      { name: 'yaourt', quantity: 8, unit: 'piece', days: 10 },

      // Condiments et épices essentiels
      { name: 'huile', quantity: 750, unit: 'ml', days: 120 },
      { name: 'ail', quantity: 150, unit: 'g', days: 35 },
      { name: 'sel', quantity: 1000, unit: 'g', days: 1000 },
      { name: 'poivre', quantity: 100, unit: 'g', days: 300 },
      { name: 'herbes', quantity: 50, unit: 'g', days: 7 },

      // Légumes feuilles et herbes fraîches
      { name: 'salade', quantity: 200, unit: 'g', days: 5 },
      { name: 'épinard', quantity: 300, unit: 'g', days: 4 },
      { name: 'persil', quantity: 50, unit: 'g', days: 6 },
      { name: 'basilic', quantity: 30, unit: 'g', days: 5 },

      // Autres ingrédients utiles
      { name: 'champignon', quantity: 400, unit: 'g', days: 7 },
      { name: 'citron', quantity: 300, unit: 'g', days: 14 },
      { name: 'tomate cerise', quantity: 300, unit: 'g', days: 8 },
    ];

    let addedCount = 0;
    let notFoundCount = 0;

    console.log(`📦 Recherche de ${stockItems.length} produits...`);

    for (const item of stockItems) {
      // Recherche flexible du produit avec plusieurs variantes
      const productResult = await dataSource.query(
        `
        SELECT id, name FROM products 
        WHERE LOWER(name) LIKE LOWER($1) 
           OR LOWER(name) LIKE LOWER($2)
           OR LOWER(name) LIKE LOWER($3)
        ORDER BY CASE 
          WHEN LOWER(name) = LOWER($4) THEN 1
          WHEN LOWER(name) LIKE LOWER($4) || '%' THEN 2
          WHEN LOWER(name) LIKE '%' || LOWER($4) || '%' THEN 3
          ELSE 4
        END
        LIMIT 1
      `,
        [
          `%${item.name}%`,
          `%${item.name}s%`, // version plurielle
          item.name.endsWith('s')
            ? `%${item.name.slice(0, -1)}%`
            : `%${item.name}%`, // version singulière
          item.name,
        ],
      );

      if (productResult.length > 0) {
        const product = productResult[0];

        // Calculer la DLC
        const dlc = new Date();
        dlc.setDate(dlc.getDate() + item.days);

        // Insérer le stock
        await dataSource.query(
          `
          INSERT INTO stocks ("userId", "productId", quantity, unit, dlc, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `,
          [userId, product.id, item.quantity, item.unit, dlc],
        );

        addedCount++;
        const dlcStr = dlc.toISOString().split('T')[0];
        console.log(
          `✅ ${product.name}: ${item.quantity} ${item.unit} (DLC: ${dlcStr})`,
        );
      } else {
        notFoundCount++;
        console.log(`⚠️  Produit non trouvé: ${item.name}`);
      }
    }

    console.log(`
🎉 TERMINÉ avec succès !
   
📊 Résumé:
   - ${addedCount} produits ajoutés au stock de ${userEmail}
   - ${notFoundCount} produits non trouvés dans la base
   
🍽️  L'utilisateur peut maintenant:
   - Voir des recettes réalisables dans l'onglet "Anti-Gaspillage"
   - Découvrir des suggestions basées sur son stock
   
🔄 Pour tester:
   1. Ouvrez l'app Flutter
   2. Allez dans l'onglet "Recettes" 
   3. Consultez la section "Anti-Gaspillage"
   4. Vous devriez voir des recettes avec le badge "100% réalisable"
    `);
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Exécuter le script
seedUserStock().catch(console.error);
