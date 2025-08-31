/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { HouseholdService } from './household.service';
import { Household } from './entities/household.entity';
import { HouseholdMember } from './entities/household-member.entity';
import { User } from '../users/entity/user.entity';
import { HouseholdRole } from './enums/household-role.enum';
import { HouseholdType } from './enums/household-type.enum';
import { HouseholdSettingsService } from './services/household-settings.service';

describe('HouseholdService', () => {
  let service: HouseholdService;
  let householdRepository: Repository<Household>;
  let memberRepository: Repository<HouseholdMember>;
  let userRepository: Repository<User>;
  let eventEmitter: EventEmitter2;
  let householdSettingsService: HouseholdSettingsService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockOtherUser = {
    id: '2',
    email: 'other@example.com',
    name: 'Other User',
  };

  const mockHousehold = {
    id: '1',
    name: 'Test Household',
    type: HouseholdType.FAMILY,
    inviteCode: 'ABC123',
    inviteCodeExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    description: 'Test household description',
    settings: {},
    isActive: true,
    members: [],
    stocks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMember = {
    id: '1',
    userId: '1',
    householdId: '1',
    role: HouseholdRole.ADMIN,
    canEditStock: true,
    needsApproval: false,
    canViewAllStocks: true,
    canInviteMembers: true,
    nickname: 'Admin',
    joinedAt: new Date(),
    isActive: true,
    user: mockUser,
    household: mockHousehold,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateHouseholdDto = {
    name: 'Test Household',
    type: HouseholdType.FAMILY,
    description: 'Test household description',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseholdService,
        {
          provide: getRepositoryToken(Household),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(HouseholdMember),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
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
          provide: HouseholdSettingsService,
          useValue: {
            mergeSettings: jest.fn(),
            getSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HouseholdService>(HouseholdService);
    householdRepository = module.get<Repository<Household>>(
      getRepositoryToken(Household),
    );
    memberRepository = module.get<Repository<HouseholdMember>>(
      getRepositoryToken(HouseholdMember),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    householdSettingsService = module.get<HouseholdSettingsService>(
      HouseholdSettingsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create household and add creator as admin', async () => {
      const savedHousehold = { ...mockHousehold, id: '1' };
      const savedMember = { ...mockMember, id: '1' };

      jest
        .spyOn(householdRepository, 'create')
        .mockReturnValue(mockHousehold as any);
      jest
        .spyOn(householdRepository, 'save')
        .mockResolvedValue(savedHousehold as any);
      jest
        .spyOn(memberRepository, 'create')
        .mockReturnValue(savedMember as any);
      jest
        .spyOn(memberRepository, 'save')
        .mockResolvedValue(savedMember as any);
      jest.spyOn(householdRepository, 'findOne').mockResolvedValue({
        ...savedHousehold,
        members: [savedMember],
      } as any);

      // Mock generateInviteCode
      jest
        .spyOn(service as any, 'generateInviteCode')
        .mockReturnValue('ABC123');

      const result = await service.create(
        mockCreateHouseholdDto,
        mockUser as any,
      );

      expect(householdRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockCreateHouseholdDto,
          inviteCode: 'ABC123',
        }),
      );
      expect(memberRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        householdId: savedHousehold.id,
        role: HouseholdRole.ADMIN,
        canEditStock: true,
        canViewAllStocks: true,
        canInviteMembers: true,
        needsApproval: false,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.created',
        expect.any(Object),
      );
      expect(result.members).toHaveLength(1);
    });

    it('should generate invite code with expiration', async () => {
      jest
        .spyOn(householdRepository, 'create')
        .mockReturnValue(mockHousehold as any);
      jest
        .spyOn(householdRepository, 'save')
        .mockResolvedValue(mockHousehold as any);
      jest.spyOn(memberRepository, 'create').mockReturnValue(mockMember as any);
      jest.spyOn(memberRepository, 'save').mockResolvedValue(mockMember as any);
      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(mockHousehold as any);

      await service.create(mockCreateHouseholdDto, mockUser as any);

      expect(householdRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteCode: expect.any(String),
          inviteCodeExpiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all households for user', async () => {
      const memberships = [{ ...mockMember, household: mockHousehold }];

      jest
        .spyOn(memberRepository, 'find')
        .mockResolvedValue(memberships as any);

      const result = await service.findAll(mockUser as any);

      expect(memberRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUser.id, isActive: true },
        relations: ['household', 'household.members', 'household.members.user'],
      });
      expect(result).toEqual([mockHousehold]);
    });

    it('should return empty array for user with no households', async () => {
      jest.spyOn(memberRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll(mockUser as any);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return household for member', async () => {
      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(mockHousehold as any);
      jest
        .spyOn(service as any, 'getMembershipOrThrow')
        .mockResolvedValue(mockMember);

      const result = await service.findOne('1', mockUser as any);

      expect(householdRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['members', 'members.user', 'stocks', 'stocks.product'],
      });
      expect(result).toEqual(mockHousehold);
    });

    it('should throw NotFoundException for non-existent household', async () => {
      jest.spyOn(householdRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('1', mockUser as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-member', async () => {
      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(mockHousehold as any);
      jest
        .spyOn(service as any, 'getMembershipOrThrow')
        .mockRejectedValue(
          new ForbiddenException("Vous n'êtes pas membre de ce foyer"),
        );

      await expect(service.findOne('1', mockUser as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update household for admin', async () => {
      const updateDto = { name: 'Updated Household' };
      const updatedHousehold = { ...mockHousehold, ...updateDto };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest
        .spyOn(householdRepository, 'save')
        .mockResolvedValue(updatedHousehold as any);

      const result = await service.update('1', updateDto, mockUser as any);

      expect(householdRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.updated',
        expect.any(Object),
      );
      expect(result.name).toBe('Updated Household');
    });

    it('should throw ForbiddenException for non-admin', async () => {
      const updateDto = { name: 'Updated Household' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ROOMMATE,
      });

      await expect(
        service.update('1', updateDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove household for admin', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest.spyOn(householdRepository, 'remove').mockResolvedValue({} as any);

      await service.remove('1', mockUser as any);

      expect(householdRepository.remove).toHaveBeenCalledWith(mockHousehold);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.deleted',
        expect.any(Object),
      );
    });

    it('should throw ForbiddenException for non-admin', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ROOMMATE,
      });

      await expect(service.remove('1', mockUser as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('generateNewInviteCode', () => {
    it('should generate new invite code for admin', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest.spyOn(householdRepository, 'update').mockResolvedValue({} as any);
      jest
        .spyOn(service as any, 'generateInviteCode')
        .mockReturnValue('XYZ789');

      const result = await service.generateNewInviteCode('1', mockUser as any);

      expect(householdRepository.update).toHaveBeenCalledWith('1', {
        inviteCode: 'XYZ789',
        inviteCodeExpiresAt: expect.any(Date),
      });
      expect(result).toBe('XYZ789');
    });

    it('should generate new invite code for member with invite permission', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.PARENT,
        canInviteMembers: true,
      });
      jest.spyOn(householdRepository, 'update').mockResolvedValue({} as any);
      jest
        .spyOn(service as any, 'generateInviteCode')
        .mockReturnValue('XYZ789');

      const result = await service.generateNewInviteCode('1', mockUser as any);

      expect(result).toBe('XYZ789');
    });

    it('should throw ForbiddenException for member without invite permission', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.CHILD,
        canInviteMembers: false,
      });

      await expect(
        service.generateNewInviteCode('1', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('joinHousehold', () => {
    it('should join household with valid invite code', async () => {
      const joinDto = { inviteCode: 'ABC123', nickname: 'New Member' };
      const householdWithMembers = { ...mockHousehold, members: [mockMember] };

      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(mockHousehold as any);
      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(memberRepository, 'create').mockReturnValue({
        ...mockMember,
        role: HouseholdRole.ROOMMATE,
        nickname: 'New Member',
      } as any);
      jest.spyOn(memberRepository, 'save').mockResolvedValue({} as any);
      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(householdWithMembers as any);

      const result = await service.joinHousehold(joinDto, mockOtherUser as any);

      expect(memberRepository.create).toHaveBeenCalledWith({
        userId: mockOtherUser.id,
        householdId: mockHousehold.id,
        role: HouseholdRole.ROOMMATE,
        nickname: 'New Member',
        canEditStock: true,
        canViewAllStocks: true,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.member.joined',
        expect.any(Object),
      );
      expect(result).toEqual(householdWithMembers);
    });

    it('should throw BadRequestException for invalid invite code', async () => {
      const joinDto = { inviteCode: 'INVALID', nickname: 'New Member' };

      jest.spyOn(householdRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.joinHousehold(joinDto, mockOtherUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired invite code', async () => {
      const joinDto = { inviteCode: 'ABC123', nickname: 'New Member' };
      const expiredHousehold = {
        ...mockHousehold,
        inviteCodeExpiresAt: new Date(Date.now() - 1000), // Expired
      };

      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(expiredHousehold as any);

      await expect(
        service.joinHousehold(joinDto, mockOtherUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already existing member', async () => {
      const joinDto = { inviteCode: 'ABC123', nickname: 'New Member' };

      jest
        .spyOn(householdRepository, 'findOne')
        .mockResolvedValue(mockHousehold as any);
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(mockMember as any);

      await expect(
        service.joinHousehold(joinDto, mockOtherUser as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMember', () => {
    it('should allow admin to update any member', async () => {
      const updateDto = { role: HouseholdRole.PARENT };
      const memberToUpdate = { ...mockMember, id: '2', userId: '2' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(memberToUpdate as any);
      jest.spyOn(memberRepository, 'save').mockResolvedValue({
        ...memberToUpdate,
        ...updateDto,
      } as any);

      const result = await service.updateMember(
        '1',
        '2',
        updateDto,
        mockUser as any,
      );

      expect(memberRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.member.updated',
        expect.any(Object),
      );
      expect(result.role).toBe(HouseholdRole.PARENT);
    });

    it('should allow member to update their own profile', async () => {
      const updateDto = { nickname: 'New Nickname' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest
        .spyOn(service as any, 'getMembershipOrThrow')
        .mockResolvedValue(mockMember);
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(mockMember as any);
      jest.spyOn(memberRepository, 'save').mockResolvedValue({
        ...mockMember,
        ...updateDto,
      } as any);

      const result = await service.updateMember(
        '1',
        '1',
        updateDto,
        mockUser as any,
      );

      expect(result.nickname).toBe('New Nickname');
    });

    it('should throw ForbiddenException for non-admin updating other member', async () => {
      const updateDto = { role: HouseholdRole.PARENT };
      const memberToUpdate = { ...mockMember, id: '2', userId: '2' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ROOMMATE,
      });
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(memberToUpdate as any);

      await expect(
        service.updateMember('1', '2', updateDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('should allow admin to remove other members', async () => {
      const memberToRemove = {
        ...mockMember,
        id: '2',
        role: HouseholdRole.ROOMMATE,
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(memberToRemove as any);
      jest.spyOn(memberRepository, 'remove').mockResolvedValue({} as any);

      await service.removeMember('1', '2', mockUser as any);

      expect(memberRepository.remove).toHaveBeenCalledWith(memberToRemove);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.member.removed',
        expect.any(Object),
      );
    });

    it('should prevent removing last admin', async () => {
      const adminToRemove = { ...mockMember, role: HouseholdRole.ADMIN };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(adminToRemove as any);
      jest.spyOn(memberRepository, 'count').mockResolvedValue(1); // Only one admin

      await expect(
        service.removeMember('1', '1', mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for non-admin removing other member', async () => {
      const memberToRemove = { ...mockMember, id: '2', userId: '2' };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ROOMMATE,
      });
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(memberToRemove as any);

      await expect(
        service.removeMember('1', '2', mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserMembership', () => {
    it('should return membership for user', async () => {
      jest
        .spyOn(memberRepository, 'findOne')
        .mockResolvedValue(mockMember as any);

      const result = await service.getUserMembership('1', '1');

      expect(memberRepository.findOne).toHaveBeenCalledWith({
        where: { userId: '1', householdId: '1', isActive: true },
        relations: ['user', 'household'],
      });
      expect(result).toEqual(mockMember);
    });

    it('should return null for non-member', async () => {
      jest.spyOn(memberRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getUserMembership('1', '1');

      expect(result).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('should update settings for admin', async () => {
      const settingsDto = {
        notifications: { stockUpdates: false },
      };
      const mergedSettings = { notifications: { stockUpdates: false } };
      const updatedHousehold = { ...mockHousehold, settings: mergedSettings };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.ADMIN,
      });
      jest
        .spyOn(householdSettingsService, 'mergeSettings')
        .mockReturnValue(mergedSettings);
      jest
        .spyOn(householdRepository, 'save')
        .mockResolvedValue(updatedHousehold as any);

      const result = await service.updateSettings(
        '1',
        settingsDto,
        mockUser as any,
      );

      expect(householdSettingsService.mergeSettings).toHaveBeenCalledWith(
        {},
        settingsDto,
      );
      expect(householdRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'household.settings.updated',
        expect.any(Object),
      );
      expect(result.settings).toEqual(mergedSettings);
    });

    it('should allow parent to update settings', async () => {
      const settingsDto = { notifications: { stockUpdates: false } };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.PARENT,
      });
      jest
        .spyOn(householdSettingsService, 'mergeSettings')
        .mockReturnValue(settingsDto);
      jest
        .spyOn(householdRepository, 'save')
        .mockResolvedValue(mockHousehold as any);

      await service.updateSettings('1', settingsDto, mockUser as any);

      expect(householdRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-admin/non-parent', async () => {
      const settingsDto = { notifications: { stockUpdates: false } };

      jest.spyOn(service, 'findOne').mockResolvedValue(mockHousehold as any);
      jest.spyOn(service as any, 'getMembershipOrThrow').mockResolvedValue({
        ...mockMember,
        role: HouseholdRole.CHILD,
      });

      await expect(
        service.updateSettings('1', settingsDto, mockUser as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
