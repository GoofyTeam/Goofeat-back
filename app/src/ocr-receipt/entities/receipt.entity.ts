import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { ReceiptItem } from './receipt-item.entity';

export enum ReceiptStatus {
  PROCESSING = 'processing',
  PENDING = 'pending',
  REVIEW = 'review',
  CONFIRMED = 'confirmed',
  ERROR = 'error',
}

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'store_name', nullable: true })
  storeName?: string;

  @Column({ name: 'store_address', type: 'text', nullable: true })
  storeAddress?: string;

  @Column({ name: 'receipt_date', type: 'timestamp', nullable: true })
  receiptDate?: Date;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalAmount?: number;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ name: 'raw_ocr_text', type: 'text', nullable: true })
  rawOcrText?: string;

  @Column({
    name: 'confidence_score',
    type: 'float',
    nullable: true,
    default: 0,
  })
  confidenceScore: number;

  @Column({ name: 'parser_used', nullable: true })
  parserUsed?: string;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.PROCESSING,
  })
  status: ReceiptStatus;

  @OneToMany(() => ReceiptItem, (item) => item.receipt, { cascade: true })
  items: ReceiptItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ name: 'confirmed_items_count', type: 'int', nullable: true })
  confirmedItemsCount?: number;

  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText?: string;

  @Column({ name: 'ocr_confidence', type: 'float', nullable: true })
  ocrConfidence?: number;

  @Column({ name: 'parsing_confidence', type: 'float', nullable: true })
  parsingConfidence?: number;

  @Column({ name: 'image_quality', type: 'float', nullable: true })
  imageQuality?: number;

  @Column({ name: 'household_id', type: 'uuid', nullable: true })
  householdId?: string;
}
