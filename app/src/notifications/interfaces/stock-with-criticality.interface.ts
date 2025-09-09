import { Stock } from '../../stocks/entities/stock.entity';

export type StockCriticality =
  | 'expired'
  | 'critical'
  | 'urgent'
  | 'warning'
  | 'normal';

export interface StockWithCriticality extends Stock {
  daysUntilExpiry: number;
  criticality: StockCriticality;
}
