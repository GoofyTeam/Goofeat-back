import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { runSeeds } from './index';

// Charger les variables d'environnement
config();

// Configurer la connexion à la base de données
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../../../**/*.entity{.ts,.js}'],
  synchronize: false,
});

// Fonction principale
async function main() {
  try {
    console.log('Initialisation de la connexion à la base de données...');
    await dataSource.initialize();
    console.log('Connexion à la base de données établie avec succès.');

    // Exécuter les seeds
    await runSeeds(dataSource);

    await dataSource.destroy();
    console.log('Connexion à la base de données fermée.');

    process.exit(0);
  } catch (error) {
    console.error("Erreur lors de l'exécution des seeds:", error);
    process.exit(1);
  }
}

// Exécuter la fonction principale
main();
