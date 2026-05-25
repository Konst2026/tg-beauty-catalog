export interface TrialExpiredEvent {
  type: 'TrialExpired';
  masterId: string;
  masterTelegramId: number;
  masterName: string;
}

export interface TrialExpiringEvent {
  type: 'TrialExpiring';
  masterId: string;
  masterTelegramId: number;
  masterName: string;
  daysLeft: number;
}
