import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Unit } from 'src/common/units/unit.enums';
import { Product } from 'src/products/entities/product.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserStockSeedService {
  private readonly logger = new Logger(UserStockSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
  ) {}

  async seedUserStock(userEmail: string = 'user@example.com') {
    this.logger.log(`Ajout de stock pour l'utilisateur: ${userEmail}`);

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({
      where: { email: userEmail },
    });

    if (!user) {
      this.logger.error(`Utilisateur ${userEmail} non trouvé !`);
      return;
    }

    // Supprimer le stock existant pour cet utilisateur
    await this.stockRepository.delete({ user: { id: user.id } });
    this.logger.log(`Stock existant supprimé pour ${userEmail}`);

    // Liste des produits courants à ajouter avec leurs quantités et DLC
    const stockData = [
      // Légumes
      { productName: 'Tomates', quantity: 800, unit: Unit.G, daysFromNow: 5 },
      { productName: 'Oignons', quantity: 500, unit: Unit.G, daysFromNow: 15 },
      {
        productName: 'Courgettes',
        quantity: 600,
        unit: Unit.G,
        daysFromNow: 7,
      },
      { productName: 'Carottes', quantity: 700, unit: Unit.G, daysFromNow: 12 },
      { productName: 'Poivrons', quantity: 400, unit: Unit.G, daysFromNow: 8 },
      { productName: 'Brocoli', quantity: 500, unit: Unit.G, daysFromNow: 6 },
      { productName: 'Épinards', quantity: 200, unit: Unit.G, daysFromNow: 4 },

      // Protéines
      { productName: 'Poulet', quantity: 1, unit: Unit.KG, daysFromNow: 3 },
      {
        productName: 'Bœuf haché',
        quantity: 500,
        unit: Unit.G,
        daysFromNow: 2,
      },
      { productName: 'Saumon', quantity: 400, unit: Unit.G, daysFromNow: 1 },
      { productName: 'Œufs', quantity: 12, unit: Unit.PIECE, daysFromNow: 10 },

      // Féculents et légumineuses
      { productName: 'Riz', quantity: 1, unit: Unit.KG, daysFromNow: 365 },
      { productName: 'Pâtes', quantity: 500, unit: Unit.G, daysFromNow: 200 },
      {
        productName: 'Pommes de terre',
        quantity: 1.5,
        unit: Unit.KG,
        daysFromNow: 20,
      },
      {
        productName: 'Lentilles',
        quantity: 400,
        unit: Unit.G,
        daysFromNow: 180,
      },
      {
        productName: 'Haricots rouges',
        quantity: 300,
        unit: Unit.G,
        daysFromNow: 150,
      },

      // Produits laitiers
      { productName: 'Lait', quantity: 1, unit: Unit.L, daysFromNow: 5 },
      { productName: 'Fromage', quantity: 300, unit: Unit.G, daysFromNow: 12 },
      { productName: 'Yaourt', quantity: 8, unit: Unit.PIECE, daysFromNow: 7 },
      { productName: 'Beurre', quantity: 250, unit: Unit.G, daysFromNow: 25 },

      // Condiments et épices
      {
        productName: "Huile d'olive",
        quantity: 500,
        unit: Unit.ML,
        daysFromNow: 100,
      },
      { productName: 'Ail', quantity: 100, unit: Unit.G, daysFromNow: 30 },
      { productName: 'Persil', quantity: 50, unit: Unit.G, daysFromNow: 5 },
      { productName: 'Basilic', quantity: 30, unit: Unit.G, daysFromNow: 4 },
      { productName: 'Thym', quantity: 20, unit: Unit.G, daysFromNow: 60 },
      { productName: 'Sel', quantity: 1, unit: Unit.KG, daysFromNow: 1000 },
      { productName: 'Poivre', quantity: 100, unit: Unit.G, daysFromNow: 200 },

      // Fruits
      { productName: 'Pommes', quantity: 1, unit: Unit.KG, daysFromNow: 15 },
      { productName: 'Bananes', quantity: 800, unit: Unit.G, daysFromNow: 6 },
      { productName: 'Citrons', quantity: 300, unit: Unit.G, daysFromNow: 20 },

      // Autres essentiels
      { productName: 'Farine', quantity: 1, unit: Unit.KG, daysFromNow: 150 },
      { productName: 'Sucre', quantity: 500, unit: Unit.G, daysFromNow: 400 },
      { productName: 'Levure', quantity: 20, unit: Unit.G, daysFromNow: 90 },
    ];

    let addedCount = 0;
    let notFoundCount = 0;

    for (const item of stockData) {
      // Chercher le produit par nom (case-insensitive)
      const product = await this.productRepository
        .createQueryBuilder('product')
        .where('LOWER(product.name) LIKE LOWER(:name)', {
          name: `%${item.productName.toLowerCase()}%`,
        })
        .getOne();

      if (product) {
        // Calculer la DLC
        const dlc = new Date();
        dlc.setDate(dlc.getDate() + item.daysFromNow);

        // Créer le stock
        const stock = this.stockRepository.create({
          user: user,
          product: product,
          quantity: item.quantity,
          unit: item.unit,
          dlc: dlc,
        });

        await this.stockRepository.save(stock);
        addedCount++;

        this.logger.log(
          `✅ Ajouté: ${item.quantity} ${item.unit} de ${product.name} (DLC: ${dlc.toISOString().split('T')[0]})`,
        );
      } else {
        notFoundCount++;
        this.logger.warn(`❌ Produit non trouvé: ${item.productName}`);
      }
    }

    this.logger.log(`
🎉 Seed terminé pour ${userEmail}:
   - ${addedCount} produits ajoutés au stock
   - ${notFoundCount} produits non trouvés
   - L'utilisateur devrait maintenant voir des recettes réalisables !
    `);
  }
}
