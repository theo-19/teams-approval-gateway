// src/approvals/approval.card.ts
import { ApprovalRequest } from '@prisma/client';

export function buildApprovalCard(request: ApprovalRequest) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Approval required',
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'TextBlock',
        text: request.title,
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Amount', value: formatAmount(request.amount) },
          { title: 'Requested by', value: request.requesterId },
          { title: 'Reference', value: request.correlationId },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: 'Approve',
        verb: 'approve',
        data: { correlationId: request.correlationId, decision: 'approve' },
      },
      {
        type: 'Action.Execute',
        title: 'Reject',
        verb: 'reject',
        data: { correlationId: request.correlationId, decision: 'reject' },
      },
    ],
  };
}

export function buildDecidedCard(request: ApprovalRequest) {
  const outcome = request.status === 'APPROVED' ? 'Approved' : 'Rejected';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${outcome} — ${request.title}`,
        weight: 'Bolder',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Amount', value: formatAmount(request.amount) },
          { title: 'Decided by', value: request.decidedBy ?? 'unknown' },
          {
            title: 'Decided at',
            value: request.decidedAt?.toISOString() ?? 'unknown',
          },
        ],
      },
    ],
  };
}

function formatAmount(amount: unknown): string {
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
