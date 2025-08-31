import { Test, TestingModule } from '@nestjs/testing';
import { UnitConversionService } from './unit-conversion.service';
import { MassUnit, VolumeUnit, PieceUnit, Unit } from './unit.enums';

describe('UnitConversionService', () => {
  let service: UnitConversionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitConversionService],
    }).compile();

    service = module.get<UnitConversionService>(UnitConversionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateTotalQuantity', () => {
    it('should calculate total quantity for simple product', () => {
      const result = service.calculateTotalQuantity(2, PieceUnit.PIECE, 100);

      expect(result.totalQuantity).toBe(200); // 2 * 100
      expect(result.displayQuantity).toBe(200);
      expect(result.baseUnit).toBe(PieceUnit.PIECE);
      expect(result.displayUnit).toBe(PieceUnit.PIECE);
    });

    it('should calculate total quantity for multi-pack product', () => {
      const result = service.calculateTotalQuantity(
        2, // 2 packs
        VolumeUnit.ML,
        500, // 500ml per unit
        6, // 6 units per pack
      );

      expect(result.totalQuantity).toBe(6000); // 2 * 6 * 500
      expect(result.displayQuantity).toBe(6000);
      expect(result.baseUnit).toBe(VolumeUnit.ML);
    });

    it('should handle product without packaging info', () => {
      const result = service.calculateTotalQuantity(5, MassUnit.G);

      expect(result.totalQuantity).toBe(5);
      expect(result.displayQuantity).toBe(5);
      expect(result.baseUnit).toBe(MassUnit.G);
    });

    it('should calculate for unit size only (no packaging)', () => {
      const result = service.calculateTotalQuantity(3, MassUnit.KG, 250);

      expect(result.totalQuantity).toBe(750); // 3 * 250
      expect(result.displayQuantity).toBe(750);
      expect(result.baseUnit).toBe(MassUnit.KG);
    });
  });

  describe('convert', () => {
    it('should convert between mass units', () => {
      const result = service.convert(1, MassUnit.KG, MassUnit.G);
      expect(result).toBe(1000);
    });

    it('should convert between volume units', () => {
      const result = service.convert(1, VolumeUnit.L, VolumeUnit.ML);
      expect(result).toBe(1000);
    });

    it('should convert imperial to metric mass', () => {
      const result = service.convert(1, MassUnit.LB, MassUnit.G);
      expect(result).toBeCloseTo(453.592);
    });

    it('should convert imperial to metric volume', () => {
      const result = service.convert(1, VolumeUnit.CUP, VolumeUnit.ML);
      expect(result).toBeCloseTo(236.588);
    });

    it('should return same value for same units', () => {
      const result = service.convert(5, MassUnit.G, MassUnit.G);
      expect(result).toBe(5);
    });

    it('should return null for incompatible unit types', () => {
      const result = service.convert(1, MassUnit.G, VolumeUnit.ML);
      expect(result).toBeNull();
    });

    it('should return null for piece to other unit conversions', () => {
      const result = service.convert(1, PieceUnit.PIECE, MassUnit.G);
      expect(result).toBeNull();
    });
  });

  describe('hasEnoughQuantity', () => {
    it('should return true when stock is sufficient', () => {
      const result = service.hasEnoughQuantity(
        1000, // 1kg stock
        MassUnit.KG,
        500, // need 500g
        MassUnit.G,
      );
      expect(result).toBe(true);
    });

    it('should return false when stock is insufficient', () => {
      const result = service.hasEnoughQuantity(
        100, // 100g stock
        MassUnit.G,
        1, // need 1kg
        MassUnit.KG,
      );
      expect(result).toBe(false);
    });

    it('should handle same unit comparison', () => {
      const result = service.hasEnoughQuantity(
        5,
        PieceUnit.PIECE,
        3,
        PieceUnit.PIECE,
      );
      expect(result).toBe(true);
    });

    it('should return false for incompatible units', () => {
      const result = service.hasEnoughQuantity(
        100,
        MassUnit.G,
        1,
        VolumeUnit.ML,
      );
      expect(result).toBe(false);
    });

    it('should handle volume conversions', () => {
      const result = service.hasEnoughQuantity(
        2, // 2L stock
        VolumeUnit.L,
        1500, // need 1500ml
        VolumeUnit.ML,
      );
      expect(result).toBe(true);
    });
  });

  describe('subtractQuantity', () => {
    it('should subtract quantity correctly with conversion', () => {
      const result = service.subtractQuantity(
        2, // 2kg stock
        MassUnit.KG,
        500, // use 500g
        MassUnit.G,
      );
      expect(result).toBe(1.5); // 2kg - 0.5kg = 1.5kg
    });

    it('should return null when subtraction results in negative', () => {
      const result = service.subtractQuantity(
        100, // 100g stock
        MassUnit.G,
        2, // use 2kg
        MassUnit.KG,
      );
      expect(result).toBeNull();
    });

    it('should handle same unit subtraction', () => {
      const result = service.subtractQuantity(
        10,
        PieceUnit.PIECE,
        3,
        PieceUnit.PIECE,
      );
      expect(result).toBe(7);
    });

    it('should return null for incompatible units', () => {
      const result = service.subtractQuantity(
        100,
        MassUnit.G,
        50,
        VolumeUnit.ML,
      );
      expect(result).toBeNull();
    });

    it('should handle exact subtraction to zero', () => {
      const result = service.subtractQuantity(1, MassUnit.KG, 1000, MassUnit.G);
      expect(result).toBe(0);
    });
  });

  describe('formatQuantityDisplay', () => {
    it('should format simple quantity', () => {
      const result = service.formatQuantityDisplay(5, MassUnit.G);
      expect(result).toBe('5 g');
    });

    it('should format packaging info', () => {
      const result = service.formatQuantityDisplay(2, VolumeUnit.L, {
        packagingSize: 6,
        unitSize: 0.5,
      });
      expect(result).toBe('2 packs (12 unités, 6l au total)');
    });

    it('should handle singular pack', () => {
      const result = service.formatQuantityDisplay(1, VolumeUnit.ML, {
        packagingSize: 4,
        unitSize: 250,
      });
      expect(result).toBe('1 pack (4 unités, 1000ml au total)');
    });

    it('should format without packaging info', () => {
      const result = service.formatQuantityDisplay(3.5, MassUnit.KG);
      expect(result).toBe('3.5 kg');
    });
  });

  describe('getBaseUnit', () => {
    it('should return base unit for mass', () => {
      expect(service.getBaseUnit(MassUnit.KG)).toBe(MassUnit.G);
      expect(service.getBaseUnit(MassUnit.LB)).toBe(MassUnit.G);
    });

    it('should return base unit for volume', () => {
      expect(service.getBaseUnit(VolumeUnit.L)).toBe(VolumeUnit.ML);
      expect(service.getBaseUnit(VolumeUnit.CUP)).toBe(VolumeUnit.ML);
    });

    it('should return base unit for pieces', () => {
      expect(service.getBaseUnit(PieceUnit.PIECE)).toBe(PieceUnit.PIECE);
      expect(service.getBaseUnit(PieceUnit.UNIT)).toBe(PieceUnit.PIECE);
    });
  });

  describe('normalize', () => {
    it('should normalize mass to grams', () => {
      const result = service.normalize(2, MassUnit.KG);
      expect(result.value).toBe(2000);
      expect(result.unit).toBe(MassUnit.G);
    });

    it('should normalize volume to milliliters', () => {
      const result = service.normalize(1.5, VolumeUnit.L);
      expect(result.value).toBe(1500);
      expect(result.unit).toBe(VolumeUnit.ML);
    });

    it('should normalize pieces to pieces', () => {
      const result = service.normalize(5, PieceUnit.UNIT);
      expect(result.value).toBe(5);
      expect(result.unit).toBe(PieceUnit.PIECE);
    });

    it('should handle already normalized units', () => {
      const result = service.normalize(100, MassUnit.G);
      expect(result.value).toBe(100);
      expect(result.unit).toBe(MassUnit.G);
    });

    it('should handle imperial units', () => {
      const result = service.normalize(1, MassUnit.OZ);
      expect(result.value).toBeCloseTo(28.3495);
      expect(result.unit).toBe(MassUnit.G);
    });
  });
});
