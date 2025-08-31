import { Injectable } from '@nestjs/common';
import { MassUnit, PieceUnit, Unit, VolumeUnit } from './unit.enums';

export interface ConversionResult {
  totalQuantity: number;
  displayQuantity: number;
  baseUnit: Unit;
  displayUnit: Unit;
}

@Injectable()
export class UnitConversionService {
  // Facteurs de conversion vers l'unité de base (grammes pour la masse, millilitres pour le volume)
  private readonly massToGrams: Record<MassUnit, number> = {
    [MassUnit.MCG]: 0.000001,
    [MassUnit.MG]: 0.001,
    [MassUnit.G]: 1,
    [MassUnit.KG]: 1000,
    [MassUnit.OZ]: 28.3495,
    [MassUnit.LB]: 453.592,
  };

  private readonly volumeToMl: Record<VolumeUnit, number> = {
    [VolumeUnit.MM3]: 0.001,
    [VolumeUnit.CM3]: 1,
    [VolumeUnit.ML]: 1,
    [VolumeUnit.L]: 1000,
    [VolumeUnit.M3]: 1000000,
    [VolumeUnit.KM3]: 1000000000000,
    [VolumeUnit.TSP]: 4.92892,
    [VolumeUnit.TBSP]: 14.7868,
    [VolumeUnit.FL_OZ]: 29.5735,
    [VolumeUnit.CUP]: 236.588,
    [VolumeUnit.PNT]: 473.176,
    [VolumeUnit.QT]: 946.353,
    [VolumeUnit.GAL]: 3785.41,
  };

  /**
   * Calcule la quantité totale réelle en stock
   * @param quantity Quantité (peut être un nombre de packs)
   * @param unit Unité de la quantité
   * @param unitSize Taille d'une unité individuelle (ex: 1L pour une brique de lait)
   * @param packagingSize Nombre d'unités dans un pack (ex: 6 pour un pack de 6 briques)
   * @returns La quantité totale avec l'unité appropriée
   */
  calculateTotalQuantity(
    quantity: number,
    unit: Unit,
    unitSize?: number,
    packagingSize?: number,
  ): ConversionResult {
    let totalQuantity = quantity;
    let baseUnit = unit;
    let displayUnit = unit;
    let displayQuantity = quantity;

    // Si on a des informations de packaging
    if (packagingSize && unitSize) {
      // La quantité représente le nombre de packs
      // Total = nombre de packs × taille du pack × taille de l'unité
      totalQuantity = quantity * packagingSize * unitSize;
      displayQuantity = totalQuantity;

      // Pour un pack de 6 briques de 1L:
      // quantity = 1 (pack), packagingSize = 6, unitSize = 1
      // totalQuantity = 6, baseUnit = 'l' (l'unité réelle du contenu)

      // L'unité de base est celle spécifiée par le produit (defaultUnit)
      // qui provient maintenant d'OpenFoodFacts et est plus fiable
      baseUnit = unit;
      displayUnit = baseUnit;
    } else if (unitSize && !packagingSize) {
      // Cas simple: quantité × taille de l'unité
      totalQuantity = quantity * unitSize;
      displayQuantity = totalQuantity;
      baseUnit = unit; // L'unité reste la même
    }

    return {
      totalQuantity,
      displayQuantity,
      baseUnit,
      displayUnit,
    };
  }

  /**
   * Convertit une quantité d'une unité à une autre
   * @param quantity Quantité à convertir
   * @param fromUnit Unité source
   * @param toUnit Unité cible
   * @returns Quantité convertie ou null si conversion impossible
   */
  convert(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
    // Même unité, pas de conversion
    if (fromUnit === toUnit) {
      return quantity;
    }

    // Conversion entre unités de masse
    if (this.isMassUnit(fromUnit) && this.isMassUnit(toUnit)) {
      const grams = quantity * this.massToGrams[fromUnit as MassUnit];
      return grams / this.massToGrams[toUnit as MassUnit];
    }

    // Conversion entre unités de volume
    if (this.isVolumeUnit(fromUnit) && this.isVolumeUnit(toUnit)) {
      const ml = quantity * this.volumeToMl[fromUnit as VolumeUnit];
      return ml / this.volumeToMl[toUnit as VolumeUnit];
    }

    // Pas de conversion possible entre types différents (masse/volume/pièce)
    return null;
  }

  /**
   * Calcule la quantité disponible pour une recette
   * @param stockQuantity Quantité en stock
   * @param stockUnit Unité du stock
   * @param requiredQuantity Quantité requise par la recette
   * @param requiredUnit Unité requise par la recette
   * @returns true si suffisant, false sinon
   */
  hasEnoughQuantity(
    stockQuantity: number,
    stockUnit: Unit,
    requiredQuantity: number,
    requiredUnit: Unit,
  ): boolean {
    // Si les unités sont compatibles, on convertit
    const convertedStock = this.convert(stockQuantity, stockUnit, requiredUnit);

    if (convertedStock !== null) {
      return convertedStock >= requiredQuantity;
    }

    // Si conversion impossible, on compare directement si mêmes unités
    if (stockUnit === requiredUnit) {
      return stockQuantity >= requiredQuantity;
    }

    // Pas de comparaison possible
    return false;
  }

  /**
   * Soustrait une quantité du stock en tenant compte des conversions
   * @param stockQuantity Quantité en stock
   * @param stockUnit Unité du stock
   * @param usedQuantity Quantité utilisée
   * @param usedUnit Unité utilisée
   * @returns Nouvelle quantité en stock ou null si soustraction impossible
   */
  subtractQuantity(
    stockQuantity: number,
    stockUnit: Unit,
    usedQuantity: number,
    usedUnit: Unit,
  ): number | null {
    // Convertir la quantité utilisée vers l'unité du stock
    const convertedUsed = this.convert(usedQuantity, usedUnit, stockUnit);

    if (convertedUsed !== null) {
      const remaining = stockQuantity - convertedUsed;
      return remaining >= 0 ? remaining : null;
    }

    // Si même unité sans conversion
    if (stockUnit === usedUnit) {
      const remaining = stockQuantity - usedQuantity;
      return remaining >= 0 ? remaining : null;
    }

    return null;
  }

  /**
   * Formatte une quantité avec son unité pour l'affichage
   * @param quantity Quantité
   * @param unit Unité
   * @param packagingInfo Informations de packaging optionnelles
   * @returns Chaîne formatée pour l'affichage
   */
  formatQuantityDisplay(
    quantity: number,
    unit: Unit,
    packagingInfo?: { unitSize?: number; packagingSize?: number },
  ): string {
    if (packagingInfo?.packagingSize && packagingInfo?.unitSize) {
      const totalUnits = quantity * packagingInfo.packagingSize;
      const totalVolume = totalUnits * packagingInfo.unitSize;

      // Ex: "2 packs (12 unités, 12L au total)"
      return `${quantity} pack${quantity > 1 ? 's' : ''} (${totalUnits} unités, ${totalVolume}${unit} au total)`;
    }

    return `${quantity} ${unit}`;
  }

  private isMassUnit(unit: Unit): boolean {
    return Object.values(MassUnit).includes(unit as MassUnit);
  }

  private isVolumeUnit(unit: Unit): boolean {
    return Object.values(VolumeUnit).includes(unit as VolumeUnit);
  }

  private isPieceUnit(unit: Unit): boolean {
    return Object.values(PieceUnit).includes(unit as PieceUnit);
  }

  /**
   * Obtient l'unité de base recommandée pour un type d'unité
   * @param unit Unité source
   * @returns Unité de base (g pour masse, ml pour volume, piece pour pièces)
   */
  getBaseUnit(unit: Unit): Unit {
    if (this.isMassUnit(unit)) return MassUnit.G;
    if (this.isVolumeUnit(unit)) return VolumeUnit.ML;
    return PieceUnit.PIECE;
  }

  /**
   * Normalise une quantité vers son unité de base
   * @param quantity Quantité à normaliser
   * @param unit Unité actuelle
   * @returns Objet contenant la valeur normalisée et l'unité de base
   */
  normalize(quantity: number, unit: Unit): { value: number; unit: Unit } {
    const baseUnit = this.getBaseUnit(unit);
    const convertedQuantity = this.convert(quantity, unit, baseUnit);

    return {
      value: convertedQuantity !== null ? convertedQuantity : quantity,
      unit: baseUnit,
    };
  }
}
