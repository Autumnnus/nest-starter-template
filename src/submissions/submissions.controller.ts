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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Idempotent } from 'src/common/decorators/idempotent.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/types/role.enum';
import { validateCreateSubmissionRequest } from 'src/submissions/dto/create-submission.dto';
import { SubmissionsService } from 'src/submissions/submissions.service';

import type { IUser } from 'src/auth/interfaces/authenticated-user.interface';

@Controller({ path: 'submissions', version: '1' })
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @Idempotent()
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  submitAssignment(
    @CurrentUser() user: IUser,
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
