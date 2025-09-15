import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { User } from 'src/users/entity/user.entity';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { InviteMemberDto, JoinHouseholdDto } from './dto/invite-member.dto';
import { UpdateHouseholdSettingsDto } from './dto/update-household-settings.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { HouseholdMember } from './entities/household-member.entity';
import { Household } from './entities/household.entity';
import { HouseholdService } from './household.service';

@ApiTags('Foyers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('households')
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau foyer' })
  @ApiResponse({
    status: 201,
    description: 'Foyer créé avec succès',
    type: Household,
  })
  @SerializationGroups('household:read')
  async create(
    @Body() createHouseholdDto: CreateHouseholdDto,
    @CurrentUser() user: User,
  ): Promise<Household> {
    return this.householdService.create(createHouseholdDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous mes foyers' })
  @ApiResponse({
    status: 200,
    description: 'Liste des foyers',
    type: [Household],
  })
  @SerializationGroups('household:list')
  async findAll(@CurrentUser() user: User): Promise<Household[]> {
    return this.householdService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un foyer par ID' })
  @ApiResponse({
    status: 200,
    description: 'Détails du foyer',
    type: Household,
  })
  @SerializationGroups('household:read')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Household> {
    return this.householdService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un foyer' })
  @ApiResponse({
    status: 200,
    description: 'Foyer mis à jour',
    type: Household,
  })
  @SerializationGroups('household:read')
  async update(
    @Param('id') id: string,
    @Body() updateHouseholdDto: UpdateHouseholdDto,
    @CurrentUser() user: User,
  ): Promise<Household> {
    return this.householdService.update(id, updateHouseholdDto, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: "Supprimer un foyer (échoue s'il y a des stocks actifs)",
    description:
      "Supprime le foyer seulement s'il n'y a pas de stocks non vides. Utilise la suppression forcée pour ignorer cette vérification.",
  })
  @ApiResponse({ status: 200, description: 'Foyer supprimé' })
  @ApiResponse({
    status: 400,
    description: 'Des stocks actifs empêchent la suppression',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.householdService.remove(id, user);
    return { message: 'Foyer supprimé avec succès' };
  }

  @Delete(':id/force')
  @ApiOperation({
    summary: 'Suppression forcée du foyer avec nettoyage complet',
    description:
      'Supprime le foyer et tous ses stocks/membres. Action irréversible réservée aux administrateurs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Foyer supprimé avec détails du nettoyage',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deleted: {
          type: 'object',
          properties: {
            stocks: { type: 'number' },
            members: { type: 'number' },
          },
        },
      },
    },
  })
  async forceRemove(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{
    message: string;
    deleted: { stocks: number; members: number };
  }> {
    const result = await this.householdService.forceRemove(id, user);
    return {
      message: `Foyer supprimé définitivement avec ${result.deleted.stocks} stocks et ${result.deleted.members} membres`,
      deleted: result.deleted,
    };
  }

  @Post(':id/leave')
  @ApiOperation({
    summary: 'Quitter le foyer',
    description:
      'Permet à un membre de quitter proprement le foyer. Le dernier admin ne peut pas quitter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Membre retiré du foyer avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Le dernier admin ne peut pas quitter',
  })
  async leaveHousehold(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.householdService.leaveHousehold(id, user);
    return { message: 'Vous avez quitté le foyer avec succès' };
  }

  @Post(':id/generate-invite-code')
  @ApiOperation({ summary: "Générer un nouveau code d'invitation" })
  @ApiResponse({
    status: 200,
    description: "Nouveau code d'invitation",
    schema: {
      type: 'object',
      properties: {
        inviteCode: { type: 'string', example: 'ABC123' },
      },
    },
  })
  async generateInviteCode(
    @Param('id') householdId: string,
    @CurrentUser() user: User,
  ): Promise<{ inviteCode: string }> {
    const inviteCode = await this.householdService.generateNewInviteCode(
      householdId,
      user,
    );
    return { inviteCode };
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Inviter un membre dans le foyer' })
  @ApiResponse({ status: 200, description: 'Invitation envoyée' })
  async inviteMember(
    @Param('id') householdId: string,
    @Body() inviteMemberDto: InviteMemberDto,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.householdService.inviteMember(
      householdId,
      inviteMemberDto,
      user,
    );
    return { message: 'Invitation envoyée avec succès' };
  }

  @Post('join')
  @ApiOperation({ summary: "Rejoindre un foyer avec code d'invitation" })
  @ApiResponse({
    status: 200,
    description: 'Foyer rejoint avec succès',
    type: Household,
  })
  @SerializationGroups('household:read')
  async joinHousehold(
    @Body() joinHouseholdDto: JoinHouseholdDto,
    @CurrentUser() user: User,
  ): Promise<Household> {
    return this.householdService.joinHousehold(joinHouseholdDto, user);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Récupérer tous les membres du foyer' })
  @ApiResponse({
    status: 200,
    description: 'Liste des membres',
    type: [HouseholdMember],
  })
  @SerializationGroups('member:list')
  async getMembers(
    @Param('id') householdId: string,
    @CurrentUser() user: User,
  ): Promise<HouseholdMember[]> {
    return this.householdService.getHouseholdMembers(householdId, user);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Modifier un membre du foyer' })
  @ApiResponse({
    status: 200,
    description: 'Membre mis à jour',
    type: HouseholdMember,
  })
  @SerializationGroups('member:read')
  async updateMember(
    @Param('id') householdId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @CurrentUser() user: User,
  ): Promise<HouseholdMember> {
    return this.householdService.updateMember(
      householdId,
      memberId,
      updateMemberDto,
      user,
    );
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Supprimer un membre du foyer' })
  @ApiResponse({ status: 200, description: 'Membre supprimé' })
  async removeMember(
    @Param('id') householdId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.householdService.removeMember(householdId, memberId, user);
    return { message: 'Membre supprimé avec succès' };
  }

  @Get(':id/settings')
  @ApiOperation({ summary: 'Récupérer les paramètres du foyer' })
  @ApiResponse({
    status: 200,
    description: 'Paramètres du foyer',
  })
  async getSettings(
    @Param('id') householdId: string,
    @CurrentUser() user: User,
  ) {
    return this.householdService.getSettings(householdId, user);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Mettre à jour les paramètres du foyer' })
  @ApiResponse({
    status: 200,
    description: 'Paramètres mis à jour',
    type: Household,
  })
  @SerializationGroups('household:read')
  async updateSettings(
    @Param('id') householdId: string,
    @Body() updateSettingsDto: UpdateHouseholdSettingsDto,
    @CurrentUser() user: User,
  ): Promise<Household> {
    return this.householdService.updateSettings(
      householdId,
      updateSettingsDto,
      user,
    );
  }
}
