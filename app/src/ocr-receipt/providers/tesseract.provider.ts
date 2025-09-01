/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import { createWorker, Worker } from 'tesseract.js';
import { ImageOptimizerService } from '../preprocessing/image-optimizer.service';
import {
  OcrEngineMode,
  OcrLine,
  OcrOptions,
  OcrProvider,
  OcrResult,
  OcrWord,
  PageSegmentationMode,
} from './ocr.interface';

@Injectable()
export class TesseractProvider implements OcrProvider {
  private readonly logger = new Logger(TesseractProvider.name);
  readonly providerName = 'tesseract';

  constructor(private readonly imageOptimizer: ImageOptimizerService) {}

  /**
   * Extrait le texte d'une image en utilisant Tesseract.js
   */
  async extractText(
    imageBuffer: Buffer,
    options?: OcrOptions,
  ): Promise<OcrResult> {
    const startTime = Date.now();
    let worker: Worker | null = null;

    try {
      // Configuration par défaut optimisée pour les tickets de caisse français
      const language = (options?.language as string) || 'fra';
      const pageSegmentationMode =
        options?.pageSegmentationMode || PageSegmentationMode.AUTO;
      const ocrEngineMode = options?.ocrEngineMode || OcrEngineMode.LSTM_ONLY;

      const config = {
        language,
        pageSegmentationMode,
        ocrEngineMode,
        variables: {
          // Variables Tesseract optimisées pour tickets
          tessedit_char_whitelist:
            '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜÝàáâäçèéêëìíîïñòóôöùúûüý€£$%.,:/- ',
          tessedit_pageseg_mode: pageSegmentationMode.toString(),
          tessedit_ocr_engine_mode: ocrEngineMode.toString(),
          ...options?.variables,
        },
      };

      this.logger.debug(
        `Initialisation worker Tesseract avec langue: ${config.language}`,
      );

      // Création et initialisation du worker
      worker = await createWorker();
      await worker.loadLanguage(config.language);
      await worker.initialize(config.language);

      // Configuration des paramètres Tesseract
      await worker.setParameters({
        tessedit_char_whitelist: config.variables.tessedit_char_whitelist,
      });

      // Prétraitement de l'image pour optimiser l'OCR
      const optimizedImage =
        await this.imageOptimizer.preprocessReceiptImage(imageBuffer);

      this.logger.debug('Début de la reconnaissance OCR');

      // Reconnaissance OCR
      const result = await worker.recognize(optimizedImage);

      const processingTime = Date.now() - startTime;
      this.logger.debug(
        `OCR terminé en ${processingTime}ms avec confiance: ${result.data.confidence}%`,
      );

      // Conversion au format standardisé
      return this.convertTesseractResult(result.data, processingTime);
    } catch (error: unknown) {
      const err = error as Error;
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `Erreur lors de l'OCR Tesseract: ${err.message}`,
        err.stack,
      );

      // Retourner un résultat vide en cas d'erreur
      return {
        text: '',
        confidence: 0,
        lines: [],
        words: [],
        processingTime,
      };
    } finally {
      // Nettoyage du worker
      if (worker) {
        try {
          await worker.terminate();
        } catch (terminateError: unknown) {
          const err = terminateError as Error;
          this.logger.warn(
            `Erreur lors de la fermeture du worker: ${err.message}`,
          );
        }
      }
    }
  }

  /**
   * Reconnaissance avec plusieurs variants d'images pour améliorer la précision
   */
  async extractTextWithVariants(
    imageBuffer: Buffer,
    options?: OcrOptions,
  ): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      // Création de plusieurs versions optimisées de l'image
      const variants =
        await this.imageOptimizer.createOptimizedVariants(imageBuffer);

      this.logger.debug("Tentative OCR avec 3 variants d'image");

      // Reconnaissance sur chaque variant
      const results = await Promise.allSettled([
        this.extractText(variants.standard, options),
        this.extractText(variants.highContrast, {
          ...options,
          pageSegmentationMode: PageSegmentationMode.SINGLE_BLOCK,
        }),
        this.extractText(variants.denoised, {
          ...options,
          pageSegmentationMode: PageSegmentationMode.SPARSE_TEXT,
        }),
      ]);

      // Sélection du meilleur résultat
      const validResults = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
        .filter((result) => result.confidence > 0);

      if (validResults.length === 0) {
        throw new Error('Aucun résultat OCR valide obtenu');
      }

      // Retourner le résultat avec la meilleure confiance
      const bestResult = validResults.reduce((best, current) =>
        current.confidence > best.confidence ? current : best,
      );

      bestResult.processingTime = Date.now() - startTime;

      this.logger.debug(
        `Meilleur résultat OCR: confiance ${bestResult.confidence}, texte: ${bestResult.text.substring(0, 100)}...`,
      );

      return bestResult;
    } catch (error) {
      this.logger.error(`Erreur lors de l'OCR avec variants: ${error.message}`);

      return {
        text: '',
        confidence: 0,
        lines: [],
        words: [],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Convertit le résultat Tesseract au format standardisé
   */
  private convertTesseractResult(
    tesseractData: any,
    processingTime: number,
  ): OcrResult {
    const lines: OcrLine[] = [];
    const allWords: OcrWord[] = [];

    // Traitement des blocs, paragraphes et lignes
    if (tesseractData.blocks) {
      for (const block of tesseractData.blocks) {
        if (block.paragraphs) {
          for (const paragraph of block.paragraphs) {
            if (paragraph.lines) {
              for (const line of paragraph.lines) {
                const lineWords: OcrWord[] = [];

                if (line.words) {
                  for (const word of line.words) {
                    if (word.text.trim()) {
                      const ocrWord: OcrWord = {
                        text: word.text,
                        confidence: word.confidence / 100, // Conversion 0-100 vers 0-1
                        bbox: word.bbox
                          ? {
                              x0: word.bbox.x0,
                              y0: word.bbox.y0,
                              x1: word.bbox.x1,
                              y1: word.bbox.y1,
                            }
                          : undefined,
                      };

                      lineWords.push(ocrWord);
                      allWords.push(ocrWord);
                    }
                  }
                }

                if (line.text.trim() && lineWords.length > 0) {
                  lines.push({
                    text: line.text,
                    confidence: line.confidence / 100,
                    bbox: line.bbox
                      ? {
                          x0: line.bbox.x0,
                          y0: line.bbox.y0,
                          x1: line.bbox.x1,
                          y1: line.bbox.y1,
                        }
                      : undefined,
                    words: lineWords,
                  });
                }
              }
            }
          }
        }
      }
    }

    return {
      text: tesseractData.text || '',
      confidence: (tesseractData.confidence || 0) / 100, // Conversion 0-100 vers 0-1
      lines,
      words: allWords,
      processingTime,
    };
  }

  /**
   * Configuration spéciale pour les tickets de caisse français
   */
  private getReceiptOptimizedConfig(): OcrOptions {
    return {
      language: 'fra',
      pageSegmentationMode: PageSegmentationMode.SINGLE_BLOCK_VERT_TEXT,
      ocrEngineMode: OcrEngineMode.LSTM_ONLY,
      variables: {
        // Optimisations spécifiques aux tickets
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜÝàáâäçèéêëìíîïñòóôöùúûüý€.,:/- *x',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
        tessedit_enable_dict_correction: '1',
      },
    };
  }

  /**
   * Test de la disponibilité de Tesseract
   */
  async isAvailable(): Promise<boolean> {
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      await worker.terminate();
      return true;
    } catch (error) {
      this.logger.error(`Tesseract non disponible: ${error.message}`);
      return false;
    }
  }
}
