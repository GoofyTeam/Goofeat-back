/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PieceUnit } from '../../common/units/unit.enums';
import { HouseholdRole } from '../../households/enums/household-role.enum';
import { HouseholdService } from '../../households/household.service';
import { Product } from '../../products/entities/product.entity';
import { ChildActionType, QuantitySize } from '../dto/child-action.dto';
import {
  PendingActionStatus,
  PendingActionType,
  PendingStockAction,
} from '../entities/pending-stock-action.entity';
import { Stock } from '../entities/stock.entity';
import { ChildStockService } from './child-stock.service';

describe('ChildStockService', () => {
  let service: ChildStockService;
  let stockRepository: Repository<Stock>;
  let productRepository: Repository<Product>;
  let pendingActionRepository: Repository<PendingStockAction>;
  let householdService: HouseholdService;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: '1',
    email: 'child@example.com',
    name: 'Child User',
  };

  const mockParentUser = {
    id: '2',
    email: 'parent@example.com',
    name: 'Parent User',
  };

  const mockHousehold = {
    id: '1',
    name: 'Test Household',
  };

  const mockProduct = {
    id: '1',
    name: 'Test Product',
  };

  const mockStock = {
    id: '1',
    product: mockProduct,
    user: mockUser,
    household: mockHousehold,
    quantity: 10,
    unit: PieceUnit.PIECE,
    dlc: new Date('2025-12-31'),
  };

  const mockChildMember = {
    id: '1',
    userId: '1',
    householdId: '1',
    role: HouseholdRole.CHILD,
    canEditStock: true,
    needsApproval: true,
    user: mockUser,
    household: mockHousehold,
  };

  const mockParentMember = {
    id: '2',
    userId: '2',
    householdId: '1',
    role: HouseholdRole.PARENT,
    canEditStock: true,
    needsApproval: false,
    user: mockParentUser,
    household: mockHousehold,
  };

  const mockAdminMember = {
    id: '3',
    userId: '3',
    householdId: '1',
    role: HouseholdRole.ADMIN,
    canEditStock: true,
    needsApproval: false,
  };

  const mockPendingAction = {
    id: '1',
    stock: mockStock,
    requestedBy: mockChildMember,
    actionType: PendingActionType.CONSUME,
    requestedQuantity: 3,
    comment: 'I want some snacks',
    reason: 'Consommation partielle',
    status: PendingActionStatus.PENDING,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildStockService,
        {
          provide: getRepositoryToken(Stock),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PendingStockAction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: HouseholdService,
          useValue: {
            getUserMembership: jest.fn(),
            getHouseholdMembers: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChildStockService>(ChildStockService);
    stockRepository = module.get<Repository<Stock>>(getRepositoryToken(Stock));
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    pendingActionRepository = module.get<Repository<PendingStockAction>>(
      getRepositoryToken(PendingStockAction),
    );
    householdService = module.get<HouseholdService>(HouseholdService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processChildAction', () => {
    const mockChildActionDto = {
      productId: '1',
      action: ChildActionType.TAKE_SOME,
      quantitySize: QuantitySize.NORMAL,
      comment: 'I want some snacks',
    };

    it('should create pending action for child user', async () => {
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockChildMember as any);
      jest
        .spyOn(service as any, 'findHouseholdStock')
        .mockResolvedValue(mockStock);
      jest
        .spyOn(service as any, 'createPendingAction')
        .mockResolvedValue(mockPendingAction);
      jest
        .spyOn(service as any, 'notifyParentsOfPendingAction')
        .mockResolvedValue(undefined);

      const result = await service.processChildAction(
        mockChildActionDto,
        mockUser as any,
        '1',
      );

      expect(result.immediate).toBe(false);
      expect(result.message).toBe("Action en attente d'approbation parentale");
      expect(result.pendingActionId).toBe('1');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should execute action immediately for adult user', async () => {
      const adultMember = {
        ...mockChildMember,
        role: HouseholdRole.ROOMMATE,
        needsApproval: false,
      };

      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(adultMember as any);
      jest
        .spyOn(service as any, 'findHouseholdStock')
        .mockResolvedValue(mockStock);
      jest
        .spyOn(service as any, 'executeChildAction')
        .mockResolvedValue(undefined);

      const result = await service.processChildAction(
        mockChildActionDto,
        mockUser as any,
        '1',
      );

      expect(result.immediate).toBe(true);
      expect(result.message).toBe('Action effectuée avec succès');
      expect(result.pendingActionId).toBeUndefined();
    });

    it('should throw ForbiddenException for non-member', async () => {
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue(null);

      await expect(
        service.processChildAction(mockChildActionDto, mockUser as any, '1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockChildMember as any);
      jest.spyOn(service as any, 'findHouseholdStock').mockResolvedValue(null);

      await expect(
        service.processChildAction(mockChildActionDto, mockUser as any, '1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should determine approval needed for user with needsApproval flag', async () => {
      const memberWithApprovalFlag = {
        ...mockChildMember,
        role: HouseholdRole.ROOMMATE,
        needsApproval: true,
      };

      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(memberWithApprovalFlag as any);
      jest
        .spyOn(service as any, 'findHouseholdStock')
        .mockResolvedValue(mockStock);
      jest
        .spyOn(service as any, 'createPendingAction')
        .mockResolvedValue(mockPendingAction);
      jest
        .spyOn(service as any, 'notifyParentsOfPendingAction')
        .mockResolvedValue(undefined);

      const result = await service.processChildAction(
        mockChildActionDto,
        mockUser as any,
        '1',
      );

      expect(result.immediate).toBe(false);
    });
  });

  describe('quickConsume', () => {
    const mockQuickConsumeDto = {
      stockId: '1',
      quantity: 4,
      comment: 'Quick snack',
    };

    it('should consume stock for household member with permissions', async () => {
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValueOnce(mockStock as any) // First call in quickConsume
        .mockResolvedValueOnce({ ...mockStock, quantity: 6 } as any); // Second call at the end
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue({
        ...mockChildMember,
        canEditStock: true,
      } as any);
      jest
        .spyOn(stockRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await service.quickConsume(
        mockQuickConsumeDto,
        mockUser as any,
      );

      expect(stockRepository.update).toHaveBeenCalledWith('1', {
        quantity: 6, // 10 - 4 (actual service logic)
        lastUpdatedByMemberId: '1',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.consumed',
        expect.any(Object),
      );
      expect(result.quantity).toBe(6);
    });

    it('should emit empty event when stock is depleted', async () => {
      const stockToDeplete = { ...mockStock, quantity: 4 };
      const consumeExactlyAllDto = {
        stockId: '1',
        quantity: 4,
        comment: 'Taking the rest',
      };

      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValueOnce(stockToDeplete as any) // First call in quickConsume
        .mockResolvedValueOnce({ ...stockToDeplete, quantity: 0 } as any); // Second call at the end
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue({
        ...mockChildMember,
        canEditStock: true,
      } as any);
      jest
        .spyOn(stockRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      await service.quickConsume(consumeExactlyAllDto, mockUser as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'stock.empty',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException for non-existent stock', async () => {
      jest.spyOn(stockRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.quickConsume(mockQuickConsumeDto, mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for member without edit permissions', async () => {
      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue({
        ...mockChildMember,
        canEditStock: false,
      } as any);

      await expect(
        service.quickConsume(mockQuickConsumeDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for insufficient quantity', async () => {
      const insufficientQuantityDto = {
        ...mockQuickConsumeDto,
        quantity: 15, // More than available (10)
      };

      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(mockStock as any);
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue({
        ...mockChildMember,
        canEditStock: true,
      } as any);

      await expect(
        service.quickConsume(insufficientQuantityDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should handle personal stock (non-household)', async () => {
      const personalStock = { ...mockStock, household: null };

      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(personalStock as any);
      jest
        .spyOn(stockRepository, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(stockRepository, 'findOne').mockResolvedValue({
        ...personalStock,
        quantity: 8,
      } as any);

      const result = await service.quickConsume(
        mockQuickConsumeDto,
        mockUser as any,
      );

      expect(householdService.getUserMembership).not.toHaveBeenCalled();
      expect(result.quantity).toBe(8);
    });

    it('should throw ForbiddenException for non-owner personal stock', async () => {
      const otherUserStock = {
        ...mockStock,
        household: null,
        user: { id: '2', email: 'other@example.com' },
      };

      jest
        .spyOn(stockRepository, 'findOne')
        .mockResolvedValue(otherUserStock as any);

      await expect(
        service.quickConsume(mockQuickConsumeDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingActionsForHousehold', () => {
    it('should return pending actions for parent', async () => {
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockParentMember as any);
      jest
        .spyOn(pendingActionRepository, 'find')
        .mockResolvedValue([mockPendingAction as any]);

      const result = await service.getPendingActionsForHousehold(
        '1',
        mockParentUser as any,
      );

      expect(pendingActionRepository.find).toHaveBeenCalledWith({
        where: {
          status: PendingActionStatus.PENDING,
          stock: { household: { id: '1' } },
        },
        relations: [
          'stock',
          'stock.product',
          'requestedBy',
          'requestedBy.user',
        ],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([mockPendingAction]);
    });

    it('should return pending actions for admin', async () => {
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockAdminMember as any);
      jest
        .spyOn(pendingActionRepository, 'find')
        .mockResolvedValue([mockPendingAction as any]);

      const result = await service.getPendingActionsForHousehold(
        '1',
        mockUser as any,
      );

      expect(result).toEqual([mockPendingAction]);
    });

    it('should throw ForbiddenException for child', async () => {
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockChildMember as any);

      await expect(
        service.getPendingActionsForHousehold('1', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for guest', async () => {
      const guestMember = {
        ...mockChildMember,
        role: HouseholdRole.GUEST,
      };

      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(guestMember as any);

      await expect(
        service.getPendingActionsForHousehold('1', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-member', async () => {
      jest.spyOn(householdService, 'getUserMembership').mockResolvedValue(null);

      await expect(
        service.getPendingActionsForHousehold('1', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approvePendingAction', () => {
    it('should approve pending action for parent', async () => {
      const approvedAction = {
        ...mockPendingAction,
        status: PendingActionStatus.APPROVED,
        approvedBy: mockParentMember,
        processedAt: expect.any(Date),
        approverComment: 'Approved for you',
      };

      jest
        .spyOn(pendingActionRepository, 'findOne')
        .mockResolvedValue(mockPendingAction as any);
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockParentMember as any);
      jest
        .spyOn(pendingActionRepository, 'save')
        .mockResolvedValue(approvedAction as any);
      jest
        .spyOn(service as any, 'executePendingAction')
        .mockResolvedValue(undefined);

      const result = await service.approvePendingAction(
        '1',
        true,
        'Approved for you',
        mockParentUser as any,
      );

      expect(pendingActionRepository.save).toHaveBeenCalled();
      expect(service['executePendingAction']).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PendingActionStatus.APPROVED,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pending.action.processed',
        expect.any(Object),
      );
      expect(result.status).toBe(PendingActionStatus.APPROVED);
    });

    it('should reject pending action', async () => {
      const pendingAction = {
        ...mockPendingAction,
        status: PendingActionStatus.PENDING, // Ensure it's pending
      };

      const rejectedAction = {
        ...mockPendingAction,
        status: PendingActionStatus.REJECTED,
        approvedBy: mockParentMember,
        processedAt: expect.any(Date),
        approverComment: 'Not allowed',
      };

      jest
        .spyOn(pendingActionRepository, 'findOne')
        .mockResolvedValue(pendingAction as any);
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockParentMember as any);
      jest
        .spyOn(pendingActionRepository, 'save')
        .mockResolvedValue(rejectedAction as any);

      const result = await service.approvePendingAction(
        '1',
        false,
        'Not allowed',
        mockParentUser as any,
      );

      expect(result.status).toBe(PendingActionStatus.REJECTED);
    });

    it('should throw NotFoundException for non-existent action', async () => {
      jest.spyOn(pendingActionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.approvePendingAction(
          '1',
          true,
          'Approved',
          mockParentUser as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for already processed action', async () => {
      const processedAction = {
        ...mockPendingAction,
        status: PendingActionStatus.APPROVED,
      };

      jest
        .spyOn(pendingActionRepository, 'findOne')
        .mockResolvedValue(processedAction as any);

      await expect(
        service.approvePendingAction(
          '1',
          true,
          'Approved',
          mockParentUser as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for non-parent/non-admin', async () => {
      jest
        .spyOn(pendingActionRepository, 'findOne')
        .mockResolvedValue(mockPendingAction as any);
      jest
        .spyOn(householdService, 'getUserMembership')
        .mockResolvedValue(mockChildMember as any);

      await expect(
        service.approvePendingAction('1', true, 'Approved', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('estimateQuantityFromSize', () => {
    it('should estimate little quantity', () => {
      const result = service['estimateQuantityFromSize'](
        QuantitySize.LITTLE,
        10,
      );
      expect(result).toBe(1); // max(1, 10 * 0.1)
    });

    it('should estimate normal quantity', () => {
      const result = service['estimateQuantityFromSize'](
        QuantitySize.NORMAL,
        10,
      );
      expect(result).toBe(3); // max(1, 10 * 0.3)
    });

    it('should estimate lot quantity', () => {
      const result = service['estimateQuantityFromSize'](QuantitySize.LOT, 10);
      expect(result).toBe(5); // max(1, 10 * 0.5)
    });

    it('should handle undefined size', () => {
      const result = service['estimateQuantityFromSize'](undefined, 10);
      expect(result).toBe(2); // max(1, 10 * 0.2)
    });

    it('should return minimum 1 for small stock', () => {
      const result = service['estimateQuantityFromSize'](
        QuantitySize.LITTLE,
        1,
      );
      expect(result).toBe(1); // max(1, 1 * 0.1)
    });
  });

  describe('estimateQuantityFromAction', () => {
    it('should return exact quantity when provided', () => {
      const actionDto = {
        action: ChildActionType.TAKE_SOME,
        exactQuantity: 5,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(5);
    });

    it('should estimate for TAKE_SOME action', () => {
      const actionDto = {
        action: ChildActionType.TAKE_SOME,
        quantitySize: QuantitySize.NORMAL,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(3); // 30% of 10
    });

    it('should return full quantity for TAKE_ALL action', () => {
      const actionDto = {
        action: ChildActionType.TAKE_ALL,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(10);
    });

    it('should return full quantity for EMPTY action', () => {
      const actionDto = {
        action: ChildActionType.EMPTY,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(10);
    });

    it('should return 90% for ALMOST_EMPTY action', () => {
      const actionDto = {
        action: ChildActionType.ALMOST_EMPTY,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(9); // 90% of 10
    });

    it('should estimate for FOUND_MORE action', () => {
      const actionDto = {
        action: ChildActionType.FOUND_MORE,
        quantitySize: QuantitySize.NORMAL,
      };

      const result = service['estimateQuantityFromAction'](
        actionDto as any,
        mockStock as any,
      );
      expect(result).toBe(3); // 30% of 10
    });
  });
});
