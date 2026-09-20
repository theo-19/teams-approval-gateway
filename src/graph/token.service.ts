import { ConfidentialClientApplication } from '@azure/msal-node';
import { Inject, Injectable } from '@nestjs/common';
import {
  TEAMS_APPROVAL_OPTIONS,
  TeamsApprovalOptions,
} from '../approvals/teams-approval.module';

@Injectable()
export class TokenService {
  private readonly client: ConfidentialClientApplication;

  constructor(
    @Inject(TEAMS_APPROVAL_OPTIONS)
    private readonly options: TeamsApprovalOptions,
  ) {
    this.client = new ConfidentialClientApplication({
      auth: {
        clientId: options.clientId,
        authority: `https://login.microsoftonline.com/${options.tenantId}`,
        clientSecret: options.clientSecret,
      },
    });
  }

  async getToken(): Promise<string> {
    const result = await this.client.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!result?.accessToken) throw new Error('Failed to acquire Graph token');
    return result.accessToken;
  }
}
