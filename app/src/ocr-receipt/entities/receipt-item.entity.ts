import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Receipt } from './receipt.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('receipt_items')
export class ReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Receipt, (receipt) => receipt.items)
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt;

  @Column({ name: 'receipt_id' })
  receiptId: string;

  @Column({ name: 'raw_text' })
  rawText: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    default: 1,
  })
  quantity: number;

  @Column({ nullable: true, default: 'pcs' })
  unit: string;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  unitPrice?: number;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  totalPrice: number;

  @Column({ name: 'product_code', nullable: true })
  productCode?: string;

  @Column({
    name: 'confidence',
    type: 'float',
    default: 0,
  })
  confidence: number;

  @Column({ name: 'line_number' })
  lineNumber: number;

  @Column({ name: 'linked_product_id', type: 'uuid', nullable: true })
  linkedProductId?: string;

  @Column({
    name: 'confirmed_quantity',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  confirmedQuantity?: number;
}
