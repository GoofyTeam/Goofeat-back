/**
 * Interface commune pour tous les parsers de tickets
 */
export interface ReceiptParser {
  /**
   * Nom de l'enseigne supportée
   */
  readonly storeName: string;

  /**
   * Parse le texte OCR d'un ticket et extrait les informations structurées
   * @param ocrText Texte brut de l'OCR
   * @param confidence Score de confiance de l'OCR
   * @returns Informations parsées du ticket
   */
  parseReceipt(ocrText: string, confidence: number): Promise<ParsedReceipt>;

  /**
   * Détecte si ce parser peut traiter le ticket donné
   * @param ocrText Texte brut de l'OCR
   * @returns true si ce parser peut traiter ce ticket
   */
  canParse(ocrText: string): boolean;

  /**
   * Score de confiance du parser pour ce ticket (0-1)
   * Plus le score est élevé, plus le parser est adapté
   */
  getConfidenceScore(ocrText: string): number;
}

/**
 * Résultat du parsing d'un ticket
 */
export interface ParsedReceipt {
  /** Nom du magasin */
  storeName: string;

  /** Adresse du magasin */
  storeAddress?: string;

  /** Date et heure du ticket */
  receiptDate?: Date;

  /** Numéro de ticket */
  receiptNumber?: string;

  /** Montant total */
  totalAmount?: number;

  /** TVA totale */
  totalTax?: number;

  /** Items/produits détectés */
  items: ParsedReceiptItem[];

  /** Informations de paiement */
  paymentInfo?: PaymentInfo;

  /** Score de confiance global du parsing */
  parsingConfidence: number;

  /** Parser utilisé */
  parserUsed: string;
}

/**
 * Item/produit parsé depuis le ticket
 */
export interface ParsedReceiptItem {
  /** Texte brut de la ligne */
  rawText: string;

  /** Nom du produit parsé */
  productName: string;

  /** Quantité détectée */
  quantity: number;

  /** Unité (kg, pcs, l, etc.) */
  unit: string;

  /** Prix unitaire */
  unitPrice?: number;

  /** Prix total pour cet item */
  totalPrice: number;

  /** Code produit (si détecté) */
  productCode?: string;

  /** TVA applicable */
  taxRate?: number;

  /** Promotion/réduction */
  discount?: number;

  /** Score de confiance pour cet item */
  confidence: number;

  /** Ligne d'origine dans le ticket */
  lineNumber: number;
}

/**
 * Informations de paiement
 */
export interface PaymentInfo {
  /** Mode de paiement */
  paymentMethod?: 'cash' | 'card' | 'check' | 'voucher' | 'mixed';

  /** Montant rendu */
  changeGiven?: number;

  /** Référence de transaction */
  transactionRef?: string;
}

/**
 * Pattern de reconnaissance pour un type d'item
 */
export interface ItemPattern {
  /** Expression régulière pour détecter l'item */
  regex: RegExp;

  /** Groupes de capture nommés */
  groups: {
    productName?: number;
    quantity?: number;
    unit?: number;
    unitPrice?: number;
    totalPrice?: number;
    productCode?: number;
  };

  /** Fonction de validation supplémentaire */
  validator?: (match: RegExpMatchArray) => boolean;

  /** Fonction de transformation des données */
  transformer?: (match: RegExpMatchArray) => Partial<ParsedReceiptItem>;
}

/**
 * Configuration d'un parser d'enseigne
 */
export interface ParserConfig {
  /** Nom de l'enseigne */
  storeName: string;

  /** Patterns pour détecter l'enseigne */
  storePatterns: RegExp[];

  /** Patterns pour les différents types d'items */
  itemPatterns: ItemPattern[];

  /** Pattern pour le total */
  totalPattern?: RegExp;

  /** Pattern pour la date */
  datePattern?: RegExp;

  /** Pattern pour l'adresse */
  addressPattern?: RegExp;

  /** Lignes à ignorer (patterns) */
  ignorePatterns?: RegExp[];

  /** Configuration des unités par défaut */
  defaultUnit?: string;

  /** Multiplicateur de quantité par défaut */
  defaultQuantity?: number;
}
