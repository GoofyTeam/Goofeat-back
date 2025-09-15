import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { MoreThan, Repository } from 'typeorm';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { InviteMemberDto, JoinHouseholdDto } from './dto/invite-member.dto';
import { UpdateHouseholdSettingsDto } from './dto/update-household-settings.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { HouseholdMember } from './entities/household-member.entity';
import { Household } from './entities/household.entity';
import { HouseholdRole } from './enums/household-role.enum';
import { HouseholdSettingsService } from './services/household-settings.service';

@Injectable()
export class HouseholdService {
  constructor(
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    @InjectRepository(HouseholdMember)
    private readonly memberRepository: Repository<HouseholdMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    private readonly eventEmitter: EventEmitter2,
    private readonly householdSettingsService: HouseholdSettingsService,
  ) {}

  async create(
    createHouseholdDto: CreateHouseholdDto,
    creator: User,
  ): Promise<Household> {
    // Créer le foyer
    const household = this.householdRepository.create({
      ...createHouseholdDto,
      inviteCode: this.generateInviteCode(),
      inviteCodeExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    });

    const savedHousehold = await this.householdRepository.save(household);

    // Ajouter le créateur comme ADMIN
    const creatorMember = this.memberRepository.create({
      userId: creator.id,
      householdId: savedHousehold.id,
      role: HouseholdRole.ADMIN,
      canEditStock: true,
      canViewAllStocks: true,
      canInviteMembers: true,
      needsApproval: false,
    });

    await this.memberRepository.save(creatorMember);

    // Recharger avec les relations
    const householdWithMembers = await this.householdRepository.findOne({
      where: { id: savedHousehold.id },
      relations: ['members', 'members.user'],
    });

    this.eventEmitter.emit('household.created', {
      household: householdWithMembers,
      creator,
    });

    return householdWithMembers!;
  }

  async findAll(user: User): Promise<Household[]> {
    // Trouver tous les foyers où l'utilisateur est membre
    const memberships = await this.memberRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['household', 'household.members', 'household.members.user'],
    });

    return memberships.map((membership) => membership.household);
  }

  async findOne(id: string, user: User): Promise<Household> {
    const household = await this.householdRepository.findOne({
      where: { id },
      relations: ['members', 'members.user', 'stocks', 'stocks.product'],
    });

    if (!household) {
      throw new NotFoundException(`Foyer avec l'ID ${id} non trouvé`);
    }

    // Vérifier que l'utilisateur est membre de ce foyer
    const _membership = await this.getMembershipOrThrow(user.id, id);

    return household;
  }

  async update(
    id: string,
    updateHouseholdDto: UpdateHouseholdDto,
    user: User,
  ): Promise<Household> {
    const household = await this.findOne(id, user);
    const membership = await this.getMembershipOrThrow(user.id, id);

    // Seuls les ADMIN peuvent modifier le foyer
    if (membership.role !== HouseholdRole.ADMIN) {
      throw new ForbiddenException(
        'Seuls les administrateurs peuvent modifier le foyer',
      );
    }

    Object.assign(household, updateHouseholdDto);
    const updatedHousehold = await this.householdRepository.save(household);

    this.eventEmitter.emit('household.updated', {
      household: updatedHousehold,
      updatedBy: user,
    });

    return updatedHousehold;
  }

  async remove(id: string, user: User): Promise<void> {
    const household = await this.findOne(id, user);
    const membership = await this.getMembershipOrThrow(user.id, id);

    // Seuls les ADMIN peuvent supprimer le foyer
    if (membership.role !== HouseholdRole.ADMIN) {
      throw new ForbiddenException(
        'Seuls les administrateurs peuvent supprimer le foyer',
      );
    }

    // Vérifier s'il y a des stocks non vides
    const activeStocks = await this.stockRepository.count({
      where: {
        household: { id },
        quantity: MoreThan(0),
      },
    });

    if (activeStocks > 0) {
      throw new BadRequestException(
        `Impossible de supprimer le foyer : ${activeStocks} stocks actifs trouvés. Veuillez d'abord consommer ou supprimer les stocks.`,
      );
    }

    // Notifier tous les membres avant suppression
    const members = await this.memberRepository.find({
      where: { householdId: id, isActive: true },
      relations: ['user'],
    });

    for (const member of members) {
      this.eventEmitter.emit('household.will.delete', {
        member,
        household,
        deletedBy: user,
      });
    }

    // Supprimer le foyer (les membres seront supprimés en cascade)
    await this.householdRepository.remove(household);

    this.eventEmitter.emit('household.deleted', {
      household,
      deletedBy: user,
      membersNotified: members.length,
    });
  }

  /**
   * Suppression forcée du foyer avec nettoyage des stocks (uniquement pour les ADMIN)
   */
  async forceRemove(
    id: string,
    user: User,
  ): Promise<{ deleted: { stocks: number; members: number } }> {
    const household = await this.findOne(id, user);
    const membership = await this.getMembershipOrThrow(user.id, id);

    // Seuls les ADMIN peuvent forcer la suppression
    if (membership.role !== HouseholdRole.ADMIN) {
      throw new ForbiddenException(
        'Seuls les administrateurs peuvent supprimer le foyer',
      );
    }

    // Compter les éléments qui vont être supprimés
    const stocksCount = await this.stockRepository.count({
      where: { household: { id } },
    });

    const membersCount = await this.memberRepository.count({
      where: { householdId: id, isActive: true },
    });

    // Notifier avant suppression
    const members = await this.memberRepository.find({
      where: { householdId: id, isActive: true },
      relations: ['user'],
    });

    for (const member of members) {
      this.eventEmitter.emit('household.force.delete', {
        member,
        household,
        deletedBy: user,
        stocksCount,
        membersCount,
      });
    }

    // Supprimer d'abord tous les stocks du foyer
    await this.stockRepository.delete({ household: { id } });

    // Puis supprimer le foyer (cascade supprimera les membres)
    await this.householdRepository.remove(household);

    this.eventEmitter.emit('household.force.deleted', {
      household,
      deletedBy: user,
      stocksDeleted: stocksCount,
      membersDeleted: membersCount,
    });

    return {
      deleted: {
        stocks: stocksCount,
        members: membersCount,
      },
    };
  }

  /**
   * Permettre à un membre de quitter le foyer proprement
   */
  async leaveHousehold(householdId: string, user: User): Promise<void> {
    const membership = await this.getMembershipOrThrow(user.id, householdId);

    // Empêcher le dernier admin de quitter
    if (membership.role === HouseholdRole.ADMIN) {
      const adminCount = await this.memberRepository.count({
        where: { householdId, role: HouseholdRole.ADMIN, isActive: true },
      });

      if (adminCount === 1) {
        throw new BadRequestException(
          'Vous êtes le dernier administrateur. Transférez vos droits à un autre membre ou supprimez le foyer.',
        );
      }
    }

    // Désactiver les stocks personnels de l'utilisateur dans ce foyer
    await this.stockRepository.update(
      { user: { id: user.id }, household: { id: householdId } },
      { quantity: 0 }, // Mettre la quantité à 0 plutôt que supprimer
    );

    // Supprimer le membre
    await this.memberRepository.remove(membership);

    this.eventEmitter.emit('household.member.left', {
      member: membership,
      household: { id: householdId },
      leftBy: user,
    });
  }

  async generateNewInviteCode(
    householdId: string,
    user: User,
  ): Promise<string> {
    const _household = await this.findOne(householdId, user);
    const membership = await this.getMembershipOrThrow(user.id, householdId);

    // Vérifier les permissions
    if (
      !membership.canInviteMembers &&
      membership.role !== HouseholdRole.ADMIN
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits pour générer un code d'invitation",
      );
    }

    const newCode = this.generateInviteCode();
    const newExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    await this.householdRepository.update(householdId, {
      inviteCode: newCode,
      inviteCodeExpiresAt: newExpiration,
    });

    return newCode;
  }

  async inviteMember(
    householdId: string,
    inviteMemberDto: InviteMemberDto,
    inviter: User,
  ): Promise<void> {
    const household = await this.findOne(householdId, inviter);
    const inviterMembership = await this.getMembershipOrThrow(
      inviter.id,
      householdId,
    );

    // Vérifier les permissions
    if (
      !inviterMembership.canInviteMembers &&
      inviterMembership.role !== HouseholdRole.ADMIN
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits pour inviter des membres",
      );
    }

    // Vérifier si l'utilisateur existe
    const invitedUser = await this.userRepository.findOne({
      where: { email: inviteMemberDto.email },
    });

    if (!invitedUser) {
      throw new BadRequestException('Utilisateur spécifié non trouvé');
    }

    // Vérifier s'il n'est pas déjà membre
    const existingMembership = await this.memberRepository.findOne({
      where: { userId: invitedUser.id, householdId },
    });

    if (existingMembership) {
      throw new BadRequestException('Cet utilisateur est déjà membre du foyer');
    }

    // TODO: Envoyer email d'invitation
    this.eventEmitter.emit('household.member.invited', {
      household,
      invitedUser,
      inviter,
      role: inviteMemberDto.role,
      nickname: inviteMemberDto.nickname,
    });
  }

  async joinHousehold(
    joinHouseholdDto: JoinHouseholdDto,
    user: User,
  ): Promise<Household> {
    const household = await this.householdRepository.findOne({
      where: {
        inviteCode: joinHouseholdDto.inviteCode,
        isActive: true,
      },
      relations: ['members'],
    });

    if (!household) {
      throw new BadRequestException("Code d'invitation invalide");
    }

    if (
      household.inviteCodeExpiresAt &&
      household.inviteCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException("Code d'invitation expiré");
    }

    // Vérifier s'il n'est pas déjà membre
    const existingMembership = await this.memberRepository.findOne({
      where: { userId: user.id, householdId: household.id },
    });

    if (existingMembership) {
      throw new BadRequestException('Vous êtes déjà membre de ce foyer');
    }

    // Ajouter comme membre
    const newMember = this.memberRepository.create({
      userId: user.id,
      householdId: household.id,
      role: HouseholdRole.ROOMMATE, // Rôle par défaut
      nickname: joinHouseholdDto.nickname,
      canEditStock: true,
      canViewAllStocks: true,
    });

    await this.memberRepository.save(newMember);

    const updatedHousehold = await this.householdRepository.findOne({
      where: { id: household.id },
      relations: ['members', 'members.user'],
    });

    this.eventEmitter.emit('household.member.joined', {
      household: updatedHousehold,
      newMember: newMember,
      user,
    });

    return updatedHousehold!;
  }

  async updateMember(
    householdId: string,
    memberId: string,
    updateMemberDto: UpdateMemberDto,
    user: User,
  ): Promise<HouseholdMember> {
    await this.findOne(householdId, user);
    const updaterMembership = await this.getMembershipOrThrow(
      user.id,
      householdId,
    );

    const memberToUpdate = await this.memberRepository.findOne({
      where: { id: memberId, householdId },
      relations: ['user', 'household'],
    });

    if (!memberToUpdate) {
      throw new BadRequestException('Membre non trouvé dans ce foyer');
    }

    // Seuls les ADMIN peuvent modifier les autres membres
    if (
      updaterMembership.role !== HouseholdRole.ADMIN &&
      memberToUpdate.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre profil',
      );
    }

    Object.assign(memberToUpdate, updateMemberDto);
    const updatedMember = await this.memberRepository.save(memberToUpdate);

    this.eventEmitter.emit('household.member.updated', {
      member: updatedMember,
      updatedBy: user,
    });

    return updatedMember;
  }

  async removeMember(
    householdId: string,
    memberId: string,
    user: User,
  ): Promise<void> {
    await this.findOne(householdId, user);
    const removerMembership = await this.getMembershipOrThrow(
      user.id,
      householdId,
    );

    const memberToRemove = await this.memberRepository.findOne({
      where: { id: memberId, householdId },
      relations: ['user'],
    });

    if (!memberToRemove) {
      throw new BadRequestException('Membre non trouvé dans ce foyer');
    }

    // Seuls les ADMIN peuvent supprimer d'autres membres
    if (
      removerMembership.role !== HouseholdRole.ADMIN &&
      memberToRemove.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Seuls les administrateurs peuvent supprimer des membres',
      );
    }

    // Empêcher la suppression du dernier ADMIN
    if (memberToRemove.role === HouseholdRole.ADMIN) {
      const adminCount = await this.memberRepository.count({
        where: { householdId, role: HouseholdRole.ADMIN, isActive: true },
      });

      if (adminCount === 1) {
        throw new BadRequestException(
          'Impossible de supprimer le dernier administrateur',
        );
      }
    }

    await this.memberRepository.remove(memberToRemove);

    this.eventEmitter.emit('household.member.removed', {
      member: memberToRemove,
      removedBy: user,
    });
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async getMembershipOrThrow(
    userId: string,
    householdId: string,
  ): Promise<HouseholdMember> {
    const membership = await this.memberRepository.findOne({
      where: { userId, householdId, isActive: true },
      relations: ['user', 'household'],
    });

    if (!membership) {
      throw new ForbiddenException("Vous n'êtes pas membre de ce foyer");
    }

    return membership;
  }

  async getUserMembership(
    userId: string,
    householdId: string,
  ): Promise<HouseholdMember | null> {
    return this.memberRepository.findOne({
      where: { userId, householdId, isActive: true },
      relations: ['user', 'household'],
    });
  }

  async getHouseholdMembers(
    householdId: string,
    user: User,
  ): Promise<HouseholdMember[]> {
    await this.findOne(householdId, user);

    return this.memberRepository.find({
      where: { householdId, isActive: true },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async updateSettings(
    householdId: string,
    updateSettingsDto: UpdateHouseholdSettingsDto,
    user: User,
  ): Promise<Household> {
    const household = await this.findOne(householdId, user);
    const membership = await this.getMembershipOrThrow(user.id, householdId);

    // Seuls les ADMIN et PARENT peuvent modifier les settings
    if (
      membership.role !== HouseholdRole.ADMIN &&
      membership.role !== HouseholdRole.PARENT
    ) {
      throw new ForbiddenException(
        'Seuls les administrateurs et parents peuvent modifier les paramètres',
      );
    }

    // Fusionner les nouveaux settings avec les existants en utilisant le service
    const updatedSettings = this.householdSettingsService.mergeSettings(
      household.settings as any,
      updateSettingsDto,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    household.settings = updatedSettings as any;
    const savedHousehold = await this.householdRepository.save(household);

    this.eventEmitter.emit('household.settings.updated', {
      household: savedHousehold,
      updatedBy: user,
      previousSettings: household.settings,
      newSettings: updatedSettings,
    });

    return savedHousehold;
  }

  async getSettings(householdId: string, user: User) {
    const household = await this.findOne(householdId, user);
    return this.householdSettingsService.getSettings(household);
  }
}
