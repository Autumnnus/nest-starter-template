export interface SubmissionRecord {
  id: string;
  userId: string;
  courseId: string;
  assignmentId: string;
  content: string;
  submittedAt: string;
  gradedAt?: string;
  grade?: number;
}

export interface OutboxEvent {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  createdAt: string;
  traceId?: string;
}
