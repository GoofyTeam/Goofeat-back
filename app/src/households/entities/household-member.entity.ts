import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { User } from 'src/users/entity/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { HouseholdRole } from '../enums/household-role.enum';
import { Household } from './household.entity';

@Entity('household_members')
@Unique(['userId', 'householdId'])
export class HouseholdMember {
  @ApiProperty({
    description: 'Identifiant unique du membre',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @PrimaryGeneratedColumn('uuid')
  @Expose({ groups: ['member:list', 'member:read'] })
  id: string;

  @ApiProperty({
    description: "ID de l'utilisateur",
  })
  @Column({ type: 'uuid' })
  @Expose({ groups: ['member:read'] })
  userId: string;

  @ApiProperty({
    description: 'ID du foyer',
  })
  @Column({ type: 'uuid' })
  @Expose({ groups: ['member:read'] })
  householdId: string;

  @ApiProperty({
    description: 'Rôle dans le foyer',
    enum: HouseholdRole,
    example: HouseholdRole.PARENT,
  })
  @Column({
    type: 'enum',
    enum: HouseholdRole,
    default: HouseholdRole.ROOMMATE,
  })
  @Expose({ groups: ['member:list', 'member:read'] })
  role: HouseholdRole;

  @ApiProperty({
    description: 'Peut modifier les stocks',
    example: true,
  })
  @Column({ default: true })
  @Expose({ groups: ['member:read'] })
  canEditStock: boolean;

  @ApiProperty({
    description: 'Les actions nécessitent une approbation parentale',
    example: false,
  })
  @Column({ default: false })
  @Expose({ groups: ['member:read'] })
  needsApproval: boolean;

  @ApiProperty({
    description: 'Peut voir tous les stocks du foyer',
    example: true,
  })
  @Column({ default: true })
  @Expose({ groups: ['member:read'] })
  canViewAllStocks: boolean;

  @ApiProperty({
    description: 'Peut inviter de nouveaux membres',
    example: false,
  })
  @Column({ default: false })
  @Expose({ groups: ['member:read'] })
  canInviteMembers: boolean;

  @ApiProperty({
    description: 'Surnom dans le foyer',
    example: 'Papa',
  })
  @Column({ length: 50, nullable: true })
  @Expose({ groups: ['member:list', 'member:read'] })
  nickname?: string;

  @ApiProperty({
    description: "Date d'adhésion au foyer",
  })
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Expose({ groups: ['member:read'] })
  joinedAt: Date;

  @ApiProperty({
    description: 'Membre actif ou non',
    example: true,
  })
  @Column({ default: true })
  @Expose({ groups: ['member:read'] })
  isActive: boolean;

  @ManyToOne(() => User, { eager: true })
  @Expose({ groups: ['member:list', 'member:read'] })
  @Type(() => User)
  user: User;

  @ManyToOne(() => Household, (household) => household.members)
  @Expose({ groups: ['member:read'] })
  @Type(() => Household)
  household: Household;

  @ApiProperty({
    description: 'Date de création',
  })
  @CreateDateColumn()
  @Expose({ groups: ['member:read'] })
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
  })
  @UpdateDateColumn()
  @Expose({ groups: ['member:read'] })
  updatedAt: Date;
}
