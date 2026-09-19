import { ConfidentialClientApplication } from '@azure/msal-node';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly client: ConfidentialClientApplication;

  constructor() {
    this.client = new ConfidentialClientApplication({
      auth: {
        clientId: required('AZURE_CLIENT_ID'),
        authority: `https://login.microsoftonline.com/${required('AZURE_TENANT_ID')}`,
        clientSecret: required('AZURE_CLIENT_SECRET'),
      },
    });
  }

  /**
   * Client credentials flow: the app authenticates as itself, not on behalf
   * of a user. MSAL caches the token internally and only hits the token
   * endpoint when the cached one is near expiry.
   */
  async getToken(): Promise<string> {
    const result = await this.client.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });

    if (!result?.accessToken) {
      throw new Error('Failed to acquire Graph token');
    }
    return result.accessToken;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
