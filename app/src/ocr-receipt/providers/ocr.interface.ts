/**
 * Interface commune pour tous les providers OCR
 */
export interface OcrProvider {
  /**
   * Extrait le texte d'une image
   * @param imageBuffer Buffer de l'image
   * @returns Résultat de l'extraction OCR
   */
  extractText(imageBuffer: Buffer): Promise<OcrResult>;

  /**
   * Nom du provider OCR
   */
  readonly providerName: string;
}

/**
 * Résultat de l'extraction OCR
 */
export interface OcrResult {
  /** Texte brut extrait */
  text: string;

  /** Score de confiance global (0-1) */
  confidence: number;

  /** Lignes de texte détectées avec leurs positions et confiances */
  lines: OcrLine[];

  /** Mots détectés avec leurs positions et confiances */
  words?: OcrWord[];

  /** Temps de traitement en millisecondes */
  processingTime: number;
}

/**
 * Ligne de texte détectée
 */
export interface OcrLine {
  /** Texte de la ligne */
  text: string;

  /** Score de confiance pour cette ligne (0-1) */
  confidence: number;

  /** Boîte englobante de la ligne */
  bbox?: BoundingBox;

  /** Mots contenus dans cette ligne */
  words: OcrWord[];
}

/**
 * Mot détecté
 */
export interface OcrWord {
  /** Texte du mot */
  text: string;

  /** Score de confiance pour ce mot (0-1) */
  confidence: number;

  /** Boîte englobante du mot */
  bbox?: BoundingBox;
}

/**
 * Boîte englobante (bounding box)
 */
export interface BoundingBox {
  /** Position X du coin supérieur gauche */
  x0: number;

  /** Position Y du coin supérieur gauche */
  y0: number;

  /** Position X du coin inférieur droit */
  x1: number;

  /** Position Y du coin inférieur droit */
  y1: number;
}

/**
 * Options de configuration pour l'OCR
 */
export interface OcrOptions {
  /** Langue(s) de reconnaissance */
  language?: string | string[];

  /** Mode de segmentation de page */
  pageSegmentationMode?: PageSegmentationMode;

  /** Mode de reconnaissance des caractères */
  ocrEngineMode?: OcrEngineMode;

  /** Variables de configuration spécifiques au moteur */
  variables?: Record<string, string | number>;
}

/**
 * Modes de segmentation de page Tesseract
 */
export enum PageSegmentationMode {
  /** Orientation et détection automatique */
  AUTO = 0,
  /** Page avec orientation automatique */
  AUTO_ONLY = 1,
  /** Page avec orientation automatique mais sans OSD */
  AUTO_OSD = 2,
  /** Page entière sans OSD */
  FULL_PAGE_NO_OSD = 3,
  /** Page entière avec OSD */
  FULL_PAGE = 4,
  /** Bloc vertical uniforme de texte */
  SINGLE_BLOCK_VERT_TEXT = 5,
  /** Bloc uniforme de texte */
  SINGLE_BLOCK = 6,
  /** Ligne de texte unique */
  SINGLE_LINE = 7,
  /** Mot unique */
  SINGLE_WORD = 8,
  /** Mot unique dans un cercle */
  SINGLE_WORD_CIRCLE = 9,
  /** Caractère unique */
  SINGLE_CHAR = 10,
  /** Texte clairsemé */
  SPARSE_TEXT = 11,
  /** Texte clairsemé avec OSD */
  SPARSE_TEXT_OSD = 12,
  /** Ligne brute (pas d'hacks spécifiques) */
  RAW_LINE = 13,
}

/**
 * Modes du moteur OCR Tesseract
 */
export enum OcrEngineMode {
  /** Moteur Tesseract legacy uniquement */
  LEGACY_ONLY = 0,
  /** Réseau de neurones LSTM uniquement */
  LSTM_ONLY = 1,
  /** Legacy + LSTM */
  LEGACY_LSTM = 2,
  /** Par défaut (dépend de la disponibilité) */
  DEFAULT = 3,
}
