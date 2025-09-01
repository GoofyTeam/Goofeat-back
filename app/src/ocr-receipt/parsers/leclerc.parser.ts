/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import {
  ItemPattern,
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptParser,
} from './receipt-parser.interface';

@Injectable()
export class LeclercParser implements ReceiptParser {
  private readonly logger = new Logger(LeclercParser.name);
  readonly storeName = 'Leclerc';

  // Patterns spécifiques à Leclerc
  private readonly storePatterns = [
    /E\.LECLERC/i,
    /LECLERC/i,
    /CENTRE\s+LECLERC/i,
  ];

  private readonly itemPatterns: ItemPattern[] = [
    // Pattern Leclerc avec quantité: "PRODUIT 1,250 x 2,99 3,74"
    {
      regex:
        /^(.+?)\s+(\d+[,.]\d+)\s*[xX×]\s*(\d+[,.]\d{2})\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        quantity: 2,
        unitPrice: 3,
        totalPrice: 4,
      },
    },
    // Pattern avec unité Leclerc: "POMMES BIO 1,5 kg 4,50"
    {
      regex:
        /^(.+?)\s+(\d+[,.]\d+)\s*(kg|g|l|ml|pcs?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        quantity: 2,
        unit: 3,
        totalPrice: 4,
      },
    },
    // Pattern simple Leclerc: "PRODUIT 3,99"
    {
      regex:
        /^([A-Za-zÀ-ÿ\s'-]+(?:\s+[A-Za-z0-9%]+)*)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        totalPrice: 2,
      },
      validator: (match) => {
        const product = match[1].toUpperCase().trim();
        return (
          !product.includes('TOTAL') &&
          !product.includes('RENDU') &&
          !product.includes('CARTE') &&
          !product.includes('TVA') &&
          product.length > 2 &&
          !product.match(/^\d/)
        ); // Ne commence pas par un chiffre
      },
    },
    // Pattern avec référence produit Leclerc
    {
      regex: /^(\d{6,})\s+(.+?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productCode: 1,
        productName: 2,
        totalPrice: 3,
      },
    },
    // Pattern promotion Leclerc: "PRODUIT -0,50"
    {
      regex: /^(.+?)\s+-(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        totalPrice: 2,
      },
      transformer: (match) => ({
        totalPrice: -parseFloat(match[2].replace(',', '.')),
        productName: match[1].trim() + ' (Réduction)',
      }),
    },
  ];

  private readonly totalPattern =
    /(?:TOTAL\s+TTC|TOTAL)\s*:?\s*(\d+[,.]\d{2})\s*[€]?/i;
  private readonly datePattern =
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s*(\d{1,2})[h:.](\d{2})/;
  private readonly addressPattern = /E\.LECLERC.*?\n(.*?)\n(.*?\d{5}.*)/i;

  canParse(ocrText: string): boolean {
    return this.storePatterns.some((pattern) => pattern.test(ocrText));
  }

  getConfidenceScore(ocrText: string): number {
    let score = 0;

    // Score basé sur la détection de l'enseigne
    const storeMatches = this.storePatterns.filter((pattern) =>
      pattern.test(ocrText),
    );
    score += storeMatches.length * 0.35;

    // Score basé sur le format spécifique Leclerc
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
      score += (matchingLines / lines.length) * 0.45;
    }

    // Score pour la présence d'un total TTC (spécifique Leclerc)
    if (/TOTAL\s+TTC/i.test(ocrText)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  async parseReceipt(
    ocrText: string,
    ocrConfidence: number,
  ): Promise<ParsedReceipt> {
    this.logger.debug(
      `Parsing ticket Leclerc, confiance OCR: ${ocrConfidence}`,
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

    // Extraction de la date (format Leclerc avec 'h')
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

    // Post-traitement des items pour Leclerc
    this.postProcessItems(items);

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
      parserUsed: 'leclerc',
    };
  }

  private parseReceiptLine(
    line: string,
    lineNumber: number,
  ): ParsedReceiptItem | null {
    if (this.shouldIgnoreLine(line)) {
      return null;
    }

    // Essayer chaque pattern
    for (const pattern of this.itemPatterns) {
      const match = line.match(pattern.regex);

      if (match) {
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

    let item: ParsedReceiptItem = {
      rawText,
      productName: this.cleanProductName(productName),
      quantity,
      unit,
      unitPrice,
      totalPrice,
      productCode,
      confidence: 0.85, // Leclerc a des patterns assez fiables
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

  private postProcessItems(items: ParsedReceiptItem[]): void {
    // Regrouper les réductions avec leurs produits correspondants
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];

      if (item.productName.includes('(Réduction)')) {
        // Chercher le produit correspondant
        const baseProductName = item.productName.replace(' (Réduction)', '');
        const mainItemIndex = items.findIndex(
          (otherItem) =>
            otherItem.productName.includes(baseProductName) &&
            otherItem !== item,
        );

        if (mainItemIndex !== -1) {
          // Appliquer la réduction au produit principal
          items[mainItemIndex].discount = Math.abs(item.totalPrice);
          items[mainItemIndex].totalPrice += item.totalPrice; // totalPrice de réduction est négatif

          // Supprimer l'item de réduction
          items.splice(i, 1);
        }
      }
    }
  }

  private shouldIgnoreLine(line: string): boolean {
    const ignorePatterns = [
      /^E\.LECLERC/i,
      /^LECLERC/i,
      /^CENTRE/i,
      /^MERCI/i,
      /^A\s+BIENTOT/i,
      /^TVA/i,
      /^TOTAL/i,
      /^RENDU/i,
      /^ESPECES/i,
      /^CARTE/i,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^CAISSE/i,
      /^TICKET/i,
      /^SIRET/i,
      /^={3,}/,
      /^-{3,}/,
      /^\*{3,}/,
      /^\s*$/,
      /^TEL\s*:/i,
    ];

    return ignorePatterns.some((pattern) => pattern.test(line));
  }

  private cleanProductName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/[*+]+/g, '')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private normalizeUnit(unit: string): string {
    const unitMap: { [key: string]: string } = {
      kg: 'kg',
      kilo: 'kg',
      g: 'g',
      gr: 'g',
      gramme: 'g',
      grammes: 'g',
      l: 'l',
      litre: 'l',
      litres: 'l',
      ml: 'ml',
      cl: 'cl',
      pcs: 'pcs',
      pc: 'pcs',
      piece: 'pcs',
      pieces: 'pcs',
      u: 'pcs',
      unite: 'pcs',
      unites: 'pcs',
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
    let confidence = ocrConfidence * 0.4;

    // Bonus pour les items parsés
    if (items.length > 0) {
      const avgItemConfidence =
        items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
      confidence += avgItemConfidence * 0.3;
    }

    // Vérification du total (Leclerc est assez précis)
    if (totalAmount && items.length > 0) {
      const calculatedTotal = items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const totalDiff = Math.abs(calculatedTotal - totalAmount) / totalAmount;

      if (totalDiff < 0.01) {
        confidence += 0.3;
      } else if (totalDiff < 0.05) {
        confidence += 0.2;
      } else if (totalDiff < 0.1) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1);
  }
}
