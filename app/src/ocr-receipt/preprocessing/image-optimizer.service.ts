import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';

export interface ImageOptimizationOptions {
  /** Appliquer la binarisation (noir et blanc) */
  binarize?: boolean;
  /** Seuil de binarisation (0-255) */
  threshold?: number;
  /** Appliquer la normalisation du contraste */
  normalize?: boolean;
  /** Appliquer un filtre de netteté */
  sharpen?: boolean;
  /** Augmenter le contraste */
  contrast?: number;
  /** Ajuster la luminosité */
  brightness?: number;
  /** Taille maximale en pixels */
  maxWidth?: number;
  maxHeight?: number;
}

@Injectable()
export class ImageOptimizerService {
  /**
   * Optimise une image pour améliorer la précision de l'OCR
   * @param imageBuffer Buffer de l'image d'entrée
   * @param options Options d'optimisation
   * @returns Buffer de l'image optimisée
   */
  async optimizeForOCR(
    imageBuffer: Buffer,
    options: ImageOptimizationOptions = {},
  ): Promise<Buffer> {
    const {
      binarize = true,
      threshold = 128,
      normalize = true,
      sharpen = true,
      contrast = 1.2,
      brightness = 1.0,
      maxWidth = 2048,
      maxHeight = 2048,
    } = options;

    let image = sharp(imageBuffer);

    // Redimensionner si nécessaire (conserver les proportions)
    const metadata = await image.metadata();
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        image = image.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
    }

    // Conversion en niveaux de gris
    image = image.grayscale();

    // Normalisation du contraste (améliore la lisibilité)
    if (normalize) {
      image = image.normalize();
    }

    // Ajustement de la luminosité et du contraste
    image = image.modulate({
      brightness,
      saturation: 1.0,
    });

    if (contrast !== 1.0) {
      image = image.linear(contrast, -(128 * contrast) + 128);
    }

    // Filtre de netteté (améliore la détection des caractères)
    if (sharpen) {
      image = image.sharpen();
    }

    // Binarisation (noir et blanc strict)
    if (binarize) {
      image = image.threshold(threshold);
    }

    return image.png().toBuffer();
  }

  /**
   * Détecte l'orientation de l'image et la corrige si nécessaire
   */
  async autoRotate(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer).rotate().png().toBuffer();
  }

  /**
   * Prétraitement spécifique aux tickets de caisse
   * - Optimisé pour le texte noir sur fond blanc
   * - Gestion des reflets et ombres
   */
  async preprocessReceiptImage(imageBuffer: Buffer): Promise<Buffer> {
    let image = sharp(imageBuffer);

    // Auto-rotation basée sur les métadonnées EXIF
    image = image.rotate();

    // Redimensionnement intelligent
    const metadata = await image.metadata();
    if (metadata.width && metadata.height) {
      // Pour les tickets, on privilégie une largeur de 1200px maximum
      if (metadata.width > 1200) {
        image = image.resize(1200, null, {
          withoutEnlargement: true,
        });
      }
    }

    // Conversion en niveaux de gris
    image = image.grayscale();

    // Réduction du bruit (flou léger puis netteté)
    image = image.blur(0.5).sharpen();

    // Amélioration du contraste spécifique aux tickets
    image = image.normalize().modulate({
      brightness: 1.1,
      saturation: 1.0,
    });

    // Contraste adaptatif
    image = image.linear(1.3, -(128 * 1.3) + 128);

    // Binarisation avec seuil adaptatif
    image = image.threshold(130);

    return image.png().toBuffer();
  }

  /**
   * Analyse la qualité de l'image pour l'OCR
   * @param imageBuffer Buffer de l'image
   * @returns Score de qualité (0-1)
   */
  async analyzeImageQuality(imageBuffer: Buffer): Promise<number> {
    const image = sharp(imageBuffer);
    const { width, height, channels, density } = await image.metadata();
    const stats = await image.stats();

    let qualityScore = 0;

    // Score basé sur la résolution
    if (width && height) {
      const pixelCount = width * height;
      const resolutionScore = Math.min(pixelCount / (800 * 1200), 1);
      qualityScore += resolutionScore * 0.3;
    }

    // Score basé sur la densité (DPI)
    if (density && density >= 150) {
      qualityScore += 0.2;
    }

    // Score basé sur le contraste (écart type des niveaux de gris)
    if (stats.channels && stats.channels[0]) {
      const contrast = stats.channels[0].stdev / 128; // Normalisé sur [0,1]
      qualityScore += Math.min(contrast, 1) * 0.3;
    }

    // Score basé sur les canaux couleur (préférer les images en niveaux de gris)
    if (channels === 1 || channels === 2) {
      qualityScore += 0.2;
    } else if (channels === 3) {
      qualityScore += 0.1;
    }

    return Math.min(qualityScore, 1);
  }

  /**
   * Crée plusieurs versions optimisées de l'image pour différents cas d'usage
   */
  async createOptimizedVariants(imageBuffer: Buffer): Promise<{
    standard: Buffer;
    highContrast: Buffer;
    denoised: Buffer;
  }> {
    const [standard, highContrast, denoised] = await Promise.all([
      this.preprocessReceiptImage(imageBuffer),
      this.optimizeForOCR(imageBuffer, {
        contrast: 1.5,
        threshold: 120,
        brightness: 1.2,
      }),
      this.optimizeForOCR(imageBuffer, {
        contrast: 1.1,
        threshold: 140,
        brightness: 1.0,
        sharpen: false,
      }),
    ]);

    return {
      standard,
      highContrast,
      denoised,
    };
  }

  /**
   * Récupère les métadonnées d'une image
   */
  async getImageMetadata(imageBuffer: Buffer) {
    return sharp(imageBuffer).metadata();
  }
}
