export enum MassUnit {
  MCG = 'mcg',
  MG = 'mg',
  G = 'g',
  KG = 'kg',
  OZ = 'oz',
  LB = 'lb',
}

export enum VolumeUnit {
  MM3 = 'mm3',
  CM3 = 'cm3',
  ML = 'ml',
  L = 'l',
  M3 = 'm3',
  KM3 = 'km3',
  TSP = 'tsp',
  TBSP = 'Tbs',
  FL_OZ = 'fl-oz',
  CUP = 'cup',
  PNT = 'pnt',
  QT = 'qt',
  GAL = 'gal',
}

export enum PieceUnit {
  PIECE = 'piece',
  UNIT = 'unit',
}

export const Unit = { ...MassUnit, ...VolumeUnit, ...PieceUnit };
export type Unit = MassUnit | VolumeUnit | PieceUnit;

export const AllUnits = [
  ...Object.values(MassUnit),
  ...Object.values(VolumeUnit),
  ...Object.values(PieceUnit),
];
