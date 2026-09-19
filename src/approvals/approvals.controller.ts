import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApprovalService } from './approval.service';

interface TeamsActionPayload {
  value?: {
    action?: {
      data?: { correlationId?: string; decision?: 'approve' | 'reject' };
    };
  };
  from?: { aadObjectId?: string };
}

@Controller('teams')
export class ApprovalsController {
  private readonly logger = new Logger(ApprovalsController.name);

  constructor(private readonly approvals: ApprovalService) {}

  @Post('callback')
  async handleCallback(@Body() payload: TeamsActionPayload) {
    const data = payload.value?.action?.data;
    const decidedBy = payload.from?.aadObjectId;

    if (!data?.correlationId || !data.decision || !decidedBy) {
      this.logger.warn('Malformed callback payload');
      return { statusCode: 400, type: 'message', value: 'Invalid request.' };
    }

    const result = await this.approvals.recordDecision(
      data.correlationId,
      data.decision,
      decidedBy,
    );

    if (!result.applied) {
      return {
        statusCode: 200,
        type: 'message',
        value:
          result.reason === 'already_decided'
            ? 'This request has already been decided.'
            : 'Request not found.',
      };
    }

    return {
      statusCode: 200,
      type: 'message',
      value: `Recorded: ${result.status}`,
    };
  }
}
