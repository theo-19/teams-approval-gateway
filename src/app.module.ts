import { Module } from '@nestjs/common';
import { TeamsApprovalModule } from './approvals/teams-approval.module';

@Module({
  imports: [
    TeamsApprovalModule.forRoot({
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      teamId: process.env.TEAMS_TEAM_ID!,
      mode: (process.env.GRAPH_MODE as 'live' | 'stub') ?? 'stub',
    }),
  ],
})
export class AppModule {}
