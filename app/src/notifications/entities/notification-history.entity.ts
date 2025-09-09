import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notification_history')
export class NotificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    stockIds?: string[];
    productNames?: string[];
    expiredCount?: number;
    criticalCount?: number;
    urgentCount?: number;
    warningCount?: number;
  };

  @Column({ default: false })
  sentByEmail: boolean;

  @Column({ default: false })
  sentByPush: boolean;

  @CreateDateColumn()
  sentAt: Date;
}
