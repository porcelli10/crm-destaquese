declare module "notificamehubsdk" {
  export class TextContent {
    constructor(text: string);
  }

  export class FileContent {
    constructor(
      fileUrl: string,
      fileMimeType?: string,
      fileCaption?: string,
      fileName?: string,
      voice?: boolean
    );
  }

  export interface HubChannel {
    sendMessage(from: string, to: string, ...contents: any[]): Promise<any>;
  }

  export class Client {
    constructor(token: string, loggerLevel?: string, options?: any);
    setChannel(channel: string): HubChannel;
    createSubscription(subscription: any): Promise<any>;
    listSubscriptions(): Promise<any>;
    getSubscription(id: string): Promise<any>;
    deleteSubscription(id: string): Promise<any>;
  }

  export class MessageSubscription {
    constructor(webhook: { url: string }, criteria: { channel: string; direction?: string });
  }

  export class MessageStatusSubscription {
    constructor(webhook: { url: string }, criteria: { channel: string });
  }
}
