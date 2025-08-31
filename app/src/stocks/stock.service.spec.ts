/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DlcRulesService } from '../common/dlc/dlc-rules.service';
import { UnitConversionService } from '../common/units/unit-conversion.service';
import { PieceUnit, Unit } from '../common/units/unit.enums';
import { Product } from '../products/entities/product.entity';
import { Role } from '../users/enums/role.enum';
import { Stock } from './entities/stock.entity';
import { StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let stockRepository: Repository<Stock>;
  let productRepository: Repository<Product>;
  let eventEmitter: EventEmitter2;
  let unitConversionService: UnitConversionService;
  let dlcRulesService: DlcRulesService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    roles: [Role.USER],
  };

  const mockAdminUser = {
    id: '2',
    email: 'admin@example.com',
    name: 'Admin User',
    roles: [Role.ADMIN],
  };

  const mockProduct = {
    id: '1',
    name: 'Test Product',
    defaultUnit: PieceUnit.PIECE,
    unitSize: 100,
    packagingSize: 1,
    defaultDlcTime: '30 days',
  };

  const mockStock = {
    id: '1',
    productId: '1',
    product: mockProduct,
    user: mockUser,
    quantity: 2,
    unit: PieceUnit.PIECE,
    totalQuantity: 200,
    baseUnit: 'g' as Unit,
    dlc: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateStockDto = {
    productId: '1',
    quantity: 2,
    unit: PieceUnit.PIECE,
    dlc: new Date('2025-12-31'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getRepositoryToken(Stock),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            merge: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: UnitConversionService,
          useValue: {
            calculateTotalQuantity: jest.fn(),
          },
        },
        {
          provide: DlcRulesService,
          useValue: {
            predictDefaultDlc: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    stockRepository = module.get<Repository<Stock>>(getRepositoryToken(Stock));
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    unitConversionService = module.get<UnitConversionService>(
      UnitConversionService,
    );
    dlcRulesService = module.get<DlcRulesService>(DlcRulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create stock successfully', async () => {
      jest
        .spyOn(productRepository, 'findOne')
        .mockResolvedValue(mockProduct as any);
      jest
        .spyOn(unitConversionService, 'calculateTotalQuantity')
        .mockReturnValue({
          totalQuantity: 200,
          baseUnit: 'g' as Unit,
          displayQuantity: 200,
          displayUnit: 'g' as Unit,
        });
      jest.spyOn(stockRepository, 'create').mockReturnValue(mockStock as any);
      jest.spyOn(stockRepository, 'save').mockResolvedValue(mockStock as any);
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);

      const result = await service.create(mockCreateStockDto, mockUser as any);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockCreateStockDto.productId },
      });
      expect(stockRepository.create).toHaveBeenCalled();
      expect(stockRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.created',
        expect.any(Object),
      );
      expect(result).toEqual(mockStock);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      jest.spyOn(productRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(mockCreateStockDto, mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should predict DLC when not provided', async () => {
      const createStockDtoWithoutDlc = {
        productId: '1',
        quantity: 2,
        unit: PieceUnit.PIECE,
      };

      const predictedDlc = {
        days: 30,
        source: 'default' as const,
        confidence: 'medium' as const,
      };
      jest
        .spyOn(productRepository, 'findOne')
        .mockResolvedValue(mockProduct as any);
      jest
        .spyOn(dlcRulesService, 'predictDefaultDlc')
        .mockReturnValue(predictedDlc);
      jest
        .spyOn(unitConversionService, 'calculateTotalQuantity')
        .mockReturnValue({
          totalQuantity: 100,
          baseUnit: 'g' as any,
          displayQuantity: 1,
          displayUnit: 'g' as any,
        });
      jest.spyOn(stockRepository, 'create').mockReturnValue(mockStock as any);
      jest.spyOn(stockRepository, 'save').mockResolvedValue(mockStock as any);
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);

      await service.create(createStockDtoWithoutDlc, mockUser as any);

      expect(dlcRulesService.predictDefaultDlc).toHaveBeenCalledWith(
        mockProduct,
      );
    });

    it('should calculate total quantity with packaging info', async () => {
      const productWithPackaging = {
        ...mockProduct,
        packagingSize: 6,
        unitSize: 500,
      };

      jest
        .spyOn(productRepository, 'findOne')
        .mockResolvedValue(productWithPackaging as any);
      jest
        .spyOn(unitConversionService, 'calculateTotalQuantity')
        .mockReturnValue({
          totalQuantity: 6000, // 2 packs * 6 units * 500ml
          baseUnit: 'ml' as Unit,
          displayQuantity: 6000,
          displayUnit: 'ml' as Unit,
        });
      jest.spyOn(stockRepository, 'create').mockReturnValue(mockStock as any);
      jest.spyOn(stockRepository, 'save').mockResolvedValue(mockStock as any);
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);

      await service.create(mockCreateStockDto, mockUser as any);

      expect(unitConversionService.calculateTotalQuantity).toHaveBeenCalledWith(
        mockCreateStockDto.quantity,
        mockCreateStockDto.unit,
        productWithPackaging.unitSize,
        productWithPackaging.packagingSize,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated stocks for user', async () => {
      const filterDto = { page: 1, limit: 10, search: 'test' };
      const stocks = [mockStock];

      jest
        .spyOn(stockRepository, 'findAndCount')
        .mockResolvedValue([stocks as any, 1]);

      const result = await service.findAll(mockUser as any, filterDto);

      expect(stockRepository.findAndCount).toHaveBeenCalledWith({
        where: expect.objectContaining({
          user: { id: mockUser.id },
          product: { name: expect.any(Object) },
        }),
        relations: ['product'],
        take: 10,
        skip: 0,
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({
        data: stocks,
        total: 1,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return stock for owner', async () => {
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);

      const result = await service.findOne('1', mockUser as any);

      expect(stockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['user', 'product'],
      });
      expect(result).toEqual(mockStock);
    });

    it('should return stock for admin user', async () => {
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);

      const result = await service.findOne('1', mockAdminUser as any);

      expect(result).toEqual(mockStock);
    });

    it('should throw NotFoundException for non-existent stock', async () => {
      jest.spyOn(stockRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('1', mockUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner/non-admin', async () => {
      const otherUserStock = {
        ...mockStock,
        user: { id: '3', email: 'other@example.com' },
      };

      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(otherUserStock as any);

      await expect(service.findOne('1', mockUser as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update stock successfully', async () => {
      const updateDto = { quantity: 5 };
      const updatedStock = { ...mockStock, ...updateDto };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockStock as any);
      jest.spyOn(stockRepository, 'merge').mockReturnValue(updatedStock as any);
      jest
        .spyOn(stockRepository, 'save')
        .mockResolvedValue(updatedStock as any);
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(updatedStock as any);

      const result = await service.update('1', updateDto, mockUser as any);

      expect(service.findOne).toHaveBeenCalledWith('1', mockUser);
      expect(stockRepository.merge).toHaveBeenCalledWith(mockStock, updateDto);
      expect(stockRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.updated',
        expect.any(Object),
      );
      expect(result.quantity).toBe(5);
    });
  });

  describe('remove', () => {
    it('should remove stock successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockStock as any);
      jest
        .spyOn(stockRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      await service.remove('1', mockUser as any);

      expect(service.findOne).toHaveBeenCalledWith('1', mockUser);
      expect(stockRepository.delete).toHaveBeenCalledWith('1');
      expect(eventEmitter.emit).toHaveBeenCalledWith('stock.deleted', {
        stock: mockStock,
        user: mockUser,
      });
    });
  });
});
