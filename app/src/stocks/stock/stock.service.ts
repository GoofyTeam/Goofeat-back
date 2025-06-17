import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { add } from 'date-fns';
import { Repository } from 'typeorm';
import { Product } from '../../products/product/entities/product.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Stock } from './entities/stock.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(createStockDto: CreateStockDto) {
    const product = await this.productRepository.findOne({
      where: { id: createStockDto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Produit avec l'ID ${createStockDto.productId} non trouvé`,
      );
    }

    if (!createStockDto.dlc) {
      // Convertir l'intervalle PostgreSQL en durée pour date-fns
      // Exemple simple: si defaultDlcTime est '30 days', on ajoute 30 jours
      // Gestion sécurisée de la correspondance regex qui peut retourner null
      const matches = product.defaultDlcTime.match(/\d+/);
      const defaultDlcDays = parseInt(matches ? matches[0] : '30');

      createStockDto.dlc = add(new Date(), { days: defaultDlcDays });
    }

    const stock = this.stockRepository.create(createStockDto);
    return this.stockRepository.save(stock);
  }

  findAll() {
    return `This action returns all stock`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stock`;
  }

  update(id: number, updateStockDto: UpdateStockDto) {
    return `This action updates a #${id} stock`;
  }

  remove(id: number) {
    return `This action removes a #${id} stock`;
  }
}
