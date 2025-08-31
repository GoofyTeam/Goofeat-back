/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { Product } from './entities/product.entity';
import { ProductDataService } from './lib/product-data.interface';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: Repository<Product>;
  let ingredientRepository: Repository<Ingredient>;
  let productDataService: ProductDataService;

  const mockProduct = {
    id: '1',
    code: '123456789',
    name: 'Test Product',
    description: 'Test description',
    imageUrl: 'http://example.com/image.jpg',
    defaultUnit: 'g',
    unitSize: 100,
    packagingSize: 1,
    ingredients: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIngredient = {
    id: '1',
    name: 'Test Ingredient',
    offTag: 'en:test',
    products: [],
  };

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
  };

  const mockProductData = {
    code: '123456789',
    barcode: '123456789',
    name: 'Test Product',
    description: 'Test description',
    imageUrl: 'http://example.com/image.jpg',
    defaultUnit: 'g' as any,
    unitSize: 100,
    packagingSize: 1,
    categories: ['en:beverages'],
    categoriesHierarchy: ['en:beverages', 'en:waters'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Ingredient),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: 'PRODUCT_DATA_SERVICE',
          useValue: {
            getProductByBarcode: jest.fn(),
            searchProducts: jest.fn(),
            searchProductsByName: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    ingredientRepository = module.get<Repository<Ingredient>>(
      getRepositoryToken(Ingredient),
    );
    productDataService = module.get<ProductDataService>('PRODUCT_DATA_SERVICE');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product with ingredients', async () => {
      const createProductDto = {
        name: 'Test Product',
        description: 'Test description',
        ingredients: ['1'],
      };

      jest
        .spyOn(ingredientRepository, 'find')
        .mockResolvedValue([mockIngredient as any]);
      jest
        .spyOn(productRepository, 'create')
        .mockReturnValue(mockProduct as any);
      jest
        .spyOn(productRepository, 'save')
        .mockResolvedValue(mockProduct as any);

      const result = await service.create(createProductDto, mockUser as any);

      expect(ingredientRepository.find).toHaveBeenCalledWith({
        where: { id: expect.any(Object) },
      });
      expect(productRepository.create).toHaveBeenCalled();
      expect(productRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException for invalid ingredients', async () => {
      const createProductDto = {
        name: 'Test Product',
        ingredients: ['invalid-id'],
      };

      jest.spyOn(ingredientRepository, 'find').mockResolvedValue([]);

      await expect(
        service.create(createProductDto, mockUser as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createFromBarcode', () => {
    it('should return existing product by barcode', async () => {
      jest
        .spyOn(productRepository, 'findOne')
        .mockResolvedValue(mockProduct as any);

      const result = await service.createFromBarcode('123456789');

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { code: '123456789' },
        relations: ['ingredients'],
      });
      expect(result).toEqual(mockProduct);
    });

    it('should create new product from OpenFoodFacts', async () => {
      const mockProductDataWithIngredients = {
        ...mockProductData,
        ingredients: [mockIngredient as any],
      };

      jest
        .spyOn(productRepository, 'findOne')
        .mockResolvedValueOnce(null) // First call for existence check
        .mockResolvedValueOnce(mockProduct as any); // Second call for return
      jest
        .spyOn(productDataService, 'getProductByBarcode')
        .mockResolvedValue(mockProductDataWithIngredients);
      jest
        .spyOn(productRepository, 'create')
        .mockReturnValue(mockProduct as any);
      jest
        .spyOn(productRepository, 'save')
        .mockResolvedValue(mockProduct as any);
      jest
        .spyOn(service as any, 'matchIngredientsFromCategories')
        .mockResolvedValue([mockIngredient]);

      const result = await service.createFromBarcode('123456789');

      expect(productDataService.getProductByBarcode).toHaveBeenCalledWith(
        '123456789',
      );
      expect(productRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('should throw error for non-existent barcode', async () => {
      jest.spyOn(productRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(productDataService, 'getProductByBarcode')
        .mockResolvedValue(undefined as any);

      await expect(
        service.createFromBarcode('invalid-barcode'),
      ).rejects.toThrow(
        'Impossible de créer le produit à partir du code-barres invalid-barcode',
      );
    });
  });

  describe('findAll', () => {
    it('should return local products when found', async () => {
      const filterDto = {
        search: 'test',
        limit: 10,
      };

      // Mock the query builder to return products
      jest.spyOn(productRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProduct]),
      } as any);

      const result = await service.findAll(filterDto);

      expect(productRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual([mockProduct]);
    });

    it('should search external products when no local results', async () => {
      const filterDto = {
        search: 'test',
        limit: 10,
      };

      const mockProductDataWithIngredients = {
        ...mockProductData,
        ingredients: [mockIngredient as any],
      };

      // Mock the query builder to return empty results
      jest.spyOn(productRepository, 'createQueryBuilder').mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      jest
        .spyOn(productDataService, 'searchProductsByName')
        .mockResolvedValue([mockProductDataWithIngredients]);

      jest
        .spyOn(service as any, 'shouldSearchOpenFoodFacts')
        .mockReturnValue(true);

      // Mock productRepository.findOne for the searchAndPopulateFromOFF method
      jest.spyOn(productRepository, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(service as any, 'matchIngredientsFromCategories')
        .mockResolvedValue([mockIngredient]);
      jest
        .spyOn(productRepository, 'create')
        .mockReturnValue(mockProductDataWithIngredients as any);
      jest
        .spyOn(productRepository, 'save')
        .mockResolvedValue(mockProductDataWithIngredients as any);

      const result = await service.findAll(filterDto);

      expect(productDataService.searchProductsByName).toHaveBeenCalledWith(
        'test',
        10,
      );
      expect(result).toEqual([mockProductDataWithIngredients]);
    });
  });

  describe('update', () => {
    it('should update product successfully', async () => {
      const updateDto = { name: 'Updated Product' };
      const updatedProduct = { ...mockProduct, ...updateDto };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(productRepository, 'save')
        .mockResolvedValue(updatedProduct as any);

      const result = await service.update('1', updateDto, mockUser as any);

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(productRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Product');
    });

    it('should throw ForbiddenException for non-owner manual product', async () => {
      const manualProduct = {
        ...mockProduct,
        code: null,
        createdBy: 'other-user-id',
      };
      const updateDto = { name: 'Updated Product' };

      jest.spyOn(service, 'findOne').mockResolvedValue(manualProduct as any);

      await expect(
        service.update('1', updateDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove product successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockProduct as any);
      jest
        .spyOn(productRepository, 'remove')
        .mockResolvedValue(mockProduct as any);

      await service.remove('1', mockUser as any);

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
    });

    it('should throw ForbiddenException for non-owner manual product', async () => {
      const manualProduct = {
        ...mockProduct,
        code: null,
        createdBy: 'other-user-id',
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(manualProduct as any);

      await expect(service.remove('1', mockUser as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('convertCategoriesToIngredientTags', () => {
    it('should convert plural categories to singular tags', () => {
      const categories = ['en:waters', 'en:mineral-waters'];
      const result = service['convertCategoriesToIngredientTags'](categories);

      expect(result).toContain('en:water');
      expect(result).toContain('en:mineral-water');
    });

    it('should handle categories without conversion mapping', () => {
      const categories = ['en:unknown-category'];
      const result = service['convertCategoriesToIngredientTags'](categories);

      expect(result).toContain('en:unknown-category');
    });
  });

  describe('selectMostGenericIngredient', () => {
    it('should select most generic ingredient', () => {
      const ingredients = [
        { ...mockIngredient, offTag: 'en:natural-mineral-water' },
        { ...mockIngredient, offTag: 'en:water' },
        { ...mockIngredient, offTag: 'en:mineral-water' },
      ];

      const result = service['selectMostGenericIngredient'](ingredients as any);

      expect(result).toBeDefined();
      expect(result?.offTag).toBe('en:water');
    });

    it('should return first ingredient when no generic score found', () => {
      const ingredients = [
        { ...mockIngredient, offTag: 'en:unknown-ingredient-1' },
        { ...mockIngredient, offTag: 'en:unknown-ingredient-2' },
      ];

      const result = service['selectMostGenericIngredient'](ingredients as any);

      expect(result).toEqual(ingredients[0]);
    });

    it('should return null for empty ingredient list', () => {
      const result = service['selectMostGenericIngredient']([]);

      expect(result).toBeNull();
    });
  });
});
