export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
}

export interface ITelegramBotApiPort {
  getMe(token: string): Promise<BotInfo>;
  setWebhook(token: string, url: string, secretToken: string): Promise<void>;
  deleteWebhook(token: string): Promise<void>;
}
