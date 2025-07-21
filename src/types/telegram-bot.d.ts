declare module 'node-telegram-bot-api' {
  export = TelegramBot;
  
  class TelegramBot {
    constructor(token: string, options?: any);
    on(event: string, callback: Function): void;
    sendMessage(chatId: string | number, text: string, options?: any): Promise<any>;
    stopPolling(): void;
  }
}