import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { add } from 'date-fns';
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
      const matches = product.defaultDlcTime.match(/\d+/);
      const defaultDlcDays = parseInt(matches ? matches[0] : '30');

      createStockDto.dlc = add(new Date(), { days: defaultDlcDays });
    }

    const stock = this.stockRepository.create({ ...createStockDto, user });
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
      relations: ['product', 'category'],
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
      relations: ['user'],
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
}
