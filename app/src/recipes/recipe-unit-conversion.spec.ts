/* eslint-disable @typescript-eslint/unbound-method */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UnitConversionService } from '../common/units/unit-conversion.service';
import { MassUnit, VolumeUnit } from '../common/units/unit.enums';
import { HouseholdService } from '../households/household.service';
import { StockLog } from '../stocks/entities/stock-log.entity';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { ValidateRecipeDto } from './dto/validate-recipe.dto';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeService } from './recipe.service';

describe('RecipeService - Unit Conversion Tests', () => {
  let service: RecipeService;
  let recipeRepository: jest.Mocked<Repository<Recipe>>;
  let stockRepository: jest.Mocked<Repository<Stock>>;
  let stockLogRepository: jest.Mocked<Repository<StockLog>>;
  let unitConversionService: jest.Mocked<UnitConversionService>;
  let householdService: jest.Mocked<HouseholdService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Mock data
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
  } as User;

  const mockRecipe: Recipe = {
    id: 'recipe-1',
    name: 'Test Recipe',
    servings: 4,
    ingredients: [
      {
        id: 'ri-1',
        ingredientId: 'ingredient-1',
        quantity: 1.5,
        unit: VolumeUnit.L, // Recette demande 1.5L
        ingredient: { id: 'ingredient-1', name: 'Lait' },
      } as RecipeIngredient,
    ],
  } as Recipe;

  beforeEach(async () => {
    const mockRecipeRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockStockRepository = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const mockStockLogRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    // On utilise maintenant le vrai UnitConversionService au lieu d'un mock

    const mockHouseholdService = {
      getUserMembership: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        {
          provide: getRepositoryToken(Recipe),
          useValue: mockRecipeRepository,
        },
        {
          provide: getRepositoryToken(RecipeIngredient),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: mockStockRepository,
        },
        {
          provide: getRepositoryToken(StockLog),
          useValue: mockStockLogRepository,
        },
        {
          provide: UnitConversionService,
          useClass: UnitConversionService,
        },
        {
          provide: HouseholdService,
          useValue: mockHouseholdService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
    recipeRepository = module.get(getRepositoryToken(Recipe));
    stockRepository = module.get(getRepositoryToken(Stock));
    stockLogRepository = module.get(getRepositoryToken(StockLog));
    unitConversionService = module.get(UnitConversionService);
    householdService = module.get(HouseholdService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('validateRecipe - Unit Conversion Scenarios', () => {
    const validateRecipeDto: ValidateRecipeDto = {
      servings: 4,
      notes: 'Test',
    };

    beforeEach(() => {
      recipeRepository.findOne.mockResolvedValue(mockRecipe);
      stockLogRepository.create.mockReturnValue({} as StockLog);
      stockLogRepository.save.mockResolvedValue({} as StockLog);

      // Plus besoin de mocker - on utilise le vrai service !
    });

    it('should handle stock in ml and recipe in L', async () => {
      // Stock: 2000ml, Recipe needs: 1.5L
      const mockStock: Stock = {
        id: 'stock-1',
        quantity: 2,
        unit: VolumeUnit.ML,
        totalQuantity: 2000,
        baseUnit: VolumeUnit.ML,
        product: {
          id: 'product-1',
          name: 'Lait',
          unitSize: 1000, // 1000ml par pack
          packagingSize: 1,
          defaultUnit: VolumeUnit.ML,
          ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
        },
        dlc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
        createdAt: new Date(),
      } as Stock;

      stockRepository.find.mockResolvedValue([mockStock]);

      // Le vrai service fera automatiquement les conversions correctes

      const result = await service.validateRecipe(
        'recipe-1',
        validateRecipeDto,
        mockUser,
      );

      expect(result.success).toBe(true);
      expect(result.missingIngredients).toHaveLength(0);

      // Vérifier que la conversion a fonctionné correctement
      // Stock: 2000ml (2L), Recette: 1.5L → devrait rester 0.5L (500ml)
      expect(result.ingredientsUsed).toHaveLength(1);
      expect(result.ingredientsUsed[0].adjustedQuantity).toBe(1.5); // 1.5L utilisé

      // Vérifier que le stock est mis à jour correctement
      expect(stockRepository.update).toHaveBeenCalledWith('stock-1', {
        quantity: 0.5, // 0.5 pack restant
        totalQuantity: 500, // 500ml restant
        baseUnit: VolumeUnit.ML,
      });
    });

    it('should handle stock in L and recipe in ml', async () => {
      // Stock: 2L, Recipe needs: 1500ml
      const mockRecipeWithMl = {
        ...mockRecipe,
        ingredients: [
          {
            ...mockRecipe.ingredients[0],
            quantity: 1500,
            unit: VolumeUnit.ML, // Recette en ml
          },
        ],
      };

      recipeRepository.findOne.mockResolvedValue(mockRecipeWithMl as Recipe);

      const mockStock: Stock = {
        id: 'stock-1',
        quantity: 2,
        unit: VolumeUnit.L,
        totalQuantity: 2,
        baseUnit: VolumeUnit.L,
        product: {
          id: 'product-1',
          name: 'Lait',
          unitSize: 1, // 1L par pack
          packagingSize: 1,
          defaultUnit: VolumeUnit.L,
          ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
        },
        dlc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as Stock;

      stockRepository.find.mockResolvedValue([mockStock]);

      // Le vrai service fera automatiquement les conversions correctes

      const result = await service.validateRecipe(
        'recipe-1',
        validateRecipeDto,
        mockUser,
      );

      expect(result.success).toBe(true);
      expect(result.missingIngredients).toHaveLength(0);

      // Vérifier que la conversion L → ml a fonctionné
      // Stock: 2L, Recette: 1500ml → devrait rester 0.5L
      expect(result.ingredientsUsed).toHaveLength(1);
      expect(result.ingredientsUsed[0].adjustedQuantity).toBe(1500); // 1500ml utilisé
    });

    it('should fail with incompatible units (volume vs mass)', async () => {
      // Stock: 2L (liquide), Recipe needs: 500g (masse)
      const mockRecipeWithMass = {
        ...mockRecipe,
        ingredients: [
          {
            ...mockRecipe.ingredients[0],
            quantity: 500,
            unit: MassUnit.G, // Recette en grammes
          },
        ],
      };

      recipeRepository.findOne.mockResolvedValue(mockRecipeWithMass as Recipe);

      const mockStock: Stock = {
        id: 'stock-1',
        quantity: 2,
        unit: VolumeUnit.L, // Stock en litres
        totalQuantity: 2,
        baseUnit: VolumeUnit.L,
        product: {
          id: 'product-1',
          name: 'Lait',
          unitSize: 1,
          packagingSize: 1,
          defaultUnit: VolumeUnit.L,
          ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
        },
        dlc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as Stock;

      stockRepository.find.mockResolvedValue([mockStock]);

      // Le vrai service retournera null pour les conversions incompatibles

      const result = await service.validateRecipe(
        'recipe-1',
        validateRecipeDto,
        mockUser,
      );

      expect(result.success).toBe(false);
      expect(result.missingIngredients).toHaveLength(1);
      expect(result.missingIngredients![0].availableQuantity).toBe(0); // Pas de conversion possible
    });

    it('should aggregate multiple stocks with mixed units', async () => {
      // Stock: 500ml + 1L + 750ml = 2.25L total, Recipe needs: 2L
      const mockStocks: Stock[] = [
        {
          id: 'stock-1',
          quantity: 0.5,
          unit: VolumeUnit.L,
          totalQuantity: 0.5,
          baseUnit: VolumeUnit.L,
          product: {
            id: 'product-1',
            name: 'Lait',
            unitSize: 1,
            packagingSize: 1,
            defaultUnit: VolumeUnit.L,
            ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
          },
          dlc: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // DLC dans 5 jours (plus proche)
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'stock-2',
          quantity: 1, // 1 pack
          unit: VolumeUnit.ML,
          totalQuantity: 1000,
          baseUnit: VolumeUnit.ML,
          product: {
            id: 'product-1',
            name: 'Lait',
            unitSize: 1000, // 1000ml par pack
            packagingSize: 1,
            defaultUnit: VolumeUnit.ML,
            ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
          },
          dlc: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // DLC dans 10 jours
          createdAt: new Date('2024-01-02'),
        },
        {
          id: 'stock-3',
          quantity: 1, // 1 pack
          unit: VolumeUnit.ML,
          totalQuantity: 750,
          baseUnit: VolumeUnit.ML,
          product: {
            id: 'product-1',
            name: 'Lait',
            unitSize: 750, // 750ml par pack
            packagingSize: 1,
            defaultUnit: VolumeUnit.ML,
            ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
          },
          dlc: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // DLC dans 15 jours (plus loin)
          createdAt: new Date('2024-01-03'),
        },
      ] as Stock[];

      stockRepository.find.mockResolvedValue(mockStocks);

      // Le vrai service fera automatiquement les conversions correctes

      const result = await service.validateRecipe(
        'recipe-1',
        { ...validateRecipeDto, servings: 4 }, // 1.5L × 1 = 1.5L needed
        mockUser,
      );

      expect(result.success).toBe(true);

      // Vérifier l'ordre FIFO : stock-1 (DLC plus proche) utilisé en premier
      expect(stockRepository.update).toHaveBeenCalledWith('stock-1', {
        quantity: 0, // Stock complètement épuisé
        totalQuantity: 0,
        baseUnit: VolumeUnit.L,
      });

      expect(stockRepository.update).toHaveBeenCalledWith('stock-2', {
        quantity: 0, // Stock complètement épuisé
        totalQuantity: 0,
        baseUnit: VolumeUnit.ML,
      });

      // stock-3 ne devrait pas être touché car les 1.5L sont couverts par stock-1 et stock-2
      expect(stockRepository.update).not.toHaveBeenCalledWith(
        'stock-3',
        expect.anything(),
      );
    });

    it('should handle recipe scaling with unit conversion', async () => {
      // Recipe pour 4 personnes demande 1.5L, on fait pour 8 personnes = 3L
      const mockStock: Stock = {
        id: 'stock-1',
        quantity: 3.5,
        unit: VolumeUnit.L,
        totalQuantity: 3.5,
        baseUnit: VolumeUnit.L,
        product: {
          id: 'product-1',
          name: 'Lait',
          unitSize: 1,
          packagingSize: 1,
          defaultUnit: VolumeUnit.L,
          ingredients: [{ id: 'ingredient-1', name: 'Lait' }],
        },
        dlc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as Stock;

      stockRepository.find.mockResolvedValue([mockStock]);

      // Le vrai service fera automatiquement les conversions et calculs corrects

      const result = await service.validateRecipe(
        'recipe-1',
        { ...validateRecipeDto, servings: 8 }, // Double la recette : 1.5L × 2 = 3L
        mockUser,
      );

      expect(result.success).toBe(true);
      expect(result.recipe.scalingRatio).toBe(2); // 8 / 4 = 2

      // Vérifier que la quantité est bien calculée avec le scaling
      // adjustedQuantity = 1.5L × 2 = 3L
      expect(result.ingredientsUsed[0].adjustedQuantity).toBe(3);
      expect(result.ingredientsUsed[0].originalQuantity).toBe(1.5);
    });
  });
});
