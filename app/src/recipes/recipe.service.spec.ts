/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PieceUnit } from '../common/units/unit.enums';
import { StockLog } from '../stocks/entities/stock-log.entity';
import { Stock } from '../stocks/entities/stock.entity';
import { Role } from '../users/enums/role.enum';
import { Difficulty, NutriScore } from './dto/create-recipe.dto';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeService } from './recipe.service';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';

describe('RecipeService', () => {
  let service: RecipeService;
  let recipeRepository: Repository<Recipe>;
  let recipeIngredientRepository: Repository<RecipeIngredient>;
  let stockRepository: Repository<Stock>;
  let stockLogRepository: Repository<StockLog>;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: '1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'hashedpassword', // NOSONAR - mock value for tests
    isActive: true,
    googleId: undefined,
    appleId: undefined,
    profilePicture: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    stocks: [],
    preferences: {},
    notificationSettings: {},
    fcmToken: null,
    isEmailVerified: true,
    roles: [Role.USER],
  };

  const mockIngredient = {
    id: '1',
    name: 'Tomato',
    offTag: 'en:tomato',
    products: [],
  };

  const mockRecipe = {
    id: '1',
    name: 'Test Recipe',
    description: 'A delicious test recipe',
    instructions: 'Mix and cook',
    preparationTime: 30,
    cookingTime: 20,
    servings: 4,
    difficulty: Difficulty.EASY,
    imageUrl: 'https://example.com/image.jpg',
    ingredients: [
      {
        id: '1',
        ingredient: mockIngredient,
        quantity: 2,
        unit: PieceUnit.PIECE,
      },
    ],
    createdBy: mockUser,
    tags: ['vegetarian'],
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStock = {
    id: '1',
    product: {
      id: '1',
      name: 'Tomato Product',
      ingredients: [mockIngredient],
    },
    user: mockUser,
    quantity: 5,
    unit: PieceUnit.PIECE,
    dlc: new Date('2025-12-31'),
  };

  const mockCreateRecipeDto = {
    name: 'Test Recipe',
    description: 'A delicious test recipe',
    instructions: 'Mix and cook',
    preparationTime: 30,
    cookingTime: 20,
    servings: 4,
    difficulty: Difficulty.EASY,
    imageUrl: 'https://example.com/image.jpg',
    nutriScore: NutriScore.A,
    categories: ['dessert'],
    ingredients: [
      {
        ingredientId: '1',
        quantity: 2,
        unit: PieceUnit.PIECE,
      },
    ],
    tags: ['vegetarian'],
  };

  const mockValidateRecipeDto = {
    servings: 6,
    notes: 'Making for 6 people',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        {
          provide: getRepositoryToken(Recipe),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            remove: jest.fn(),
            merge: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: {
            find: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(StockLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
    recipeRepository = module.get<Repository<Recipe>>(
      getRepositoryToken(Recipe),
    );
    recipeIngredientRepository = module.get<Repository<RecipeIngredient>>(
      getRepositoryToken(RecipeIngredient),
    );
    stockRepository = module.get<Repository<Stock>>(getRepositoryToken(Stock));
    stockLogRepository = module.get<Repository<StockLog>>(
      getRepositoryToken(StockLog),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create recipe successfully', async () => {
      jest.spyOn(recipeRepository, 'create').mockReturnValue(mockRecipe as any);
      jest.spyOn(recipeRepository, 'save').mockResolvedValue(mockRecipe as any);
      jest
        .spyOn(recipeRepository, 'findOne')
        .mockResolvedValue(mockRecipe as any); // Mock the findOne call after creation
      jest
        .spyOn(recipeIngredientRepository, 'create')
        .mockReturnValue({} as any);
      jest
        .spyOn(recipeIngredientRepository, 'save')
        .mockResolvedValue({} as any);

      const result = await service.create(mockCreateRecipeDto);

      expect(recipeRepository.create).toHaveBeenCalled();
      expect(recipeRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
      expect(result).toEqual(mockRecipe);
    });

    it('should handle recipe without ingredients', async () => {
      const recipeWithoutIngredients = {
        ...mockCreateRecipeDto,
        ingredients: [],
      };

      jest.spyOn(recipeRepository, 'create').mockReturnValue(mockRecipe as any);
      jest.spyOn(recipeRepository, 'save').mockResolvedValue(mockRecipe as any);
      jest
        .spyOn(recipeRepository, 'findOne')
        .mockResolvedValue(mockRecipe as any);

      const result = await service.create(recipeWithoutIngredients);

      expect(result).toEqual(mockRecipe);
    });
  });

  // Note: findAll tests are omitted due to complex pagination implementation

  describe('findOne', () => {
    it('should return recipe with relations', async () => {
      jest
        .spyOn(recipeRepository, 'findOne')
        .mockResolvedValue(mockRecipe as any);

      const result = await service.findOne('1');

      expect(recipeRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['ingredients', 'ingredients.ingredient'],
      });
      expect(result).toEqual(mockRecipe);
    });

    it('should throw NotFoundException for non-existent recipe', async () => {
      jest.spyOn(recipeRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update recipe successfully', async () => {
      const updateDto = { name: 'Updated Recipe' };
      const updatedRecipe = { ...mockRecipe, name: 'Updated Recipe' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecipe as any);
      jest
        .spyOn(recipeRepository, 'merge')
        .mockReturnValue(updatedRecipe as any);
      jest
        .spyOn(recipeRepository, 'save')
        .mockResolvedValue(updatedRecipe as any);
      jest
        .spyOn(recipeRepository, 'findOne')
        .mockResolvedValue(updatedRecipe as any);

      const result = await service.update('1', updateDto);

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(recipeRepository.merge).toHaveBeenCalledWith(
        mockRecipe,
        updateDto,
      );
      expect(recipeRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedRecipe);
    });

    it('should throw error when recipe not found for update', async () => {
      const updateDto = { name: 'Updated Recipe' };

      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException());

      await expect(service.update('1', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove recipe successfully', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockRecipe as any);
      jest
        .spyOn(recipeRepository, 'remove')
        .mockResolvedValue(mockRecipe as any);

      await service.remove('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(recipeRepository.remove).toHaveBeenCalledWith(mockRecipe);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'RecipeDeleted',
        mockRecipe,
      );
    });

    it('should throw error when recipe not found for removal', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException());

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });

  // Note: validateRecipe tests are omitted as they require complex dependencies
  // that are not easily mockable in this simple test setup
});
