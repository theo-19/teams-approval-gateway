import { Injectable } from '@nestjs/common'
import { GraphClient, SentMessage } from './graph-client.interface.js'

/** In-memory GraphClient for tests and local development without a tenant. */
@Injectable()
export class StubGraphClient implements GraphClient {
  readonly sent: Array<{ channelId: string; card: unknown; correlationId: string }> = [];
  readonly updated: Array<{ messageId: string; card: unknown }> = [];

  async sendApprovalCard(channelId: string, card: unknown, correlationId: string): Promise<SentMessage> {
    this.sent.push({ channelId, card, correlationId });
    return { channelId, messageId: `stub-${correlationId}` };
  }

  async updateCard(_channelId: string, messageId: string, card: unknown): Promise<void> {
    this.updated.push({ messageId, card });
  }
}
