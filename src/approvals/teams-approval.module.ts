import { DynamicModule, Module } from '@nestjs/common';
import { GRAPH_CLIENT } from '../graph/graph-client.interface';
import { LiveGraphClient } from '../graph/graph.client.live';
import { StubGraphClient } from '../graph/graph.client.stub';
import { TokenService } from '../graph/token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalService } from './approval.service';

export interface TeamsApprovalOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  teamId: string;
  mode?: 'live' | 'stub';
}

export const TEAMS_APPROVAL_OPTIONS = Symbol('TEAMS_APPROVAL_OPTIONS');

@Module({})
export class TeamsApprovalModule {
  static forRoot(options: TeamsApprovalOptions): DynamicModule {
    return {
      module: TeamsApprovalModule,
      providers: [
        { provide: TEAMS_APPROVAL_OPTIONS, useValue: options },
        PrismaService,
        TokenService,
        ApprovalService,
        {
          provide: GRAPH_CLIENT,
          useClass: options.mode === 'live' ? LiveGraphClient : StubGraphClient,
        },
      ],
      exports: [ApprovalService],
    };
  }
}
