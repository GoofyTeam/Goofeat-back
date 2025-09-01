/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { add } from 'date-fns';
import { DlcRulesService } from 'src/common/dlc/dlc-rules.service';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';
import { PieceUnit } from 'src/common/units/unit.enums';
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
    private stockRepository: Repository<Stock>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private eventEmitter: EventEmitter2,
    private unitConversionService: UnitConversionService,
    private dlcRulesService: DlcRulesService,
  ) {}

  async create(createStockDto: CreateStockDto, user: User): Promise<Stock> {
    const product = await this.productRepository.findOne({
      where: { id: createStockDto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Produit avec l'ID ${createStockDto.productId} non trouvé`,
      );
    }

    if (!createStockDto.dlc) {
      const dlcPrediction = this.dlcRulesService.predictDefaultDlc(product);
      createStockDto.dlc = add(new Date(), { days: dlcPrediction.days });
    }

    const { productId, ...stockData } = createStockDto;

    // Calculer la quantité totale réelle si on a des infos de packaging
    let totalQuantity = createStockDto.quantity;
    let baseUnit =
      createStockDto.unit || product.defaultUnit || PieceUnit.PIECE;

    if (product.packagingSize && product.unitSize) {
      const conversionResult =
        this.unitConversionService.calculateTotalQuantity(
          createStockDto.quantity,
          createStockDto.unit || product.defaultUnit || PieceUnit.PIECE,
          product.unitSize,
          product.packagingSize,
        );
      totalQuantity = conversionResult.totalQuantity;
      baseUnit = conversionResult.baseUnit;
    }

    const stock = this.stockRepository.create({
      ...stockData,
      user,
      product,
      totalQuantity,
      baseUnit,
    });
    const savedStock = await this.stockRepository.save(stock);

    const stockWithRelations = await this.stockRepository.findOne({
      where: { id: savedStock.id },
      relations: ['product', 'user'],
    });

    // Émettre l'événement de création avec l'utilisateur
    if (stockWithRelations) {
      this.eventEmitter.emit('stock.created', {
        stock: stockWithRelations,
        user,
      });
    }

    return savedStock;
  }

  async findAll(
    user: User,
    filterStockDto: FilterStockDto,
  ): Promise<{ data: Stock[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search } = filterStockDto;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Stock> = { user: { id: user.id } };

    if (search) {
      where.product = { name: ILike(`%${search}%`) };
    }

    const [data, total] = await this.stockRepository.findAndCount({
      where,
      relations: ['product'],
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
      relations: ['user', 'product'],
    });
    if (!stock) {
      throw new NotFoundException(`Stock avec l'ID ${id} non trouvé`);
    }

    // An admin can access any stock, otherwise check ownership.
    if (
      !currentUser.roles.includes(Role.ADMIN) &&
      stock.user.id !== currentUser.id
    ) {
      throw new ForbiddenException("Vous n'avez pas accès à cette ressource");
    }
    return stock;
  }

  async update(
    id: string,
    updateStockDto: UpdateStockDto,
    currentUser: User,
  ): Promise<Stock> {
    const stock = await this.findOne(id, currentUser); // findOne now handles admin checks
    const previousDlc = stock.dlc;

    const updatedStock = this.stockRepository.merge(stock, updateStockDto);
    const savedStock = await this.stockRepository.save(updatedStock);

    // Charger les relations pour l'événement
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
    // findOne now handles admin checks
    const stock = await this.findOne(id, currentUser);
    await this.stockRepository.delete(id);

    this.eventEmitter.emit('stock.deleted', {
      stock,
      user: currentUser,
    });
  }

  /**
   * Ajoute du stock pour un produit (utilisé par l'OCR Receipt)
   */
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
      throw new NotFoundException(
        `Produit avec l'ID ${stockData.productId} non trouvé`,
      );
    }

    // Prédire la DLC si pas fournie
    let dlc = stockData.expirationDate;
    if (!dlc) {
      const dlcPrediction = this.dlcRulesService.predictDefaultDlc(product);
      dlc = add(stockData.purchaseDate || new Date(), {
        days: dlcPrediction.days,
      });
    }

    // Trouver l'utilisateur
    const user = { id: stockData.userId } as any; // Simplification pour l'instant

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
