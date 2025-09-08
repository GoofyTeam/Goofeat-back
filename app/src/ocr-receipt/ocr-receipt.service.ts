/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Fuse = require('fuse.js');
import { Repository } from 'typeorm';
import { ProductService } from '../products/product.service';
import { StockService } from '../stocks/stock.service';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Receipt, ReceiptStatus } from './entities/receipt.entity';
import { FrenchReceiptParser } from './parsers/french-receipt.parser';
import { ParsedReceiptItem } from './parsers/receipt-parser.interface';
import { ImageOptimizerService } from './preprocessing/image-optimizer.service';
import { TesseractProvider } from './providers/tesseract.provider';

export interface UploadReceiptDto {
  userId: string;
  householdId?: string;
}

export interface ConfirmReceiptDto {
  receiptId: string;
  userId: string;
  confirmedItems: ConfirmedReceiptItem[];
}

export interface ConfirmedReceiptItem {
  receiptItemId: string;
  productId?: string;
  quantity: number;
  unitPrice?: number;
  expirationDate?: Date;
  confirmed: boolean;
}

export interface ReceiptUploadResult {
  receiptId: string;
  storeName: string;
  receiptDate?: Date;
  totalAmount?: number;
  confidence: number;
  items: ReceiptItemResult[];
  suggestedProducts: ProductSuggestion[];
}

export interface ReceiptItemResult {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice: number;
  confidence: number;
  suggestedProduct?: ProductSuggestion;
}

export interface ProductSuggestion {
  productId: string;
  name: string;
  brand?: string;
  matchScore: number;
  category?: string;
}

@Injectable()
export class OcrReceiptService {
  private readonly logger = new Logger(OcrReceiptService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemRepository: Repository<ReceiptItem>,
    private readonly tesseractProvider: TesseractProvider,
    private readonly frenchReceiptParser: FrenchReceiptParser,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly productService: ProductService,
    private readonly stockService: StockService,
  ) {}

  /**
   * Upload et traitement d'un ticket de caisse
   */
  async uploadReceipt(
    imageBuffer: Buffer,
    uploadData: UploadReceiptDto,
  ): Promise<ReceiptUploadResult> {
    const startTime = Date.now();
    this.logger.log(
      `Début traitement ticket pour utilisateur ${uploadData.userId}`,
    );

    try {
      // 1. Validation de l'image
      await this.validateImage(imageBuffer);

      // 2. Analyse qualité image et OCR
      const imageQuality =
        await this.imageOptimizer.analyzeImageQuality(imageBuffer);
      this.logger.debug(`Qualité image: ${imageQuality}`);

      const ocrResult =
        await this.tesseractProvider.extractTextWithVariants(imageBuffer);
      this.logger.debug(
        `OCR terminé: confiance ${ocrResult.confidence}, ${ocrResult.text.length} caractères`,
      );

      // 3. Parsing du ticket
      const parsedReceipt = await this.frenchReceiptParser.parseReceipt(
        ocrResult.text,
        ocrResult.confidence,
      );
      this.logger.debug(
        `Parsing terminé: ${parsedReceipt.items.length} items détectés`,
      );

      // 4. Sauvegarde en base
      const receipt = await this.saveReceiptToDatabase(
        uploadData,
        ocrResult,
        parsedReceipt,
        imageQuality,
      );

      // 5. Recherche de correspondances produits
      const productSuggestions = await this.findProductMatches(
        parsedReceipt.items,
      );

      // 6. Construction du résultat
      const result = this.buildReceiptResult(receipt, productSuggestions);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Ticket traité en ${processingTime}ms: ${result.items.length} items, confiance ${result.confidence}`,
      );

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Erreur traitement ticket: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        'Erreur lors du traitement du ticket',
      );
    }
  }

  /**
   * Confirmation et ajout des items en stock
   */
  async confirmReceipt(confirmData: ConfirmReceiptDto): Promise<void> {
    this.logger.log(
      `Confirmation ticket ${confirmData.receiptId} par utilisateur ${confirmData.userId}`,
    );

    try {
      // 1. Récupérer le ticket
      const receipt = await this.receiptRepository.findOne({
        where: { id: confirmData.receiptId, userId: confirmData.userId },
        relations: ['items'],
      });

      if (!receipt) {
        throw new BadRequestException('Ticket non trouvé');
      }

      if (receipt.status !== ReceiptStatus.PENDING) {
        throw new BadRequestException('Ticket déjà traité');
      }

      // 2. Traiter chaque item confirmé
      let confirmedCount = 0;
      for (const confirmedItem of confirmData.confirmedItems) {
        if (confirmedItem.confirmed && confirmedItem.productId) {
          await this.addItemToStock(receipt, confirmedItem);
          confirmedCount++;
        }
      }

      // 3. Mettre à jour le statut du ticket
      receipt.status = ReceiptStatus.CONFIRMED;
      receipt.confirmedAt = new Date();
      receipt.confirmedItemsCount = confirmedCount;
      await this.receiptRepository.save(receipt);

      this.logger.log(
        `Ticket confirmé: ${confirmedCount} items ajoutés au stock`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Erreur confirmation ticket: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Erreur lors de la confirmation');
    }
  }

  /**
   * Récupère l'historique des tickets d'un utilisateur
   */
  async getUserReceipts(userId: string, limit = 50): Promise<Receipt[]> {
    return this.receiptRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['items'],
    });
  }

  /**
   * Récupère les détails d'un ticket
   */
  async getReceiptDetails(receiptId: string, userId: string): Promise<Receipt> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, userId },
      relations: ['items'],
    });

    if (!receipt) {
      throw new BadRequestException('Ticket non trouvé');
    }

    return receipt;
  }

  /**
   * Valide le format et la taille de l'image
   */
  private async validateImage(imageBuffer: Buffer): Promise<void> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new BadRequestException('Image manquante');
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      // 10MB
      throw new BadRequestException('Image trop volumineuse (max 10MB)');
    }

    // Vérifier le format via Sharp
    try {
      const metadata = await this.imageOptimizer.getImageMetadata(imageBuffer);
      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new BadRequestException("Format d'image non supporté");
      }
    } catch (error) {
      throw new BadRequestException('Image corrompue ou format invalide');
    }
  }

  /**
   * Sauvegarde le ticket et ses items en base de données
   */
  private async saveReceiptToDatabase(
    uploadData: UploadReceiptDto,
    ocrResult: any,
    parsedReceipt: any,
    imageQuality: number,
  ): Promise<Receipt> {
    // Créer le ticket principal
    const receipt = this.receiptRepository.create({
      userId: uploadData.userId,
      householdId: uploadData.householdId,
      storeName: parsedReceipt.storeName,
      storeAddress: parsedReceipt.storeAddress,
      receiptDate: parsedReceipt.receiptDate,
      totalAmount: parsedReceipt.totalAmount,
      ocrText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      parsingConfidence: parsedReceipt.parsingConfidence,
      imageQuality,
      parserUsed: parsedReceipt.parserUsed,
      status: ReceiptStatus.PENDING,
    });

    const savedReceipt = await this.receiptRepository.save(receipt);

    // Créer les items
    const receiptItems = parsedReceipt.items.map((item: ParsedReceiptItem) =>
      this.receiptItemRepository.create({
        receiptId: savedReceipt.id,
        rawText: item.rawText,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productCode: item.productCode,
        confidence: item.confidence,
        lineNumber: item.lineNumber,
      }),
    );

    const savedItems = await this.receiptItemRepository.save(receiptItems);
    savedReceipt.items = savedItems;

    return savedReceipt;
  }

  /**
   * Recherche des correspondances de produits
   */
  private async findProductMatches(
    parsedItems: any[],
  ): Promise<Map<string, ProductSuggestion[]>> {
    const productSuggestions = new Map<string, ProductSuggestion[]>();

    // Récupérer tous les produits pour la recherche fuzzy
    const allProducts = await this.productService.findAllForMatching();

    // Configuration Fuse.js pour la recherche floue - plus permissive
    const fuse = new Fuse(allProducts, {
      keys: ['name'],
      threshold: 0.4, // Plus permissif (0.6 → 0.4)
      includeScore: true,
      minMatchCharLength: 3,
      distance: 100, // Distance max pour matching
      ignoreLocation: true, // Ignore la position dans le texte
    });

    for (const item of parsedItems) {
      const suggestions: ProductSuggestion[] = [];

      const normalizedName = this.normalizeProductName(item.productName);
      this.logger.debug(
        `Recherche pour: "${item.productName}" → "${normalizedName}"`,
      );

      // Recherche par nom de produit normalisé
      const nameMatches = fuse.search(normalizedName).slice(0, 5); // Augmenter à 5 suggestions

      for (const match of nameMatches) {
        suggestions.push({
          productId: match.item.id,
          name: match.item.name,
          brand: '', // Brand property doesn't exist on Product
          matchScore: 1 - (match.score || 0), // Inverser le score (plus haut = meilleur)
          category: '', // Categories property doesn't exist on Product
        });
      }

      // Recherche par code produit si disponible
      if (item.productCode) {
        const productByCode = await this.productService.findByBarcode(
          item.productCode,
        );
        if (productByCode) {
          suggestions.unshift({
            productId: productByCode.id,
            name: productByCode.name,
            brand: '', // Brand property doesn't exist on Product
            matchScore: 1.0, // Score parfait pour correspondance de code
            category: '', // Categories property doesn't exist on Product
          });
        }
      }

      // Trier par score décroissant et garder les 3 meilleurs
      suggestions.sort((a, b) => b.matchScore - a.matchScore);
      productSuggestions.set(item.productName, suggestions.slice(0, 3));
    }

    return productSuggestions;
  }

  /**
   * Construit le résu  ltat final
   */
  private buildReceiptResult(
    receipt: Receipt,
    productSuggestions: Map<string, ProductSuggestion[]>,
  ): ReceiptUploadResult {
    const items: ReceiptItemResult[] = receipt.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      confidence: item.confidence,
      suggestedProduct: productSuggestions.get(item.productName)?.[0],
    }));

    // Collecter toutes les suggestions uniques
    const allSuggestions: ProductSuggestion[] = [];
    productSuggestions.forEach((suggestions) => {
      suggestions.forEach((suggestion) => {
        if (!allSuggestions.find((s) => s.productId === suggestion.productId)) {
          allSuggestions.push(suggestion);
        }
      });
    });

    return {
      receiptId: receipt.id,
      storeName: receipt.storeName || 'Magasin inconnu',
      receiptDate: receipt.receiptDate,
      totalAmount: receipt.totalAmount,
      confidence: receipt.parsingConfidence || 0,
      items,
      suggestedProducts: allSuggestions
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10),
    };
  }

  /**
   * Ajoute un item confirmé au stock
   */
  private async addItemToStock(
    receipt: Receipt,
    confirmedItem: ConfirmedReceiptItem,
  ): Promise<void> {
    try {
      await this.stockService.addStock({
        userId: receipt.userId,
        householdId: receipt.householdId,
        productId: confirmedItem.productId!,
        quantity: confirmedItem.quantity,
        unitPrice: confirmedItem.unitPrice,
        expirationDate: confirmedItem.expirationDate,
        purchaseDate: receipt.receiptDate || new Date(),
        source: 'receipt_scan',
        receiptId: receipt.id,
      });

      // Mettre à jour l'item du ticket avec le produit associé
      await this.receiptItemRepository.update(
        { id: confirmedItem.receiptItemId },
        {
          linkedProductId: confirmedItem.productId,
          confirmedQuantity: confirmedItem.quantity,
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Erreur ajout stock item ${confirmedItem.receiptItemId}: ${err.message}`,
      );
      throw error;
    }
  }

  /**
   * Normalise un nom de produit pour améliorer le matching
   */
  private normalizeProductName(productName: string): string {
    return (
      productName
        // Corrections OCR courantes
        .replace(/0/g, 'o') // B0ite → Boite
        .replace(/1/g, 'l') // 1 → l
        .replace(/5/g, 's') // 5 → s
        .replace(/\bD0\b/gi, "d'") // D0lives → d'olives
        .replace(/\bTh0n\b/gi, 'Thon') // Th0n → Thon
        .replace(/\bM0\b/gi, 'Mo') // M0zzarella → Mozzarella
        .replace(/\bC0\b/gi, 'Co') // C0la → Cola
        .replace(/\bLim0\b/gi, 'Limo') // Lim0nade → Limonade
        .replace(/\bR0\b/gi, 'Ro') // R0sé → Rosé
        .replace(/\bSir0p\b/gi, 'Sirop') // Sir0p → Sirop
        // Suppression mots non significatifs
        .replace(/\b(De|Du|Des|Le|La|Les|Un|Une)\b/gi, '')
        .replace(/\b(Paquet|Boite|Sachet|Bouteille|Pack)\b/gi, '')
        // Nettoyage final
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    );
  }
}
