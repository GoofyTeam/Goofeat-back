import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { promises as fs } from 'fs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entity/user.entity';
import { ConfirmReceiptResponseDto } from './dto/confirm-request.dto';
import { UploadReceiptResponseDto } from './dto/upload-response.dto';
import { Receipt } from './entities/receipt.entity';
import {
  ConfirmReceiptDto,
  OcrReceiptService,
  UploadReceiptDto,
} from './ocr-receipt.service';

@ApiTags('OCR Receipt')
@Controller('api/v1/ocr-receipt')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OcrReceiptController {
  private readonly logger = new Logger(OcrReceiptController.name);

  constructor(private readonly ocrReceiptService: OcrReceiptService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: "Upload et analyse d'un ticket de caisse" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image du ticket de caisse',
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Fichier image du ticket (JPG, PNG, PDF max 10MB)',
        },
        householdId: {
          type: 'string',
          format: 'uuid',
          description: 'ID du ménage (optionnel)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket analysé avec succès',
    type: UploadReceiptResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 500, description: 'Erreur de traitement' })
  async uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Body() body?: { householdId?: string },
  ) {
    // Validation sécurité
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (!file.buffer) {
      throw new BadRequestException(
        'Fichier non stocké en mémoire - configuration incorrecte',
      );
    }

    // Log RGPD : traitement de données personnelles
    this.logger.log(
      `Traitement image OCR pour utilisateur ${user.id} (taille: ${file.buffer.length} bytes)`,
    );

    // SÉCURITÉ : Vérifier qu'aucun fichier n'est créé sur disque
    if (file.path) {
      this.logger.error(
        `ALERTE SÉCURITÉ: Fichier créé sur disque: ${file.path}`,
      );
      // Nettoyer immédiatement
      try {
        await fs.unlink(file.path);
        this.logger.warn(`Fichier temporaire supprimé: ${file.path}`);
      } catch (error) {
        this.logger.error(
          `Impossible de supprimer le fichier: ${file.path}`,
          error as Error,
        );
      }
    }

    const uploadData: UploadReceiptDto = {
      userId: user.id,
      householdId:
        body?.householdId && body.householdId.trim() !== ''
          ? body.householdId
          : undefined,
    };

    try {
      const result = await this.ocrReceiptService.uploadReceipt(
        file.buffer,
        uploadData,
      );

      // Log RGPD : fin de traitement
      this.logger.log(
        `Image OCR traitée et supprimée de la mémoire (utilisateur: ${user.id})`,
      );

      return result;
    } finally {
      // Force cleanup du buffer (GC)
      (file.buffer as any) = null;
    }
  }

  @Post('confirm')
  @ApiOperation({
    summary: "Confirme les items d'un ticket et les ajoute au stock",
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket confirmé avec succès',
    type: ConfirmReceiptResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données de confirmation invalides',
  })
  @ApiResponse({ status: 500, description: 'Erreur lors de la confirmation' })
  async confirmReceipt(
    @CurrentUser() user: User,
    @Body() confirmData: Omit<ConfirmReceiptDto, 'userId'>,
  ) {
    const fullConfirmData: ConfirmReceiptDto = {
      ...confirmData,
      userId: user.id,
    };

    await this.ocrReceiptService.confirmReceipt(fullConfirmData);

    return {
      message: 'Ticket confirmé avec succès',
      receiptId: confirmData.receiptId,
      confirmedItems: confirmData.confirmedItems.filter(
        (item) => item.confirmed,
      ).length,
    };
  }

  @Get('history')
  @ApiOperation({
    summary: "Récupère l'historique des tickets de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Historique récupéré avec succès',
    type: [Receipt],
  })
  async getUserReceipts(@CurrentUser() user: User) {
    return this.ocrReceiptService.getUserReceipts(user.id);
  }

  @Get(':receiptId')
  @ApiOperation({ summary: "Récupère les détails d'un ticket spécifique" })
  @ApiResponse({
    status: 200,
    description: 'Détails du ticket récupérés avec succès',
    type: Receipt,
  })
  @ApiResponse({ status: 404, description: 'Ticket non trouvé' })
  async getReceiptDetails(
    @Param('receiptId') receiptId: string,
    @CurrentUser() user: User,
  ) {
    return this.ocrReceiptService.getReceiptDetails(receiptId, user.id);
  }
}
