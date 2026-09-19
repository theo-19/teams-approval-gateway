import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApprovalStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { GRAPH_CLIENT, GraphClient } from '../graph/graph-client.interface';
import { buildApprovalCard } from './approval.card';

export interface ApprovalRequestInput {
  title: string;
  amount: number;
  requesterId: string;
  approverId: string;
  channelId: string;
}

export type DecisionOutcome =
  | { applied: true; status: ApprovalStatus }
  | { applied: false; reason: 'not_found' | 'already_decided' };

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaClient,
    @Inject(GRAPH_CLIENT) private readonly graph: GraphClient,
  ) {}

  async requestApproval(input: ApprovalRequestInput) {
    const correlationId = randomUUID();

    const request = await this.prisma.approvalRequest.create({
      data: {
        correlationId,
        title: input.title,
        amount: input.amount,
        requesterId: input.requesterId,
        approverId: input.approverId,
        channelId: input.channelId,
        status: ApprovalStatus.PENDING,
      },
    });

    try {
      const card = buildApprovalCard(request);
      const sent = await this.graph.sendApprovalCard(
        input.channelId,
        card,
        correlationId,
      );

      return this.prisma.approvalRequest.update({
        where: { id: request.id },
        data: { messageId: sent.messageId },
      });
    } catch (err) {
      this.logger.error(
        `Card send failed for ${correlationId}; request left PENDING for retry`,
        err as Error,
      );
      return request;
    }
  }

  async recordDecision(
    correlationId: string,
    decision: 'approve' | 'reject',
    decidedBy: string,
  ): Promise<DecisionOutcome> {
    const status =
      decision === 'approve'
        ? ApprovalStatus.APPROVED
        : ApprovalStatus.REJECTED;

    const result = await this.prisma.approvalRequest.updateMany({
      where: { correlationId, status: ApprovalStatus.PENDING },
      data: { status, decidedBy, decidedAt: new Date() },
    });

    if (result.count === 1) return { applied: true, status };

    const existing = await this.prisma.approvalRequest.findUnique({
      where: { correlationId },
    });

    if (!existing) return { applied: false, reason: 'not_found' };

    this.logger.warn(
      `Late or duplicate decision on ${correlationId}, already ${existing.status}`,
    );
    return { applied: false, reason: 'already_decided' };
  }
}
