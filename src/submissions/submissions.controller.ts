import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { type Request } from 'express';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/decorators/idempotent.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/types/role.enum';
import { validateCreateSubmissionRequest } from './dto/create-submission.dto';
import { SubmissionsService } from './submissions.service';

@Controller({ path: 'submissions', version: '1' })
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Idempotent()
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  submitAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    const payload = validateCreateSubmissionRequest(body);
    return this.submissionsService.createSubmission(
      user.id,
      payload,
      request.traceId,
    );
  }

  @Get('outbox')
  @Roles(Role.Admin)
  listOutboxEvents() {
    return this.submissionsService.listOutboxEvents();
  }
}
