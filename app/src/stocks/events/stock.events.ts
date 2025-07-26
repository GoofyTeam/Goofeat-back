import { Stock } from '../entities/stock.entity';

export class StockCreatedEvent {
  constructor(public readonly stock: Stock) {}
}

export class StockUpdatedEvent {
  constructor(
    public readonly stock: Stock,
    public readonly previousDlc?: Date,
  ) {}
}

export class StockDeletedEvent {
  constructor(public readonly stockId: string) {}
}

export class StockExpirationWarningEvent {
  constructor(
    public readonly stock: Stock,
    public readonly daysUntilExpiration: number,
  ) {}
}
