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
    this.parsers = [
      this.leclercParser,
      this.carrefourParser,
      this.genericParser,
    ];
  }

  async parseReceipt(
    ocrText: string,
    ocrConfidence: number,
  ): Promise<ParsedReceipt> {
    this.logger.debug('Début du parsing de ticket français');

    const cleanedText = this.preprocessOcrText(ocrText);

    const bestParser = this.selectBestParser(cleanedText);

    this.logger.debug(`Parser sélectionné: ${bestParser.storeName}`);

    const result = await bestParser.parseReceipt(cleanedText, ocrConfidence);

    this.applyFrenchPostProcessing(result);

    this.logger.debug(
      `Parsing terminé: ${result.items.length} items, confiance: ${result.parsingConfidence}`,
    );

    return result;
  }

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

  private preprocessOcrText(ocrText: string): string {
    return ocrText
      .replace(/\s+/g, ' ')
      .replace(/0/g, 'O')
      .replace(/O/g, '0')
      .replace(/[àâä]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìîï]/g, 'i')
      .replace(/[òôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/(\d)\s*,\s*(\d{2})\s*€/g, '$1,$2')
      .replace(/(\d)\s*\.\s*(\d{2})\s*€/g, '$1.$2')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private applyFrenchPostProcessing(receipt: ParsedReceipt): void {
    receipt.items.forEach((item) => {
      item.productName = this.improveFrenchProductName(item.productName);
    });

    this.correctCommonQuantityErrors(receipt.items);

    this.validatePriceConsistency(receipt.items);

    this.calculateQualityMetrics(receipt);
  }

  private improveFrenchProductName(name: string): string {
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

    for (const [wrong, correct] of Object.entries(corrections)) {
      improved = improved.replace(new RegExp(wrong, 'g'), correct);
    }

    return improved
      .replace(/\s+/g, ' ')
      .replace(/[0-9]{13,}/g, '')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private correctCommonQuantityErrors(items: ParsedReceiptItem[]): void {
    items.forEach((item) => {
      if (item.quantity > 100 && item.unit === 'pcs') {
        if (item.quantity.toString().includes('.')) {
          const possiblePrice = item.quantity;
          item.quantity = 1;
          if (!item.unitPrice && possiblePrice < 1000) {
            item.unitPrice = possiblePrice;
            item.totalPrice = possiblePrice;
          }
        }
      }

      if (item.unit === 'pcs' && item.quantity < 1 && item.quantity > 0) {
        item.unit = 'kg';
      }
    });
  }

  private validatePriceConsistency(items: ParsedReceiptItem[]): void {
    items.forEach((item) => {
      if (item.unitPrice && item.quantity > 0) {
        const calculatedTotal = item.unitPrice * item.quantity;
        const difference = Math.abs(calculatedTotal - item.totalPrice);

        if (difference / item.totalPrice > 0.1) {
          item.confidence = Math.min(item.confidence, 0.6);
        }
      }

      if (item.totalPrice > 1000) {
        item.confidence = Math.min(item.confidence, 0.3);
      }

      if (item.totalPrice < 0.01 && !item.productName.includes('Réduction')) {
        item.confidence = Math.min(item.confidence, 0.4);
      }
    });
  }

  private calculateQualityMetrics(receipt: ParsedReceipt): void {
    if (receipt.items.length === 0) {
      return;
    }

    const avgItemConfidence =
      receipt.items.reduce((sum, item) => sum + item.confidence, 0) /
      receipt.items.length;

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

    receipt.parsingConfidence = Math.min(
      receipt.parsingConfidence + totalConsistencyBonus,
      avgItemConfidence * 0.7 + receipt.parsingConfidence * 0.3,
    );
  }

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

  getSupportedStores(): string[] {
    return this.parsers
      .filter((parser) => parser.storeName !== 'Générique')
      .map((parser) => parser.storeName);
  }
}
