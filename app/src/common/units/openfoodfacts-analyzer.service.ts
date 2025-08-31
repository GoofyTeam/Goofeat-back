/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { MassUnit, PieceUnit, Unit, VolumeUnit } from './unit.enums';

export interface PackagingInfo {
  totalQuantity: number; // Quantité totale du produit (ex: 1 pour 1L, 6 pour pack de 6)
  totalUnit: Unit; // Unité totale (l, kg, piece)
  packagingSize?: number; // Nombre d'unités dans le pack (ex: 6 briques)
  unitSize?: number; // Taille d'une unité (ex: 1L par brique)
  unitSizeUnit?: Unit; // Unité d'une unité individuelle
  isMultipack: boolean; // Est-ce un pack multiple ?
}

@Injectable()
export class OpenFoodFactsAnalyzerService {
  /**
   * Analyse la quantité OpenFoodFacts et détecte les packs multiples
   * Exemples :
   * - "1 l" → quantité simple: 1L
   * - "6 x 1 l" → pack: 6 briques de 1L chacune
   * - "4 x 250 ml" → pack: 4 bouteilles de 250ml chacune
   * - "12 x 33 cl" → pack: 12 canettes de 33cl chacune
   */
  analyzeQuantity(quantity: string | null | undefined): PackagingInfo | null {
    if (!quantity || typeof quantity !== 'string') {
      return null;
    }

    const cleanQuantity = quantity.toLowerCase().trim();

    // Pattern pour détecter les packs multiples: "6 x 1 l", "4 × 250 ml", etc.
    const multipackPattern =
      /^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)$/i;
    const multipackMatch = cleanQuantity.match(multipackPattern);

    if (multipackMatch) {
      const [, packSizeStr, unitSizeStr, unitStr] = multipackMatch;
      const packSize = parseFloat(packSizeStr.replace(',', '.'));
      const unitSize = parseFloat(unitSizeStr.replace(',', '.'));
      const unit = this.mapStringToUnit(unitStr);

      if (unit && !isNaN(packSize) && !isNaN(unitSize)) {
        const totalQuantity = packSize * unitSize;

        return {
          totalQuantity,
          totalUnit: unit,
          packagingSize: packSize,
          unitSize,
          unitSizeUnit: unit,
          isMultipack: true,
        };
      }
    }

    // Pattern pour quantité simple: "1 l", "500 g", "330 ml"
    const simplePattern = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)$/i;
    const simpleMatch = cleanQuantity.match(simplePattern);

    if (simpleMatch) {
      const [, quantityStr, unitStr] = simpleMatch;
      const quantityValue = parseFloat(quantityStr.replace(',', '.'));
      const unit = this.mapStringToUnit(unitStr);

      if (unit && !isNaN(quantityValue)) {
        return {
          totalQuantity: quantityValue,
          totalUnit: unit,
          isMultipack: false,
        };
      }
    }

    // Pattern pour détections spéciales
    return this.analyzeSpecialPatterns(cleanQuantity);
  }

  private analyzeSpecialPatterns(quantity: string): PackagingInfo | null {
    // Patterns spéciaux pour des formats courants
    const patterns = [
      // "Pack de 6 bouteilles 1L" → pack de 6 x 1L
      /pack\s+de\s+(\d+).*?(\d+(?:[.,]\d+)?)\s*([a-z]+)/i,
      // "6 bouteilles de 1L"
      /(\d+)\s+bouteilles?\s+de\s+(\d+(?:[.,]\d+)?)\s*([a-z]+)/i,
      // "6 briques 1L"
      /(\d+)\s+briques?\s+(\d+(?:[.,]\d+)?)\s*([a-z]+)/i,
      // "Lot de 4 x 250ml"
      /lot\s+de\s+(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)/i,
    ];

    for (const pattern of patterns) {
      const match = quantity.match(pattern);
      if (match) {
        const [, packSizeStr, unitSizeStr, unitStr] = match;
        const packSize = parseInt(packSizeStr, 10);
        const unitSize = parseFloat(unitSizeStr.replace(',', '.'));
        const unit = this.mapStringToUnit(unitStr);

        if (unit && !isNaN(packSize) && !isNaN(unitSize)) {
          return {
            totalQuantity: packSize * unitSize,
            totalUnit: unit,
            packagingSize: packSize,
            unitSize,
            unitSizeUnit: unit,
            isMultipack: true,
          };
        }
      }
    }

    return null;
  }

  private mapStringToUnit(unitStr: string): Unit | null {
    const normalized = unitStr.toLowerCase().trim();

    // Mapping des unités communes
    const unitMappings: Record<string, Unit> = {
      // Volume
      l: VolumeUnit.L,
      litre: VolumeUnit.L,
      litres: VolumeUnit.L,
      ml: VolumeUnit.ML,
      millilitre: VolumeUnit.ML,
      millilitres: VolumeUnit.ML,
      cl: VolumeUnit.ML, // Converti en ML (1cl = 10ml)
      centilitre: VolumeUnit.ML,
      centilitres: VolumeUnit.ML,

      // Masse
      g: MassUnit.G,
      gramme: MassUnit.G,
      grammes: MassUnit.G,
      kg: MassUnit.KG,
      kilo: MassUnit.KG,
      kilogramme: MassUnit.KG,
      kilogrammes: MassUnit.KG,
      mg: MassUnit.MG,

      // Pièces
      piece: PieceUnit.PIECE,
      pieces: PieceUnit.PIECE,
      pièce: PieceUnit.PIECE,
      pièces: PieceUnit.PIECE,
      unit: PieceUnit.UNIT,
      unité: PieceUnit.UNIT,
      unités: PieceUnit.UNIT,
    };

    let mappedUnit = unitMappings[normalized];

    // Conversion spéciale pour centilitres
    if (normalized === 'cl' || normalized.includes('centilitre')) {
      mappedUnit = VolumeUnit.ML; // On stocke en ML
    }

    return mappedUnit || null;
  }

  /**
   * Analyse les champs OpenFoodFacts pour extraire des infos de packaging
   */
  analyzeOpenFoodFactsProduct(product: any): PackagingInfo | null {
    // Priorité aux champs spécifiques
    if (product.quantity) {
      const quantityInfo = this.analyzeQuantity(product.quantity);
      if (quantityInfo) {
        return quantityInfo;
      }
    }

    // Fallback sur d'autres champs
    const fieldsToCheck = [
      'product_quantity',
      'net_weight',
      'serving_size',
      'packaging',
    ];

    for (const field of fieldsToCheck) {
      if (product[field]) {
        const info = this.analyzeQuantity(product[field]);
        if (info) {
          return info;
        }
      }
    }

    return null;
  }

  /**
   * Convertit les centilitres en millilitres si nécessaire
   */
  normalizeQuantity(
    quantity: number,
    unit: Unit,
  ): { quantity: number; unit: Unit } {
    // Conversion cl → ml
    if (unit === VolumeUnit.ML && quantity < 10) {
      // Si c'est probablement des cl (ex: 33cl stocké comme 33ml)
      // On peut détecter ça avec des heuristiques
      return { quantity: quantity * 10, unit: VolumeUnit.ML };
    }

    return { quantity, unit };
  }
}
