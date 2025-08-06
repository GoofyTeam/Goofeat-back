import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { HouseholdMember } from 'src/households/entities/household-member.entity';
import { HouseholdRole } from 'src/households/enums/household-role.enum';
import { HouseholdService } from 'src/households/household.service';
import { Product } from 'src/products/entities/product.entity';
import { User } from 'src/users/entity/user.entity';
import { MoreThan, Repository } from 'typeorm';
import {
  ChildActionDto,
  ChildActionType,
  QuantitySize,
  QuickConsumeDto,
} from '../dto/child-action.dto';
import {
  PendingActionStatus,
  PendingActionType,
  PendingStockAction,
} from '../entities/pending-stock-action.entity';
import { Stock } from '../entities/stock.entity';

@Injectable()
export class ChildStockService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(PendingStockAction)
    private readonly pendingActionRepository: Repository<PendingStockAction>,
    private readonly householdService: HouseholdService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processChildAction(
    childActionDto: ChildActionDto,
    user: User,
    householdId: string,
  ): Promise<{
    immediate: boolean;
    message: string;
    pendingActionId?: string;
  }> {
    // Vérifier que l'utilisateur est membre du foyer
    const membership = await this.householdService.getUserMembership(
      user.id,
      householdId,
    );
    if (!membership) {
      throw new ForbiddenException("Vous n'êtes pas membre de ce foyer");
    }

    // Trouver le stock du produit dans ce foyer
    const stock = await this.findHouseholdStock(
      childActionDto.productId,
      householdId,
    );
    if (!stock) {
      throw new NotFoundException('Produit non trouvé dans le stock du foyer');
    }

    // Déterminer si l'action nécessite une approbation
    const needsApproval =
      membership.needsApproval || membership.role === HouseholdRole.CHILD;

    if (needsApproval) {
      // Créer une action en attente
      const pendingAction = await this.createPendingAction(
        stock,
        membership,
        childActionDto,
      );

      // Notifier les parents
      await this.notifyParentsOfPendingAction(pendingAction);

      return {
        immediate: false,
        message: "Action en attente d'approbation parentale",
        pendingActionId: pendingAction.id,
      };
    } else {
      // Exécuter l'action immédiatement
      await this.executeChildAction(stock, membership, childActionDto);

      return {
        immediate: true,
        message: 'Action effectuée avec succès',
      };
    }
  }

  async quickConsume(
    quickConsumeDto: QuickConsumeDto,
    user: User,
  ): Promise<Stock> {
    const stock = await this.stockRepository.findOne({
      where: { id: quickConsumeDto.stockId },
      relations: ['household', 'product', 'user'],
    });

    if (!stock) {
      throw new NotFoundException('Stock non trouvé');
    }

    // Vérifier les permissions
    if (stock.household) {
      const membership = await this.householdService.getUserMembership(
        user.id,
        stock.household.id,
      );
      if (!membership || !membership.canEditStock) {
        throw new ForbiddenException(
          "Vous n'avez pas les droits pour modifier ce stock",
        );
      }
    } else if (stock.user.id !== user.id) {
      throw new ForbiddenException("Vous n'avez pas accès à ce stock");
    }

    // Vérifier qu'il y a assez de quantité
    if (stock.quantity < quickConsumeDto.quantity) {
      throw new ForbiddenException(
        'Quantité demandée supérieure au stock disponible',
      );
    }

    // Mettre à jour le stock
    const newQuantity = stock.quantity - quickConsumeDto.quantity;
    await this.stockRepository.update(stock.id, {
      quantity: newQuantity,
      lastUpdatedByMemberId: stock.household
        ? (
            await this.householdService.getUserMembership(
              user.id,
              stock.household.id,
            )
          )?.id
        : undefined,
    });

    // Émettre les événements
    this.eventEmitter.emit('stock.consumed', {
      stock,
      user,
      quantityConsumed: quickConsumeDto.quantity,
      comment: quickConsumeDto.comment,
      newQuantity,
    });

    // Si le stock est vide, émettre un événement spécial
    if (newQuantity === 0) {
      this.eventEmitter.emit('stock.empty', {
        stock,
        user,
        comment: quickConsumeDto.comment,
      });
    }

    return this.stockRepository.findOne({
      where: { id: stock.id },
      relations: ['product', 'household'],
    }) as Promise<Stock>;
  }

  async getPendingActionsForHousehold(
    householdId: string,
    user: User,
  ): Promise<PendingStockAction[]> {
    // Vérifier que l'utilisateur est membre du foyer
    const membership = await this.householdService.getUserMembership(
      user.id,
      householdId,
    );
    if (!membership) {
      throw new ForbiddenException("Vous n'êtes pas membre de ce foyer");
    }

    // Seuls les parents et admins peuvent voir les actions en attente
    if (
      membership.role === HouseholdRole.CHILD ||
      membership.role === HouseholdRole.GUEST
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits pour voir les actions en attente",
      );
    }

    return this.pendingActionRepository.find({
      where: {
        status: PendingActionStatus.PENDING,
        stock: { household: { id: householdId } },
      },
      relations: ['stock', 'stock.product', 'requestedBy', 'requestedBy.user'],
      order: { createdAt: 'ASC' },
    });
  }

  async approvePendingAction(
    actionId: string,
    approve: boolean,
    comment: string,
    user: User,
  ): Promise<PendingStockAction> {
    const pendingAction = await this.pendingActionRepository.findOne({
      where: { id: actionId },
      relations: [
        'stock',
        'stock.household',
        'stock.product',
        'requestedBy',
        'requestedBy.user',
      ],
    });

    if (!pendingAction) {
      throw new NotFoundException('Action en attente non trouvée');
    }

    if (pendingAction.status !== PendingActionStatus.PENDING) {
      throw new ForbiddenException('Cette action a déjà été traitée');
    }

    // Vérifier les permissions
    const membership = await this.householdService.getUserMembership(
      user.id,
      pendingAction.stock.household!.id,
    );

    if (
      !membership ||
      (membership.role !== HouseholdRole.PARENT &&
        membership.role !== HouseholdRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Seuls les parents et admins peuvent approuver les actions',
      );
    }

    // Mettre à jour l'action
    pendingAction.status = approve
      ? PendingActionStatus.APPROVED
      : PendingActionStatus.REJECTED;
    pendingAction.approvedBy = membership;
    pendingAction.processedAt = new Date();
    pendingAction.approverComment = comment;

    await this.pendingActionRepository.save(pendingAction);

    // Si approuvée, exécuter l'action
    if (approve) {
      await this.executePendingAction(pendingAction);
    }

    // Notifier le demandeur
    this.eventEmitter.emit('pending.action.processed', {
      action: pendingAction,
      approved: approve,
      processedBy: user,
    });

    return pendingAction;
  }

  private async findHouseholdStock(
    productId: string,
    householdId: string,
  ): Promise<Stock | null> {
    return this.stockRepository.findOne({
      where: {
        product: { id: productId },
        household: { id: householdId },
        quantity: MoreThan(0),
      },
      relations: ['product', 'household'],
      order: { dlc: 'ASC' }, // Prendre le plus ancien en premier
    });
  }

  private async createPendingAction(
    stock: Stock,
    member: HouseholdMember,
    childActionDto: ChildActionDto,
  ): Promise<PendingStockAction> {
    const actionType = this.mapChildActionToPendingType(childActionDto.action);
    const estimatedQuantity = this.estimateQuantityFromAction(
      childActionDto,
      stock,
    );

    const pendingAction = this.pendingActionRepository.create({
      stock,
      requestedBy: member,
      actionType,
      requestedQuantity: estimatedQuantity,
      comment: childActionDto.comment,
      reason: this.getActionReason(childActionDto.action),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    return this.pendingActionRepository.save(pendingAction);
  }

  private async executeChildAction(
    stock: Stock,
    member: HouseholdMember,
    childActionDto: ChildActionDto,
  ): Promise<void> {
    const estimatedQuantity = this.estimateQuantityFromAction(
      childActionDto,
      stock,
    );

    switch (childActionDto.action) {
      case ChildActionType.TAKE_SOME:
        await this.updateStockQuantity(
          stock,
          stock.quantity - estimatedQuantity,
          member.id,
        );
        break;
      case ChildActionType.TAKE_ALL:
      case ChildActionType.EMPTY:
        await this.updateStockQuantity(stock, 0, member.id);
        break;
      case ChildActionType.ALMOST_EMPTY:
        await this.updateStockQuantity(stock, stock.quantity * 0.1, member.id); // 10% restant
        break;
      case ChildActionType.FOUND_MORE:
        await this.updateStockQuantity(
          stock,
          stock.quantity + estimatedQuantity,
          member.id,
        );
        break;
    }

    // Émettre l'événement
    this.eventEmitter.emit('stock.child.action', {
      stock,
      member,
      action: childActionDto,
    });
  }

  private async executePendingAction(
    pendingAction: PendingStockAction,
  ): Promise<void> {
    const { stock, requestedQuantity, actionType } = pendingAction;

    switch (actionType) {
      case PendingActionType.CONSUME:
        if (requestedQuantity) {
          await this.updateStockQuantity(
            stock,
            Math.max(0, stock.quantity - requestedQuantity),
            pendingAction.requestedBy.id,
          );
        }
        break;
      case PendingActionType.UPDATE_QUANTITY:
        if (pendingAction.newQuantity !== undefined) {
          await this.updateStockQuantity(
            stock,
            pendingAction.newQuantity,
            pendingAction.requestedBy.id,
          );
        }
        break;
      case PendingActionType.DELETE:
        await this.stockRepository.remove(stock);
        break;
      case PendingActionType.WASTE:
        if (requestedQuantity) {
          await this.updateStockQuantity(
            stock,
            Math.max(0, stock.quantity - requestedQuantity),
            pendingAction.requestedBy.id,
          );
          // Émettre événement de gaspillage
          this.eventEmitter.emit('stock.wasted', {
            stock,
            quantityWasted: requestedQuantity,
            reason: pendingAction.reason,
          });
        }
        break;
    }
  }

  private async updateStockQuantity(
    stock: Stock,
    newQuantity: number,
    memberId: string,
  ): Promise<void> {
    await this.stockRepository.update(stock.id, {
      quantity: Math.max(0, newQuantity),
      lastUpdatedByMemberId: memberId,
    });
  }

  private mapChildActionToPendingType(
    action: ChildActionType,
  ): PendingActionType {
    switch (action) {
      case ChildActionType.TAKE_SOME:
      case ChildActionType.TAKE_ALL:
      case ChildActionType.EMPTY:
        return PendingActionType.CONSUME;
      case ChildActionType.ALMOST_EMPTY:
        return PendingActionType.UPDATE_QUANTITY;
      case ChildActionType.FOUND_MORE:
        return PendingActionType.UPDATE_QUANTITY;
      default:
        return PendingActionType.CONSUME;
    }
  }

  private estimateQuantityFromAction(
    childActionDto: ChildActionDto,
    stock: Stock,
  ): number {
    if (childActionDto.exactQuantity) {
      return childActionDto.exactQuantity;
    }

    switch (childActionDto.action) {
      case ChildActionType.TAKE_SOME:
        return this.estimateQuantityFromSize(
          childActionDto.quantitySize,
          stock.quantity,
        );
      case ChildActionType.TAKE_ALL:
      case ChildActionType.EMPTY:
        return stock.quantity;
      case ChildActionType.ALMOST_EMPTY:
        return stock.quantity * 0.9; // On en prend 90%
      case ChildActionType.FOUND_MORE:
        return this.estimateQuantityFromSize(
          childActionDto.quantitySize,
          stock.quantity,
        );
      default:
        return 1;
    }
  }

  private estimateQuantityFromSize(
    size: QuantitySize | undefined,
    currentStock: number,
  ): number {
    switch (size) {
      case QuantitySize.LITTLE:
        return Math.max(1, currentStock * 0.1);
      case QuantitySize.NORMAL:
        return Math.max(1, currentStock * 0.3);
      case QuantitySize.LOT:
        return Math.max(1, currentStock * 0.5);
      default:
        return Math.max(1, currentStock * 0.2);
    }
  }

  private getActionReason(action: ChildActionType): string {
    switch (action) {
      case ChildActionType.TAKE_SOME:
        return 'Consommation partielle';
      case ChildActionType.TAKE_ALL:
        return 'Consommation totale';
      case ChildActionType.EMPTY:
        return 'Stock épuisé';
      case ChildActionType.ALMOST_EMPTY:
        return 'Stock presque épuisé';
      case ChildActionType.FOUND_MORE:
        return 'Stock supplémentaire trouvé';
      default:
        return 'Action non spécifiée';
    }
  }

  private async notifyParentsOfPendingAction(
    pendingAction: PendingStockAction,
  ): Promise<void> {
    // Trouver tous les parents/admins du foyer
    const householdMembers = await this.householdService.getHouseholdMembers(
      pendingAction.stock.household!.id,
      pendingAction.requestedBy.user,
    );

    const parentsAndAdmins = householdMembers.filter(
      (member) =>
        member.role === HouseholdRole.PARENT ||
        member.role === HouseholdRole.ADMIN,
    );

    // Émettre événement de notification
    this.eventEmitter.emit('pending.action.created', {
      action: pendingAction,
      parentsToNotify: parentsAndAdmins,
    });
  }
}
