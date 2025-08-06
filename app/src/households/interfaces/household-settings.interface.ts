export interface NotificationSettings {
  stockUpdates?: boolean;
  childActions?: boolean;
  expirationAlerts?: boolean;
  memberJoined?: boolean;
  onlyParentsForApproval?: boolean;
  digestMode?: 'instant' | 'daily' | 'weekly' | 'disabled';
}

export interface ChildApprovalSettings {
  enabled?: boolean;
  autoExpireHours?: number;
  maxQuantityWithoutApproval?: number;
}

export interface HouseholdSettings {
  notifications?: NotificationSettings;
  childApproval?: ChildApprovalSettings;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  stockUpdates: true,
  childActions: true,
  expirationAlerts: true,
  memberJoined: true,
  onlyParentsForApproval: true,
  digestMode: 'instant',
};

export const DEFAULT_CHILD_APPROVAL_SETTINGS: ChildApprovalSettings = {
  enabled: true,
  autoExpireHours: 24,
  maxQuantityWithoutApproval: 1,
};

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  childApproval: DEFAULT_CHILD_APPROVAL_SETTINGS,
};
