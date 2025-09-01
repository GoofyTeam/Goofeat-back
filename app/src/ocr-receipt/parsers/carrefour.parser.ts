/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import {
  ItemPattern,
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptParser,
} from './receipt-parser.interface';

@Injectable()
export class CarrefourParser implements ReceiptParser {
  private readonly logger = new Logger(CarrefourParser.name);
  readonly storeName = 'Carrefour';

  // Patterns spécifiques à Carrefour
  private readonly storePatterns = [
    /CARREFOUR/i,
    /CARREFOUR\s+MARKET/i,
    /CARREFOUR\s+CITY/i,
    /CARREFOUR\s+EXPRESS/i,
  ];

  private readonly itemPatterns: ItemPattern[] = [
    // Pattern principal: "PRODUIT QUANTITE x PRIX_UNIT = PRIX_TOTAL"
    {
      regex:
        /^(.+?)\s+(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+[,.]\d{2})\s*[€]?\s*=\s*(\d+[,.]\d{2})\s*[€]?$/,
      groups: {
        productName: 1,
        quantity: 2,
        unitPrice: 3,
        totalPrice: 4,
      },
    },
    // Pattern avec unité: "PRODUIT 1.250 kg x 2.99 €/kg = 3.74 €"
    {
      regex:
        /^(.+?)\s+(\d+[,.]\d+)\s*(kg|g|l|ml|pcs?)\s*[xX×]\s*(\d+[,.]\d{2})\s*[€]?\/?\w*\s*=\s*(\d+[,.]\d{2})\s*[€]?$/,
      groups: {
        productName: 1,
        quantity: 2,
        unit: 3,
        unitPrice: 4,
        totalPrice: 5,
      },
    },
    // Pattern simple: "PRODUIT PRIX"
    {
      regex: /^(.+?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        totalPrice: 2,
      },
      validator: (match) => {
        // S'assurer que ce n'est pas une ligne de total
        const product = match[1].toUpperCase();
        return (
          !product.includes('TOTAL') &&
          !product.includes('SOUS-TOTAL') &&
          !product.includes('TVA') &&
          product.length > 3
        );
      },
    },
    // Pattern avec code produit: "1234567 PRODUIT 3.99"
    {
      regex: /^(\d{6,13})\s+(.+?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productCode: 1,
        productName: 2,
        totalPrice: 3,
      },
    },
  ];

  private readonly totalPattern =
    /(?:TOTAL|SOMME)\s*:?\s*(\d+[,.]\d{2})\s*[€]?/i;
  private readonly datePattern =
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2})[:.](\d{2})/;
  private readonly addressPattern = /CARREFOUR.*?\n(.*?)\n(\d{5}\s+[A-Z\s]+)/i;

  canParse(ocrText: string): boolean {
    return this.storePatterns.some((pattern) => pattern.test(ocrText));
  }

  getConfidenceScore(ocrText: string): number {
    let score = 0;

    // Score basé sur la détection de l'enseigne
    const storeMatches = this.storePatterns.filter((pattern) =>
      pattern.test(ocrText),
    );
    score += storeMatches.length * 0.3;

    // Score basé sur le format des lignes d'items
    const lines = ocrText.split('\n');
    let matchingLines = 0;

    for (const line of lines) {
      if (
        this.itemPatterns.some((pattern) => pattern.regex.test(line.trim()))
      ) {
        matchingLines++;
      }
    }

    if (lines.length > 0) {
      score += (matchingLines / lines.length) * 0.5;
    }

    // Score pour la présence d'un total
    if (this.totalPattern.test(ocrText)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  async parseReceipt(
    ocrText: string,
    ocrConfidence: number,
  ): Promise<ParsedReceipt> {
    this.logger.debug(
      `Parsing ticket Carrefour, confiance OCR: ${ocrConfidence}`,
    );

    const lines = ocrText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);
    const items: ParsedReceiptItem[] = [];
    let totalAmount: number | undefined;
    let receiptDate: Date | undefined;
    let storeAddress: string | undefined;

    // Extraction du total
    const totalMatch = ocrText.match(this.totalPattern);
    if (totalMatch) {
      totalAmount = this.parsePrice(totalMatch[1]);
    }

    // Extraction de la date
    const dateMatch = ocrText.match(this.datePattern);
    if (dateMatch) {
      const [, day, month, year, hour, minute] = dateMatch;
      receiptDate = new Date(
        parseInt(year) < 100 ? 2000 + parseInt(year) : parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
      );
    }

    // Extraction de l'adresse
    const addressMatch = ocrText.match(this.addressPattern);
    if (addressMatch) {
      storeAddress = `${addressMatch[1].trim()}, ${addressMatch[2].trim()}`;
    }

    // Parsing des items
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const item = this.parseReceiptLine(line, i);

      if (item) {
        items.push(item);
      }
    }

    // Calcul de la confiance de parsing
    const parsingConfidence = this.calculateParsingConfidence(
      items,
      totalAmount,
      ocrConfidence,
    );

    return {
      storeName: this.storeName,
      storeAddress,
      receiptDate,
      totalAmount,
      items,
      parsingConfidence,
      parserUsed: 'carrefour',
    };
  }

  private parseReceiptLine(
    line: string,
    lineNumber: number,
  ): ParsedReceiptItem | null {
    // Ignorer les lignes non pertinentes
    if (this.shouldIgnoreLine(line)) {
      return null;
    }

    // Essayer chaque pattern
    for (const pattern of this.itemPatterns) {
      const match = line.match(pattern.regex);

      if (match) {
        // Valider si un validator est défini
        if (pattern.validator && !pattern.validator(match)) {
          continue;
        }

        return this.createReceiptItem(match, pattern, line, lineNumber);
      }
    }

    return null;
  }

  private createReceiptItem(
    match: RegExpMatchArray,
    pattern: ItemPattern,
    rawText: string,
    lineNumber: number,
  ): ParsedReceiptItem {
    const groups = pattern.groups;

    const productName = groups.productName
      ? match[groups.productName].trim()
      : '';
    const quantity = groups.quantity
      ? this.parseNumber(match[groups.quantity])
      : 1;
    const unit = groups.unit ? this.normalizeUnit(match[groups.unit]) : 'pcs';
    const unitPrice = groups.unitPrice
      ? this.parsePrice(match[groups.unitPrice])
      : undefined;
    const totalPrice = groups.totalPrice
      ? this.parsePrice(match[groups.totalPrice])
      : 0;
    const productCode = groups.productCode
      ? match[groups.productCode]
      : undefined;

    // Application de transformations personnalisées
    let item: ParsedReceiptItem = {
      rawText,
      productName: this.cleanProductName(productName),
      quantity,
      unit,
      unitPrice,
      totalPrice,
      productCode,
      confidence: 0.8, // Base confidence for Carrefour patterns
      lineNumber,
    };

    // Appliquer transformer si défini
    if (pattern.transformer) {
      item = { ...item, ...pattern.transformer(match) };
    }

    // Calculer le prix unitaire si manquant
    if (!item.unitPrice && item.totalPrice > 0 && item.quantity > 0) {
      item.unitPrice = item.totalPrice / item.quantity;
    }

    return item;
  }

  private shouldIgnoreLine(line: string): boolean {
    const ignorePatterns = [
      /^CARREFOUR/i,
      /^MERCI/i,
      /^BONNE\s+JOURNEE/i,
      /^TVA/i,
      /^TOTAL/i,
      /^SOUS[-\s]?TOTAL/i,
      /^RENDU/i,
      /^CARTE/i,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^CAISSIER/i,
      /^N°\s*TICKET/i,
      /^={3,}/,
      /^-{3,}/,
      /^\s*$/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(line));
  }

  private cleanProductName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/[*]+/g, '')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Title case
  }

  private normalizeUnit(unit: string): string {
    const unitMap: { [key: string]: string } = {
      kg: 'kg',
      g: 'g',
      l: 'l',
      ml: 'ml',
      cl: 'cl',
      pcs: 'pcs',
      pc: 'pcs',
      piece: 'pcs',
      pieces: 'pcs',
    };

    return unitMap[unit.toLowerCase()] || 'pcs';
  }

  private parseNumber(str: string): number {
    return parseFloat(str.replace(',', '.'));
  }

  private parsePrice(str: string): number {
    return parseFloat(str.replace(',', '.'));
  }

  private calculateParsingConfidence(
    items: ParsedReceiptItem[],
    totalAmount: number | undefined,
    ocrConfidence: number,
  ): number {
    let confidence = ocrConfidence * 0.4; // Base sur la confiance OCR

    // Bonus pour les items parsés
    if (items.length > 0) {
      const avgItemConfidence =
        items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
      confidence += avgItemConfidence * 0.3;
    }

    // Bonus si le total correspond aux items
    if (totalAmount && items.length > 0) {
      const calculatedTotal = items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const totalDiff = Math.abs(calculatedTotal - totalAmount) / totalAmount;

      if (totalDiff < 0.01) {
        // Différence < 1%
        confidence += 0.3;
      } else if (totalDiff < 0.05) {
        // Différence < 5%
        confidence += 0.15;
      }
    }

    return Math.min(confidence, 1);
  }
}
