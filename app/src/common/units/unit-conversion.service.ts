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

    if (packagingSize && unitSize) {
      totalQuantity = quantity * packagingSize * unitSize;
      displayQuantity = totalQuantity;

      baseUnit = unit;
      displayUnit = baseUnit;
    } else if (unitSize && !packagingSize) {
      totalQuantity = quantity * unitSize;
      displayQuantity = totalQuantity;
      baseUnit = unit;
    }

    return {
      totalQuantity,
      displayQuantity,
      baseUnit,
      displayUnit,
    };
  }

  convert(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
    if (fromUnit === toUnit) {
      return quantity;
    }

    if (this.isMassUnit(fromUnit) && this.isMassUnit(toUnit)) {
      const grams = quantity * this.massToGrams[fromUnit as MassUnit];
      return grams / this.massToGrams[toUnit as MassUnit];
    }

    if (this.isVolumeUnit(fromUnit) && this.isVolumeUnit(toUnit)) {
      const ml = quantity * this.volumeToMl[fromUnit as VolumeUnit];
      return ml / this.volumeToMl[toUnit as VolumeUnit];
    }

    return null;
  }

  hasEnoughQuantity(
    stockQuantity: number,
    stockUnit: Unit,
    requiredQuantity: number,
    requiredUnit: Unit,
  ): boolean {
    const convertedStock = this.convert(stockQuantity, stockUnit, requiredUnit);

    if (convertedStock !== null) {
      return convertedStock >= requiredQuantity;
    }

    if (stockUnit === requiredUnit) {
      return stockQuantity >= requiredQuantity;
    }

    return false;
  }

  subtractQuantity(
    stockQuantity: number,
    stockUnit: Unit,
    usedQuantity: number,
    usedUnit: Unit,
  ): number | null {
    const convertedUsed = this.convert(usedQuantity, usedUnit, stockUnit);

    if (convertedUsed !== null) {
      const remaining = stockQuantity - convertedUsed;
      return remaining >= 0 ? remaining : null;
    }

    if (stockUnit === usedUnit) {
      const remaining = stockQuantity - usedQuantity;
      return remaining >= 0 ? remaining : null;
    }

    return null;
  }

  formatQuantityDisplay(
    quantity: number,
    unit: Unit,
    packagingInfo?: { unitSize?: number; packagingSize?: number },
  ): string {
    if (packagingInfo?.packagingSize && packagingInfo?.unitSize) {
      const totalUnits = quantity * packagingInfo.packagingSize;
      const totalVolume = totalUnits * packagingInfo.unitSize;

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

  getBaseUnit(unit: Unit): Unit {
    if (this.isMassUnit(unit)) return MassUnit.G;
    if (this.isVolumeUnit(unit)) return VolumeUnit.ML;
    return PieceUnit.PIECE;
  }

  normalize(quantity: number, unit: Unit): { value: number; unit: Unit } {
    const baseUnit = this.getBaseUnit(unit);
    const convertedQuantity = this.convert(quantity, unit, baseUnit);

    return {
      value: convertedQuantity ?? quantity,
      unit: baseUnit,
    };
  }
}
