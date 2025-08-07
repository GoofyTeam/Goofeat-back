/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Client } from 'pg';

/**
 * Script simple utilisant des requêtes SQL directes
 */
async function seedUserStock() {
  // Configuration de la base de données depuis les variables d'environnement
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'goofeat_dev',
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
  });

  try {
    await client.connect();
    console.log('🔌 Connecté à la base de données');

    const userEmail = 'user@example.com';
    console.log(`🚀 Ajout de stock pour: ${userEmail}`);

    // 1. Trouver l'utilisateur
    const userResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail],
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé !`);
      process.exit(1);
    }

    const userId = userResult.rows[0].id;
    console.log(`👤 Utilisateur trouvé: ${userId}`);

    // 2. Supprimer le stock existant
    await client.query('DELETE FROM stocks WHERE "userId" = $1', [userId]);
    console.log('🧹 Stock existant supprimé');

    // 3. Liste des produits à ajouter
    const stockItems = [
      { name: 'tomate', quantity: 800, unit: 'g', days: 5 },
      { name: 'oignon', quantity: 500, unit: 'g', days: 15 },
      { name: 'carotte', quantity: 600, unit: 'g', days: 12 },
      { name: 'courgette', quantity: 400, unit: 'g', days: 7 },
      { name: 'poulet', quantity: 1000, unit: 'g', days: 3 },
      { name: 'œuf', quantity: 12, unit: 'piece', days: 10 },
      { name: 'riz', quantity: 1000, unit: 'g', days: 365 },
      { name: 'pâtes', quantity: 500, unit: 'g', days: 200 },
      { name: 'pomme de terre', quantity: 1500, unit: 'g', days: 20 },
      { name: 'lait', quantity: 1000, unit: 'ml', days: 5 },
      { name: 'fromage', quantity: 250, unit: 'g', days: 12 },
      { name: 'huile', quantity: 500, unit: 'ml', days: 100 },
      { name: 'ail', quantity: 100, unit: 'g', days: 30 },
      { name: 'sel', quantity: 500, unit: 'g', days: 1000 },
      { name: 'poivre', quantity: 50, unit: 'g', days: 200 },
      { name: 'persil', quantity: 30, unit: 'g', days: 5 },
      { name: 'basilic', quantity: 20, unit: 'g', days: 4 },
    ];

    let addedCount = 0;

    for (const item of stockItems) {
      // Rechercher le produit par nom (insensible à la casse)
      const productResult = await client.query(
        `
        SELECT id, name FROM products 
        WHERE LOWER(name) LIKE LOWER($1) 
        ORDER BY CASE 
          WHEN LOWER(name) = LOWER($2) THEN 1
          WHEN LOWER(name) LIKE LOWER($2) || '%' THEN 2
          ELSE 3
        END
        LIMIT 1
      `,
        [`%${item.name}%`, item.name],
      );

      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];

        // Calculer la DLC
        const dlc = new Date();
        dlc.setDate(dlc.getDate() + item.days);
        const dlcStr = dlc.toISOString().split('T')[0];

        // Insérer le stock
        await client.query(
          `
          INSERT INTO stocks ("userId", "productId", quantity, unit, dlc, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `,
          [userId, product.id, item.quantity, item.unit, dlc],
        );

        addedCount++;
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
    await client.end();
  }
}

seedUserStock();
