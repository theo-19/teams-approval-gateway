export interface SentMessage {
  channelId: string;
  messageId: string;
}

export interface GraphClient {
  /** Post an Adaptive Card to a Teams channel. Returns message identity. */
  sendApprovalCard(
    channelId: string,
    card: unknown,
    correlationId: string,
  ): Promise<SentMessage>;

  /** Replace a card in place, e.g. after a decision is recorded. */
  updateCard(
    channelId: string,
    messageId: string,
    card: unknown,
  ): Promise<void>;
}

export const GRAPH_CLIENT = Symbol('GRAPH_CLIENT');
