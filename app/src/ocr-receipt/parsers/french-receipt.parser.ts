import { Injectable, Logger } from '@nestjs/common';
import { CarrefourParser } from './carrefour.parser';
import { GenericParser } from './generic.parser';
import { LeclercParser } from './leclerc.parser';
import {
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptParser,
} from './receipt-parser.interface';

@Injectable()
export class FrenchReceiptParser {
  private readonly logger = new Logger(FrenchReceiptParser.name);
  private readonly parsers: ReceiptParser[];

  constructor(
    private readonly leclercParser: LeclercParser,
    private readonly carrefourParser: CarrefourParser,
    private readonly genericParser: GenericParser,
  ) {
    // Ordre des parsers par spécificité (du plus spécifique au plus générique)
    this.parsers = [
      this.leclercParser,
      this.carrefourParser,
      this.genericParser,
    ];
  }

  /**
   * Parse un ticket français en utilisant le parser le plus adapté
   */
  async parseReceipt(
    ocrText: string,
    ocrConfidence: number,
  ): Promise<ParsedReceipt> {
    this.logger.debug('Début du parsing de ticket français');

    // Nettoyer le texte OCR
    const cleanedText = this.preprocessOcrText(ocrText);

    // Trouver le meilleur parser
    const bestParser = this.selectBestParser(cleanedText);

    this.logger.debug(`Parser sélectionné: ${bestParser.storeName}`);

    // Parser avec le parser sélectionné
    const result = await bestParser.parseReceipt(cleanedText, ocrConfidence);

    // Post-traitement générique français
    this.applyFrenchPostProcessing(result);

    this.logger.debug(
      `Parsing terminé: ${result.items.length} items, confiance: ${result.parsingConfidence}`,
    );

    return result;
  }

  /**
   * Sélectionne le meilleur parser en fonction du score de confiance
   */
  private selectBestParser(ocrText: string): ReceiptParser {
    let bestParser: ReceiptParser = this.genericParser;
    let bestScore = 0;

    for (const parser of this.parsers) {
      if (parser.canParse(ocrText)) {
        const score = parser.getConfidenceScore(ocrText);
        this.logger.debug(`Parser ${parser.storeName}: score ${score}`);

        if (score > bestScore) {
          bestScore = score;
          bestParser = parser;
        }
      }
    }

    this.logger.debug(
      `Meilleur parser: ${bestParser.storeName} (score: ${bestScore})`,
    );
    return bestParser;
  }

  /**
   * Préprocessing du texte OCR pour améliorer la reconnaissance
   */
  private preprocessOcrText(ocrText: string): string {
    return (
      ocrText
        // Normaliser les espaces
        .replace(/\s+/g, ' ')
        // Corriger les erreurs OCR communes
        .replace(/0/g, 'O') // Dans les noms de produits
        .replace(/O/g, '0') // Dans les prix
        // Corriger les caractères spéciaux français
        .replace(/[àâä]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìîï]/g, 'i')
        .replace(/[òôö]/g, 'o')
        .replace(/[ùûü]/g, 'u')
        .replace(/ç/g, 'c')
        // Standardiser les séparateurs de prix
        .replace(/(\d)\s*,\s*(\d{2})\s*€/g, '$1,$2')
        .replace(/(\d)\s*\.\s*(\d{2})\s*€/g, '$1.$2')
        // Nettoyer les lignes vides multiples
        .replace(/\n\s*\n/g, '\n')
        .trim()
    );
  }

  /**
   * Post-traitement spécifique aux tickets français
   */
  private applyFrenchPostProcessing(receipt: ParsedReceipt): void {
    // Améliorer les noms de produits français
    receipt.items.forEach((item) => {
      item.productName = this.improveFrenchProductName(item.productName);
    });

    // Détecter et corriger les erreurs de quantités communes
    this.correctCommonQuantityErrors(receipt.items);

    // Valider la cohérence des prix
    this.validatePriceConsistency(receipt.items);

    // Calculer des métriques de qualité
    this.calculateQualityMetrics(receipt);
  }

  /**
   * Améliore les noms de produits français
   */
  private improveFrenchProductName(name: string): string {
    // Corrections communes d'OCR pour le français
    const corrections: { [key: string]: string } = {
      BIOLOGIQUE: 'BIO',
      BIOLOGI0UE: 'BIO',
      FRANCAIS: 'FRANÇAIS',
      FRANCAI5: 'FRANÇAIS',
      FROMAQE: 'FROMAGE',
      LEGUME: 'LÉGUME',
      YAOURT: 'YAOURT',
      Y40URT: 'YAOURT',
      BOEUF: 'BŒUF',
      PORC: 'PORC',
      '0RANGE': 'ORANGE',
      BANANE: 'BANANE',
      POMME: 'POMME',
      TOMATE: 'TOMATE',
    };

    let improved = name.toUpperCase();

    // Appliquer les corrections
    for (const [wrong, correct] of Object.entries(corrections)) {
      improved = improved.replace(new RegExp(wrong, 'g'), correct);
    }

    // Nettoyer et formater
    return improved
      .replace(/\s+/g, ' ')
      .replace(/[0-9]{13,}/g, '') // Supprimer les codes barres
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Title case
  }

  /**
   * Corrige les erreurs communes de quantités
   */
  private correctCommonQuantityErrors(items: ParsedReceiptItem[]): void {
    items.forEach((item) => {
      // Corriger les quantités aberrantes (probablement des erreurs OCR)
      if (item.quantity > 100 && item.unit === 'pcs') {
        // Probable confusion entre quantité et prix
        if (item.quantity.toString().includes('.')) {
          const possiblePrice = item.quantity;
          item.quantity = 1;
          if (!item.unitPrice && possiblePrice < 1000) {
            item.unitPrice = possiblePrice;
            item.totalPrice = possiblePrice;
          }
        }
      }

      // Corriger les unités mal reconnues
      if (item.unit === 'pcs' && item.quantity < 1 && item.quantity > 0) {
        // Probablement un poids en kg mal reconnu
        item.unit = 'kg';
      }
    });
  }

  /**
   * Valide la cohérence des prix
   */
  private validatePriceConsistency(items: ParsedReceiptItem[]): void {
    items.forEach((item) => {
      // Vérifier la cohérence quantité × prix unitaire = prix total
      if (item.unitPrice && item.quantity > 0) {
        const calculatedTotal = item.unitPrice * item.quantity;
        const difference = Math.abs(calculatedTotal - item.totalPrice);

        // Si la différence est significative (>10%), marquer comme incertain
        if (difference / item.totalPrice > 0.1) {
          item.confidence = Math.min(item.confidence, 0.6);
        }
      }

      // Détecter les prix aberrants
      if (item.totalPrice > 1000) {
        // Prix très élevé, probablement une erreur
        item.confidence = Math.min(item.confidence, 0.3);
      }

      if (item.totalPrice < 0.01 && !item.productName.includes('Réduction')) {
        // Prix trop faible
        item.confidence = Math.min(item.confidence, 0.4);
      }
    });
  }

  /**
   * Calcule des métriques de qualité du parsing
   */
  private calculateQualityMetrics(receipt: ParsedReceipt): void {
    if (receipt.items.length === 0) {
      return;
    }

    // Calculer la confiance moyenne des items
    const avgItemConfidence =
      receipt.items.reduce((sum, item) => sum + item.confidence, 0) /
      receipt.items.length;

    // Vérifier la cohérence du total
    let totalConsistencyBonus = 0;
    if (receipt.totalAmount) {
      const calculatedTotal = receipt.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const totalDifference =
        Math.abs(calculatedTotal - receipt.totalAmount) / receipt.totalAmount;

      if (totalDifference < 0.01) {
        totalConsistencyBonus = 0.2;
      } else if (totalDifference < 0.05) {
        totalConsistencyBonus = 0.1;
      }
    }

    // Ajuster la confiance globale
    receipt.parsingConfidence = Math.min(
      receipt.parsingConfidence + totalConsistencyBonus,
      avgItemConfidence * 0.7 + receipt.parsingConfidence * 0.3,
    );
  }

  /**
   * Obtient des statistiques sur les parsers disponibles
   */
  getParserStatistics(ocrText: string): Array<{
    parserName: string;
    canParse: boolean;
    confidenceScore: number;
  }> {
    return this.parsers.map((parser) => ({
      parserName: parser.storeName,
      canParse: parser.canParse(ocrText),
      confidenceScore: parser.getConfidenceScore(ocrText),
    }));
  }

  /**
   * Obtient la liste des enseignes supportées
   */
  getSupportedStores(): string[] {
    return this.parsers
      .filter((parser) => parser.storeName !== 'Générique')
      .map((parser) => parser.storeName);
  }
}
