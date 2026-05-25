export interface INotificationPort {
  notifyMaster(masterId: string, masterTelegramId: number, text: string): Promise<void>;
  notifyClient(clientTelegramId: number, text: string): Promise<void>;
}
