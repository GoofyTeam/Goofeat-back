import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/entity/user.entity';
import { ChildActionDto, QuickConsumeDto } from '../dto/child-action.dto';
import { PendingStockAction } from '../entities/pending-stock-action.entity';
import { Stock } from '../entities/stock.entity';
import { ChildStockService } from '../services/child-stock.service';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';

@ApiTags('Stocks - Actions Enfants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('stocks/child')
export class ChildStockController {
  constructor(private readonly childStockService: ChildStockService) {}

  @Post('action/:householdId')
  @ApiOperation({
    summary: "Action rapide d'un enfant sur un produit",
    description:
      "Permet aux enfants d'effectuer des actions simples sur les stocks du foyer. L'action peut être immédiate ou nécessiter une approbation parentale.",
  })
  @ApiResponse({
    status: 200,
    description: 'Action traitée',
    schema: {
      type: 'object',
      properties: {
        immediate: {
          type: 'boolean',
          description: 'Action exécutée immédiatement',
        },
        message: { type: 'string', description: 'Message de retour' },
        pendingActionId: {
          type: 'string',
          description: "ID de l'action en attente si applicable",
        },
      },
    },
  })
  async childAction(
    @Param('householdId') householdId: string,
    @Body() childActionDto: ChildActionDto,
    @CurrentUser() user: User,
  ): Promise<{
    immediate: boolean;
    message: string;
    pendingActionId?: string;
  }> {
    return this.childStockService.processChildAction(
      childActionDto,
      user,
      householdId,
    );
  }

  @Post('quick-consume')
  @ApiOperation({
    summary: "Consommation rapide d'un stock",
    description:
      'Permet de décrémenter rapidement un stock avec une quantité précise.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock mis à jour',
    type: Stock,
  })
  @SerializationGroups('stock:read')
  async quickConsume(
    @Body() quickConsumeDto: QuickConsumeDto,
    @CurrentUser() user: User,
  ): Promise<Stock> {
    return this.childStockService.quickConsume(quickConsumeDto, user);
  }

  @Get('pending/:householdId')
  @ApiOperation({
    summary: "Récupérer les actions en attente d'approbation",
    description:
      "Permet aux parents et admins de voir toutes les actions en attente d'approbation pour le foyer.",
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des actions en attente',
    type: [PendingStockAction],
  })
  @SerializationGroups('pending:list')
  async getPendingActions(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
  ): Promise<PendingStockAction[]> {
    return this.childStockService.getPendingActionsForHousehold(
      householdId,
      user,
    );
  }

  @Patch('pending/:actionId/approve')
  @ApiOperation({
    summary: 'Approuver ou rejeter une action en attente',
    description:
      "Permet aux parents et admins d'approuver ou rejeter les actions demandées par les enfants.",
  })
  @ApiQuery({
    name: 'approve',
    type: 'boolean',
    description: 'true pour approuver, false pour rejeter',
  })
  @ApiResponse({
    status: 200,
    description: 'Action traitée',
    type: PendingStockAction,
  })
  @SerializationGroups('pending:read')
  async approvePendingAction(
    @Param('actionId') actionId: string,
    @Query('approve') approve: string,
    @Body('comment') comment: string = '',
    @CurrentUser() user: User,
  ): Promise<PendingStockAction> {
    const shouldApprove = approve === 'true';
    return this.childStockService.approvePendingAction(
      actionId,
      shouldApprove,
      comment,
      user,
    );
  }
}
