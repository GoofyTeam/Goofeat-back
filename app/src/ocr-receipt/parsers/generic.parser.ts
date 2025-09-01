/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import {
  ItemPattern,
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptParser,
} from './receipt-parser.interface';

@Injectable()
export class GenericParser implements ReceiptParser {
  private readonly logger = new Logger(GenericParser.name);
  readonly storeName = 'Générique';

  private readonly itemPatterns: ItemPattern[] = [
    // Pattern français typique: "1 PAQUET DE SURIMI 5.96"
    {
      regex: /^(\d+(?:[,.]\d+)?)\s+(.+?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        quantity: 1,
        productName: 2,
        totalPrice: 3,
      },
      validator: (match) => {
        const productName = match[2].trim();
        // Le nom doit contenir au moins 3 caractères et ne pas être que des chiffres
        return productName.length >= 3 && !/^\d+$/.test(productName);
      },
    },
    // Pattern générique avec quantité et prix unitaire: "PRODUIT 2 x 3,99 7,98"
    {
      regex:
        /^(.+?)\s+(\d+(?:[,.]\d+)?)\s*[xX×]\s*(\d+[,.]\d{2})\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        quantity: 2,
        unitPrice: 3,
        totalPrice: 4,
      },
    },
    // Pattern avec unité: "POMMES 1.5 kg 4.50"
    {
      regex:
        /^(.+?)\s+(\d+[,.]\d+)\s*(kg|g|l|ml|cl|pcs?)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        quantity: 2,
        unit: 3,
        totalPrice: 4,
      },
    },
    // Pattern simple: "PRODUIT PRIX"
    {
      regex: /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-'.]+)\s+(\d+[,.]\d{2})\s*[€]?\s*$/,
      groups: {
        productName: 1,
        totalPrice: 2,
      },
      validator: (match) => {
        const product = match[1].toUpperCase().trim();
        return (
          !this.isIgnoredProduct(product) &&
          product.length > 2 &&
          !product.match(/^\d/)
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
    // Pattern promotion/réduction: "PRODUIT -2.50" ou "REMISE -2.50"
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
    /(?:TOTAL|SOMME|MONTANT)[\s:]*(\d+[,.]\d{2})\s*[€]?/i;
  private readonly datePattern =
    /([\d]{1,2})[/_\-.](\d{1,2})[/_\-.](\d{2,4})(?:\s+(\d{1,2})[:.]?(\d{2}))?/;
  private readonly addressPattern = /(\d{5})\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s'-]+)/;

  canParse(ocrText: string): boolean {
    // Le parser générique peut toujours essayer de parser
    const lines = ocrText.split('\n').filter((line) => line.trim());
    const matchingLines = lines.filter((line) =>
      this.itemPatterns.some((pattern) => pattern.regex.test(line.trim())),
    ).length;

    // Accepter si au moins 20% des lignes correspondent à des patterns connus
    return lines.length > 0 && matchingLines / lines.length >= 0.2;
  }

  getConfidenceScore(ocrText: string): number {
    const lines = ocrText.split('\n').filter((line) => line.trim());
    let score = 0.1; // Score de base faible car parser générique

    // Score basé sur le nombre de lignes reconnues
    let matchingLines = 0;
    for (const line of lines) {
      if (
        this.itemPatterns.some((pattern) => pattern.regex.test(line.trim()))
      ) {
        matchingLines++;
      }
    }

    if (lines.length > 0) {
      score += (matchingLines / lines.length) * 0.6;
    }

    // Bonus pour la présence d'un total
    if (this.totalPattern.test(ocrText)) {
      score += 0.2;
    }

    // Bonus pour la présence d'une date
    if (this.datePattern.test(ocrText)) {
      score += 0.1;
    }

    return Math.min(score, 0.8); // Score max limité pour parser générique
  }

  async parseReceipt(
    ocrText: string,
    ocrConfidence: number,
  ): Promise<ParsedReceipt> {
    this.logger.debug(
      `Parsing ticket générique, confiance OCR: ${ocrConfidence}`,
    );

    let lines = ocrText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    // Si une seule ligne longue, essayer de séparer les items
    if (lines.length === 1 && lines[0].length > 50) {
      this.logger.debug(
        'Détection de ligne longue, tentative de séparation des items',
      );
      const separatedItems = this.separateItemsFromLongLine(lines[0]);
      if (separatedItems.length > 1) {
        lines = separatedItems;
        this.logger.debug(
          `Séparation réussie: ${separatedItems.length} items trouvés`,
        );
      }
    }
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
      const [, day, month, year, hour = '12', minute = '00'] = dateMatch;
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
      storeAddress = `${addressMatch[1]} ${addressMatch[2]}`;
    }

    // Parsing des items
    this.logger.debug(`Parsing ${lines.length} lignes de ticket`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.logger.debug(`Ligne ${i}: "${line}"`);
      const item = this.parseReceiptLine(line, i);

      if (item) {
        this.logger.debug(
          `Item trouvé: ${item.productName} - ${item.quantity} - ${item.totalPrice}`,
        );
        items.push(item);
      }
    }
    this.logger.debug(`Parsing terminé: ${items.length} items détectés`);

    // Post-traitement générique
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
      parserUsed: 'generic',
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
      confidence: 0.7, // Confiance modérée pour parser générique
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
        const baseProductName = item.productName.replace(' (Réduction)', '');
        const mainItemIndex = items.findIndex(
          (otherItem) =>
            otherItem.productName
              .toLowerCase()
              .includes(baseProductName.toLowerCase()) && otherItem !== item,
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
      /^MERCI/i,
      /^BONNE\s+JOURNEE/i,
      /^AU\s+REVOIR/i,
      /^A\s+BIENTOT/i,
      /^TVA/i,
      /^TOTAL/i,
      /^SOUS[-\s]?TOTAL/i,
      /^RENDU/i,
      /^MONNAIE/i,
      /^ESPECES/i,
      /^CARTE/i,
      /^CB/i,
      /^CHEQUE/i,
      /^\d{2}[/_-]\d{2}[/_-]\d{2,4}/,
      /^CAISSE/i,
      /^TICKET/i,
      /^N°/i,
      /^REF/i,
      /^SIRET/i,
      /^RCS/i,
      /^TEL/i,
      /^FAX/i,
      /^WWW\./i,
      /^HTTP/i,
      /^={3,}/,
      /^-{3,}/,
      /^\*{3,}/,
      /^_{3,}/,
      /^\s*$/,
    ];

    return ignorePatterns.some((pattern) => pattern.test(line));
  }

  private isIgnoredProduct(productName: string): boolean {
    const ignoredProducts = [
      'TOTAL',
      'SOUS-TOTAL',
      'TVA',
      'RENDU',
      'MONNAIE',
      'ESPECES',
      'CARTE',
      'CB',
      'CHEQUE',
      'TICKET',
      'CAISSE',
      'MERCI',
      'BONNE JOURNEE',
      'AU REVOIR',
      'A BIENTOT',
    ];

    return ignoredProducts.some((ignored) => productName.includes(ignored));
  }

  private cleanProductName(name: string): string {
    return (
      name
        // Corrections OCR courantes
        .replace(/0/g, 'o') // B0ite → Boite
        .replace(/1(?=[a-z])/g, 'i') // 1 → i seulement si suivi d'une lettre
        .replace(/5(?=[A-Z])/g, 'S') // 5AUCISSON → SAUCISSON
        .replace(/ï/g, 'i') // ï → i (MaïS → Mais)
        .replace(/À/g, 'A') // À → A
        .replace(/Â/g, 'A') // BÂT0NNETS → BATONNETS
        // Nettoyage caractères spéciaux et codes barres
        .replace(/[*+#@]+/g, '')
        .replace(/\b\d{13}\b/g, '') // Supprimer les codes barres
        // Correction mots courants mal OCRisés
        .replace(/\bOlives?\b/gi, 'Olives')
        .replace(/\bSaucisson\b/gi, 'Saucisson')
        .replace(/\bConserves?\b/gi, 'Conserves')
        .replace(/\bMozzarella\b/gi, 'Mozzarella')
        .replace(/\bBouteilles?\b/gi, 'Bouteille')
        .replace(/\bSirop\b/gi, 'Sirop')
        // Espaces multiples et trim
        .replace(/\s+/g, ' ')
        .trim()
        // Capitalisation propre
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
    );
  }

  private normalizeUnit(unit: string): string {
    const unitMap: { [key: string]: string } = {
      kg: 'kg',
      kilo: 'kg',
      kilos: 'kg',
      g: 'g',
      gr: 'g',
      gramme: 'g',
      grammes: 'g',
      l: 'l',
      litre: 'l',
      litres: 'l',
      ml: 'ml',
      millilitre: 'ml',
      millilitres: 'ml',
      cl: 'cl',
      centilitre: 'cl',
      centilitres: 'cl',
      pcs: 'pcs',
      pc: 'pcs',
      piece: 'pcs',
      pieces: 'pcs',
      u: 'pcs',
      unite: 'pcs',
      unites: 'pcs',
      boite: 'pcs',
      boites: 'pcs',
      paquet: 'pcs',
      paquets: 'pcs',
    };

    return unitMap[unit.toLowerCase()] || 'pcs';
  }

  private parseNumber(str: string): number {
    return parseFloat(str.replace(',', '.'));
  }

  private parsePrice(str: string): number {
    // Corrections OCR courantes pour les prix
    const cleanedPrice = str
      .replace(',', '.') // Virgule → point décimal
      .replace(/s/gi, '5') // s → 5 (s.13 → 5.13)
      .replace(/o/gi, '0') // o → 0 (1o.99 → 10.99)
      .replace(/l/gi, '1') // l → 1 (l.99 → 1.99)
      .replace(/[^0-9.]/g, ''); // Supprimer caractères non numériques

    const parsed = parseFloat(cleanedPrice);
    return isNaN(parsed) ? 0 : parsed;
  }

  private calculateParsingConfidence(
    items: ParsedReceiptItem[],
    totalAmount: number | undefined,
    ocrConfidence: number,
  ): number {
    let confidence = ocrConfidence * 0.3; // Base réduite pour parser générique

    // Bonus pour les items parsés
    if (items.length > 0) {
      const avgItemConfidence =
        items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
      confidence += avgItemConfidence * 0.4;
    }

    // Vérification du total (moins strict pour générique)
    if (totalAmount && items.length > 0) {
      const calculatedTotal = items.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const totalDiff = Math.abs(calculatedTotal - totalAmount) / totalAmount;

      if (totalDiff < 0.05) {
        confidence += 0.3;
      } else if (totalDiff < 0.1) {
        confidence += 0.2;
      } else if (totalDiff < 0.2) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 0.85); // Limite pour parser générique
  }

  /**
   * Sépare une ligne longue contenant plusieurs items
   */
  private separateItemsFromLongLine(longLine: string): string[] {
    const items: string[] = [];

    // Pattern pour détecter le début d'un nouvel item : nombre suivi d'un espace et d'une lettre majuscule
    const itemStartPattern = /(\d+\s+[A-ZÀ-Ÿ])/g;

    let lastIndex = 0;
    let match;

    // Traiter le premier item (commence au début)
    let firstMatch = true;

    while ((match = itemStartPattern.exec(longLine)) !== null) {
      if (!firstMatch && match.index !== undefined) {
        // Extraire l'item précédent
        const item = longLine.substring(lastIndex, match.index).trim();
        if (item.length > 5) {
          items.push(item);
        }
        lastIndex = match.index;
      } else {
        // Pour le premier match, commencer depuis le début
        firstMatch = false;
        lastIndex = 0;
      }
    }

    // Ajouter le dernier item (depuis le dernier match jusqu'à la fin)
    if (lastIndex < longLine.length) {
      const lastItem = longLine.substring(lastIndex).trim();
      if (lastItem.length > 5) {
        items.push(lastItem);
      }
    }

    // Si aucun item trouvé par cette méthode, essayer une approche basée sur les prix
    if (items.length <= 1) {
      return this.separateItemsByPricePattern(longLine);
    }

    this.logger.debug(`Séparation par patterns: ${items.length} items trouvés`);

    // Post-traitement pour recomposer les items coupés
    const mergedItems = this.mergeIncompleteItems(items);

    mergedItems.forEach((item, i) => this.logger.debug(`Item ${i}: "${item}"`));

    return mergedItems;
  }

  /**
   * Sépare les items en se basant sur les patterns de prix
   */
  private separateItemsByPricePattern(longLine: string): string[] {
    const items: string[] = [];

    // Pattern pour détecter un prix : X.XX suivi d'un espace et d'un chiffre (début du prochain item)
    const pricePattern = /(\d+[,.]\d{2})\s+(\d)/g;

    let lastIndex = 0;
    let match;

    while ((match = pricePattern.exec(longLine)) !== null) {
      if (match.index !== undefined) {
        // Extraire l'item (du début ou de la fin du précédent jusqu'au prix inclus)
        const endIndex = match.index + match[1].length; // Position après le prix
        const item = longLine.substring(lastIndex, endIndex).trim();

        if (item.length > 5) {
          items.push(item);
        }

        // Le prochain item commence juste avant le chiffre trouvé
        lastIndex = match.index + match[1].length + 1; // +1 pour l'espace
      }
    }

    // Ajouter le dernier item
    if (lastIndex < longLine.length) {
      const lastItem = longLine.substring(lastIndex).trim();
      if (lastItem.length > 5) {
        items.push(lastItem);
      }
    }

    return items;
  }

  /**
   * Recompose les items coupés (ex: "1 PACK DE" + "6 EAUX GAZEUSES 4.02")
   */
  private mergeIncompleteItems(items: string[]): string[] {
    const merged: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i].trim();

      // Si l'item se termine par "DE" ou similaire et est court, essayer de merger avec le suivant
      if (
        (currentItem.endsWith(' DE') ||
          currentItem.endsWith(' DU') ||
          currentItem.endsWith(' DES') ||
          currentItem.length < 15) &&
        i + 1 < items.length
      ) {
        const nextItem = items[i + 1].trim();

        // Vérifier si l'item suivant a un pattern valide (nombre + produit + prix)
        const pricePattern = /\d+[,.]\d{2}$/;
        if (pricePattern.test(nextItem)) {
          // Merger les deux items
          merged.push(`${currentItem} ${nextItem}`);
          i++; // Passer l'item suivant car il a été mergé
          continue;
        }
      }

      // Si l'item ne contient pas de prix valide, essayer de le merger avec le suivant
      const hasValidPrice = /\d+[,.]\d{2}/.test(currentItem);
      if (!hasValidPrice && i + 1 < items.length && currentItem.length > 3) {
        const nextItem = items[i + 1].trim();
        const nextHasPrice = /\d+[,.]\d{2}/.test(nextItem);

        if (nextHasPrice) {
          merged.push(`${currentItem} ${nextItem}`);
          i++; // Passer l'item suivant
          continue;
        }
      }

      // Garder l'item tel quel s'il n'a pas été mergé
      if (currentItem.length > 3) {
        // Filtrer les items trop courts
        merged.push(currentItem);
      }
    }

    return merged;
  }
}
