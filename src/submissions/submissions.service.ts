import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from 'src/common/services/audit.service';
import { CoursesService } from 'src/courses/courses.service';
import { CreateSubmissionRequest } from 'src/submissions/dto/create-submission.dto';
import {
  OutboxEvent,
  SubmissionRecord,
} from 'src/submissions/interfaces/submission.interface';

@Injectable()
export class SubmissionsService {
  private readonly submissions: SubmissionRecord[] = [];
  private readonly outbox: OutboxEvent[] = [];

  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditService: AuditService,
  ) {}

  createSubmission(
    userId: string,
    request: CreateSubmissionRequest,
    traceId: string | undefined,
  ): SubmissionRecord {
    const enrolled = this.coursesService.isUserEnrolled(
      request.courseId,
      userId,
    );
    if (!enrolled) {
      throw new ForbiddenException({
        code: 'COURSE_ENROLLMENT_REQUIRED',
        message:
          'You must be enrolled in the course to submit this assignment.',
      });
    }

    const submission: SubmissionRecord = {
      id: randomUUID(),
      userId,
      courseId: request.courseId,
      assignmentId: request.assignmentId,
      content: request.content,
      submittedAt: request.submittedAt.toISOString(),
    };

    this.submissions.push(submission);

    const event: OutboxEvent = {
      id: randomUUID(),
      event: 'submission.created',
      payload: {
        submissionId: submission.id,
        userId,
        courseId: submission.courseId,
        assignmentId: submission.assignmentId,
        submittedAt: submission.submittedAt,
      },
      createdAt: new Date().toISOString(),
      traceId,
    };

    this.outbox.push(event);

    this.auditService.record('submission.created', {
      userId,
      traceId,
      metadata: {
        submissionId: submission.id,
        courseId: submission.courseId,
      },
    });

    return submission;
  }

  listOutboxEvents(): OutboxEvent[] {
    return [...this.outbox];
  }
}
