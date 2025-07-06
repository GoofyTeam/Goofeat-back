/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, Injectable } from '@nestjs/common';
import * as convert from 'convert-units';
import { MassUnit, PieceUnit, Unit, VolumeUnit } from './unit.enums';

@Injectable()
export class UnitConversionService {
  private isMassUnit(unit: Unit): unit is MassUnit {
    return Object.values(MassUnit).includes(unit as MassUnit);
  }

  private isVolumeUnit(unit: Unit): unit is VolumeUnit {
    return Object.values(VolumeUnit).includes(unit as VolumeUnit);
  }

  private isPieceUnit(unit: Unit): unit is PieceUnit {
    return Object.values(PieceUnit).includes(unit as PieceUnit);
  }

  convert(value: number, from: Unit, to: Unit): number {
    if (from === to) {
      return value;
    }

    const fromIsMass = this.isMassUnit(from);
    const toIsMass = this.isMassUnit(to);
    const fromIsVolume = this.isVolumeUnit(from);
    const toIsVolume = this.isVolumeUnit(to);
    const fromIsPiece = this.isPieceUnit(from);
    const toIsPiece = this.isPieceUnit(to);

    if (
      (fromIsMass && toIsMass) ||
      (fromIsVolume && toIsVolume) ||
      (fromIsPiece && toIsPiece)
    ) {
      try {
        // The library uses 'Tbs' for tablespoon, ensure consistency
        const fromUnit = from === Unit.TBSP ? 'Tbs' : from;
        const toUnit = to === Unit.TBSP ? 'Tbs' : to;

        return convert(value)
          .from(fromUnit as any)
          .to(toUnit as any);
      } catch (e) {
        throw new BadRequestException(
          `Conversion from ${from} to ${to} failed.`,
        );
      }
    }

    throw new BadRequestException(
      `Incompatible unit conversion from ${from} to ${to}.`,
    );
  }

  normalizeToGrams(value: number, unit: Unit): number {
    if (this.isMassUnit(unit)) {
      return this.convert(value, unit, MassUnit.G);
    }
    // Handle cases where conversion isn't possible (e.g., volume to mass without density)
    throw new BadRequestException(`Cannot normalize ${unit} to grams.`);
  }

  normalizeToMilliliters(value: number, unit: Unit): number {
    if (this.isVolumeUnit(unit)) {
      return this.convert(value, unit, VolumeUnit.ML);
    }
    throw new BadRequestException(`Cannot normalize ${unit} to milliliters.`);
  }

  /**
   * Normalizes a value to its base unit (g, ml, or piece).
   * @param value The value to normalize.
   * @param unit The unit of the value.
   * @returns An object with the normalized value and its base unit.
   */
  normalize(value: number, unit: Unit): { value: number; unit: Unit } {
    if (!unit || this.isPieceUnit(unit)) {
      return { value, unit: PieceUnit.PIECE };
    }

    if (this.isMassUnit(unit)) {
      return {
        value: this.normalizeToGrams(value, unit),
        unit: MassUnit.G,
      };
    }

    if (this.isVolumeUnit(unit)) {
      return {
        value: this.normalizeToMilliliters(value, unit),
        unit: VolumeUnit.ML,
      };
    }

    throw new BadRequestException(
      `Unsupported unit for normalization: ${unit as string}`,
    );
  }
}
