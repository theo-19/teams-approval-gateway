import { Injectable, Logger } from '@nestjs/common';
import { GraphClient, SentMessage } from './graph-client.interface.js';
import { TokenService } from './token.service.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class LiveGraphClient implements GraphClient {
  private readonly logger = new Logger(LiveGraphClient.name);

  constructor(private readonly tokens: TokenService) {}

  async sendApprovalCard(
    channelId: string,
    card: unknown,
    correlationId: string,
  ): Promise<SentMessage> {
    const teamId = process.env.TEAMS_TEAM_ID;
    const body = {
      body: {
        contentType: 'html',
        content: '<attachment id="card"></attachment>',
      },
      attachments: [
        {
          id: 'card',
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: JSON.stringify(card),
        },
      ],
    };

    const res = await this.request(
      `${GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages`,
      'POST',
      body,
    );

    this.logger.log(`Sent approval card ${correlationId} -> message ${res.id}`);
    return { channelId, messageId: res.id };
  }

  async updateCard(
    channelId: string,
    messageId: string,
    card: unknown,
  ): Promise<void> {
    const teamId = process.env.TEAMS_TEAM_ID;
    await this.request(
      `${GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      'PATCH',
      {
        attachments: [
          {
            id: 'card',
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: JSON.stringify(card),
          },
        ],
      },
    );
  }

  /**
   * Graph returns 429 with a Retry-After header under throttling, and
   * transient 5xx during service degradation. Both are retryable; 4xx
   * other than 429 are not, and retrying them just wastes the token.
   */
  private async request(
    url: string,
    method: string,
    body: unknown,
    attempt = 1,
  ): Promise<any> {
    const token = await this.tokens.getToken();

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) return res.status === 204 ? null : res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 4) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 2 ** attempt;
      this.logger.warn(
        `Graph ${res.status}, retrying in ${retryAfter}s (attempt ${attempt})`,
      );
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.request(url, method, body, attempt + 1);
    }

    throw new Error(`Graph request failed: ${res.status} ${await res.text()}`);
  }
}
