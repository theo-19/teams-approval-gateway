import { ApprovalStatus, PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApprovalService } from '../src/approvals/approval.service';
import { StubGraphClient } from '../src/graph/graph.client.stub';

const input = {
  title: 'Laptop purchase',
  amount: 1200,
  requesterId: 'user-1',
  approverId: 'user-2',
  channelId: 'channel-1',
};

describe('ApprovalService', () => {
  let service: ApprovalService;
  let graph: StubGraphClient;
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma = new PrismaClient();
    graph = new StubGraphClient();
    service = new ApprovalService(prisma, graph);
    await prisma.approvalRequest.deleteMany();
  });

  it('creates a pending request and sends a card', async () => {
    const req = await service.requestApproval({
      title: 'Laptop purchase',
      amount: 1200,
      requesterId: 'user-1',
      approverId: 'user-2',
      channelId: 'channel-1',
    });

    expect(req.status).toBe(ApprovalStatus.PENDING);
    expect(graph.sent).toHaveLength(1);
    expect(graph.sent[0]?.correlationId).toBe(req.correlationId);
  });

  it('records a decision on a pending request', async () => {
    const req = await service.requestApproval(input);

    const result = await service.recordDecision(
      req.correlationId,
      'approve',
      'user-2',
    );

    expect(result).toEqual({ applied: true, status: ApprovalStatus.APPROVED });
  });

  it('ignores a duplicate decision', async () => {
    const req = await service.requestApproval(input);

    await service.recordDecision(req.correlationId, 'approve', 'user-2');
    const second = await service.recordDecision(
      req.correlationId,
      'reject',
      'user-3',
    );

    expect(second).toEqual({ applied: false, reason: 'already_decided' });

    const stored = await prisma.approvalRequest.findUnique({
      where: { correlationId: req.correlationId },
    });
    expect(stored?.status).toBe(ApprovalStatus.APPROVED);
    expect(stored?.decidedBy).toBe('user-2');
  });

  it('returns not_found for an unknown correlationId', async () => {
    const result = await service.recordDecision('missing', 'approve', 'user-2');
    expect(result).toEqual({ applied: false, reason: 'not_found' });
  });
});
