/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { add } from 'date-fns';
import { DlcRulesService } from 'src/common/dlc/dlc-rules.service';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';
import { PieceUnit } from 'src/common/units/unit.enums';
import { HouseholdService } from 'src/households/household.service';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entity/user.entity';
import { Role } from 'src/users/enums/role.enum';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { CreateStockDto } from './dto/create-stock.dto';
import { FilterStockDto } from './dto/filter-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Stock } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly eventEmitter: EventEmitter2,
    private readonly unitConversionService: UnitConversionService,
    private readonly dlcRulesService: DlcRulesService,
    private readonly householdService: HouseholdService,
  ) {}

  async createBulk(
    createStockDtos: CreateStockDto[],
    user: User,
  ): Promise<Stock[]> {
    const stocks: Stock[] = [];
    for (const dto of createStockDtos) {
      const stock = await this.create(dto, user);
      stocks.push(stock);
    }
    return stocks;
  }

  async create(createStockDto: CreateStockDto, user: User): Promise<Stock> {
    const product = await this.productRepository.findOne({
      where: { id: createStockDto.productId },
    });

    if (!product) {
      throw new BadRequestException(
        `Produit avec l'ID ${createStockDto.productId} non trouvé`,
      );
    }

    if (!createStockDto.dlc) {
      const dlcPrediction = this.dlcRulesService.predictDefaultDlc(product);
      createStockDto.dlc = add(new Date(), { days: dlcPrediction.days });
    }

    const { productId, householdId, ...stockData } = createStockDto;

    let totalQuantity = createStockDto.quantity;
    let baseUnit =
      createStockDto.unit || product.defaultUnit || PieceUnit.PIECE;

    if (product.packagingSize && product.unitSize) {
      const conversionResult =
        this.unitConversionService.calculateTotalQuantity(
          createStockDto.quantity,
          baseUnit,
          product.unitSize,
          product.packagingSize,
        );
      totalQuantity = conversionResult.totalQuantity;
      baseUnit = conversionResult.baseUnit;
    }

    const stockEntity: any = {
      ...stockData,
      user,
      product,
      totalQuantity,
      baseUnit,
    };

    if (householdId) {
      // Vérifier que l'utilisateur est membre du foyer
      const membership = await this.householdService.getUserMembership(
        user.id,
        householdId,
      );

      if (!membership) {
        throw new ForbiddenException("Vous n'êtes pas membre de ce foyer");
      }

      if (!membership.canEditStock) {
        throw new ForbiddenException(
          "Vous n'avez pas les droits pour ajouter des stocks dans ce foyer",
        );
      }

      stockEntity.household = { id: householdId };
      stockEntity.addedByMemberId = membership.id;
    }

    const stock = this.stockRepository.create(stockEntity);
    const savedStockResult = await this.stockRepository.save(stock);

    // TypeORM save renvoie l'entité sauvegardée
    const savedStock = Array.isArray(savedStockResult)
      ? savedStockResult[0]
      : savedStockResult;

    const stockWithRelations = await this.stockRepository.findOne({
      where: { id: savedStock.id },
      relations: ['product', 'user', 'household'],
    });

    if (stockWithRelations) {
      this.eventEmitter.emit('stock.created', {
        stock: stockWithRelations,
        user,
      });
      return stockWithRelations;
    }

    return savedStock;
  }

  async findAll(
    user: User,
    filterStockDto: FilterStockDto,
  ): Promise<{ data: Stock[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, householdId } = filterStockDto;
    const skip = (page - 1) * limit;

    let where: FindOptionsWhere<Stock> | FindOptionsWhere<Stock>[] = [];

    if (householdId) {
      // Si un householdId est spécifié, vérifier que l'utilisateur est membre
      const membership = await this.householdService.getUserMembership(
        user.id,
        householdId,
      );

      if (!membership) {
        throw new ForbiddenException("Vous n'êtes pas membre de ce foyer");
      }

      // Filtrer par foyer
      where = { household: { id: householdId } };
    } else {
      // Sinon, retourner les stocks personnels ET ceux de tous les foyers de l'utilisateur
      const userHouseholds = await this.householdService.findAll(user);

      const whereConditions: FindOptionsWhere<Stock>[] = [
        // Stocks personnels (sans foyer) - utiliser IsNull()
        { user: { id: user.id } } as FindOptionsWhere<Stock>,
      ];

      // Ajouter les stocks de chaque foyer
      for (const household of userHouseholds) {
        whereConditions.push({ household: { id: household.id } });
      }

      where = whereConditions;
    }

    // Ajouter le filtre de recherche si nécessaire
    if (search) {
      if (Array.isArray(where)) {
        where = where.map((w) => ({
          ...w,
          product: { name: ILike(`%${search}%`) },
        }));
      } else {
        where.product = { name: ILike(`%${search}%`) };
      }
    }

    const [data, total] = await this.stockRepository.findAndCount({
      where,
      relations: ['product', 'product.ingredients', 'household', 'user'],
      take: limit,
      skip: skip,
      order: {
        createdAt: 'DESC',
      },
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, currentUser: User): Promise<Stock> {
    const stock = await this.stockRepository.findOne({
      where: { id },
      relations: ['user', 'product', 'household'],
    });
    if (!stock) {
      throw new BadRequestException(`Stock avec l'ID ${id} non trouvé`);
    }

    // Vérifier les permissions
    if (stock.household) {
      // Stock de foyer : vérifier que l'utilisateur est membre
      const membership = await this.householdService.getUserMembership(
        currentUser.id,
        stock.household.id,
      );
      if (!membership) {
        throw new ForbiddenException(
          "Vous n'avez pas accès à ce stock de foyer",
        );
      }
    } else if (
      !currentUser.roles.includes(Role.ADMIN) &&
      stock.user.id !== currentUser.id
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à ce stock personnel",
      );
    }

    return stock;
  }

  async update(
    id: string,
    updateStockDto: UpdateStockDto,
    currentUser: User,
  ): Promise<Stock> {
    const stock = await this.findOne(id, currentUser);
    const previousDlc = stock.dlc;

    // Si le stock appartient à un foyer, vérifier les droits d'édition
    if (stock.household) {
      const membership = await this.householdService.getUserMembership(
        currentUser.id,
        stock.household.id,
      );
      if (membership) {
        // Vérifier que l'utilisateur peut modifier les stocks
        if (!membership.canEditStock) {
          throw new ForbiddenException(
            "Vous n'avez pas les droits pour modifier les stocks de ce foyer",
          );
        }
        stock.lastUpdatedByMemberId = membership.id;
      }
    }

    const updatedStock = this.stockRepository.merge(stock, updateStockDto);
    const savedStock = await this.stockRepository.save(updatedStock);

    const stockWithRelations = await this.stockRepository.findOne({
      where: { id: savedStock.id },
      relations: ['product', 'user'],
    });

    if (stockWithRelations) {
      this.eventEmitter.emit('stock.updated', {
        stock: stockWithRelations,
        user: currentUser,
        oldQuantity: stock.quantity,
        oldDlc: previousDlc,
      });
    }

    return savedStock;
  }

  async remove(id: string, currentUser: User): Promise<void> {
    const stock = await this.findOne(id, currentUser);

    // Si le stock appartient à un foyer, vérifier les droits de suppression
    if (stock.household) {
      const membership = await this.householdService.getUserMembership(
        currentUser.id,
        stock.household.id,
      );
      if (membership && !membership.canEditStock) {
        throw new ForbiddenException(
          "Vous n'avez pas les droits pour supprimer les stocks de ce foyer",
        );
      }
    }

    await this.stockRepository.delete(id);

    this.eventEmitter.emit('stock.deleted', {
      stock,
      user: currentUser,
    });
  }

  async getDefaultHouseholdId(user: User): Promise<string> {
    const userHouseholds = await this.householdService.findAll(user);

    if (userHouseholds.length === 0) {
      throw new ForbiddenException(
        "Vous devez être membre d'au moins un foyer pour créer des stocks",
      );
    }

    if (userHouseholds.length === 1) {
      // Un seul foyer, on l'utilise automatiquement
      return userHouseholds[0].id;
    }

    // Plusieurs foyers, il faut spécifier lequel
    throw new ForbiddenException(
      'Vous êtes membre de plusieurs foyers. Veuillez spécifier householdId.',
    );
  }

  async addStock(stockData: {
    userId: string;
    householdId?: string;
    productId: string;
    quantity: number;
    unitPrice?: number;
    expirationDate?: Date;
    purchaseDate?: Date;
    source?: string;
    receiptId?: string;
  }): Promise<Stock> {
    const product = await this.productRepository.findOne({
      where: { id: stockData.productId },
    });

    if (!product) {
      throw new BadRequestException(
        `Produit avec l'ID ${stockData.productId} non trouvé`,
      );
    }

    let dlc = stockData.expirationDate;
    if (!dlc) {
      const dlcPrediction = this.dlcRulesService.predictDefaultDlc(product);
      dlc = add(stockData.purchaseDate || new Date(), {
        days: dlcPrediction.days,
      });
    }

    const user = { id: stockData.userId } as any;

    const stock = this.stockRepository.create({
      product,
      user,
      quantity: stockData.quantity,
      unit: PieceUnit.PIECE,
      dlc,
    });

    const savedStock = await this.stockRepository.save(stock);

    this.eventEmitter.emit('stock.created', {
      stock: savedStock,
      source: stockData.source,
      receiptId: stockData.receiptId,
    });

    return savedStock;
  }
}
