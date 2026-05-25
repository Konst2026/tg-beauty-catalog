export interface IBotManager {
  handleUpdate(masterId: string, update: unknown): Promise<void>;
  invalidateBot(masterId: string): void;
  sendMessage(masterId: string, telegramId: number, text: string): Promise<void>;
}
