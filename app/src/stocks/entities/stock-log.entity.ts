import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Stock } from './stock.entity';
import { User } from '../../users/entity/user.entity';

export enum StockLogAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  USE = 'use',
  EXPIRE = 'expire',
  WASTE = 'waste',
  SAVE = 'save',
  CONSUME = 'consume',
}

@Entity('stock_logs')
export class StockLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: StockLogAction,
    default: StockLogAction.CREATE,
  })
  action: StockLogAction;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantityBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantityAfter: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantityUsed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantityWasted: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantitySaved: number;

  @Column({ type: 'date', nullable: true })
  dlcBefore: Date;

  @Column({ type: 'date', nullable: true })
  dlcAfter: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
