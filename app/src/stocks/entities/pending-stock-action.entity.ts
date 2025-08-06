import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Unit } from 'src/common/units/unit.enums';
import { HouseholdMember } from 'src/households/entities/household-member.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stock } from './stock.entity';

export enum PendingActionType {
  CONSUME = 'consume',
  UPDATE_QUANTITY = 'update_quantity',
  UPDATE_DLC = 'update_dlc',
  DELETE = 'delete',
  WASTE = 'waste',
}

export enum PendingActionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('pending_stock_actions')
export class PendingStockAction {
  @ApiProperty({
    description: "Identifiant unique de l'action en attente",
  })
  @PrimaryGeneratedColumn('uuid')
  @Expose({ groups: ['pending:list', 'pending:read'] })
  id: string;

  @ManyToOne(() => Stock, { eager: true })
  @Expose({ groups: ['pending:list', 'pending:read'] })
  @Type(() => Stock)
  stock: Stock;

  @ManyToOne(() => HouseholdMember, { eager: true })
  @Expose({ groups: ['pending:list', 'pending:read'] })
  @Type(() => HouseholdMember)
  requestedBy: HouseholdMember;

  @ApiProperty({
    description: "Type d'action demandée",
    enum: PendingActionType,
  })
  @Column({ type: 'enum', enum: PendingActionType })
  @Expose({ groups: ['pending:list', 'pending:read'] })
  actionType: PendingActionType;

  @ApiProperty({
    description: "Statut de l'action",
    enum: PendingActionStatus,
  })
  @Column({
    type: 'enum',
    enum: PendingActionStatus,
    default: PendingActionStatus.PENDING,
  })
  @Expose({ groups: ['pending:list', 'pending:read'] })
  status: PendingActionStatus;

  @ApiProperty({
    description: "Quantité demandée pour l'action",
  })
  @Column({ type: 'float', nullable: true })
  @Expose({ groups: ['pending:read'] })
  requestedQuantity?: number;

  @ApiProperty({
    description: 'Nouvelle quantité demandée',
  })
  @Column({ type: 'float', nullable: true })
  @Expose({ groups: ['pending:read'] })
  newQuantity?: number;

  @ApiProperty({
    description: 'Nouvelle date DLC demandée',
  })
  @Column({ type: 'date', nullable: true })
  @Expose({ groups: ['pending:read'] })
  newDlc?: Date;

  @ApiProperty({
    description: 'Nouvelle unité demandée',
  })
  @Column({ type: 'enum', enum: Unit, nullable: true })
  @Expose({ groups: ['pending:read'] })
  newUnit?: Unit;

  @ApiProperty({
    description: "Raison de l'action",
  })
  @Column({ type: 'text', nullable: true })
  @Expose({ groups: ['pending:read'] })
  reason?: string;

  @ApiProperty({
    description: 'Commentaire du demandeur',
  })
  @Column({ type: 'text', nullable: true })
  @Expose({ groups: ['pending:read'] })
  comment?: string;

  @ManyToOne(() => HouseholdMember, { nullable: true })
  @Expose({ groups: ['pending:read'] })
  @Type(() => HouseholdMember)
  approvedBy?: HouseholdMember;

  @ApiProperty({
    description: "Date d'approbation ou de rejet",
  })
  @Column({ type: 'timestamp', nullable: true })
  @Expose({ groups: ['pending:read'] })
  processedAt?: Date;

  @ApiProperty({
    description: "Commentaire de l'approbateur",
  })
  @Column({ type: 'text', nullable: true })
  @Expose({ groups: ['pending:read'] })
  approverComment?: string;

  @ApiProperty({
    description: "Date d'expiration de la demande",
  })
  @Column({ type: 'timestamp' })
  @Expose({ groups: ['pending:read'] })
  expiresAt: Date;

  @CreateDateColumn()
  @Expose({ groups: ['pending:read'] })
  createdAt: Date;

  @UpdateDateColumn()
  @Expose({ groups: ['pending:read'] })
  updatedAt: Date;
}
