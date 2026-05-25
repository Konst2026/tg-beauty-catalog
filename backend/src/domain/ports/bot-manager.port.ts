export interface IBotManager {
  handleUpdate(masterId: string, update: unknown): Promise<void>;
  invalidateBot(masterId: string): void;
}
