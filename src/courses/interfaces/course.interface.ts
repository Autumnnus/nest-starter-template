export interface CourseLesson {
  id: string;
  title: string;
  order: number;
  durationMinutes: number;
}

export interface CourseRecord {
  id: string;
  title: string;
  description: string;
  tags: string[];
  instructorId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  lessons: CourseLesson[];
  enrollment: {
    capacity: number;
    enrolledUserIds: string[];
    waitlistUserIds: string[];
  };
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  startsAt: string;
  endsAt: string;
  updatedAt: string;
}

export interface CourseDetail extends CourseSummary {
  lessons: CourseLesson[];
  instructorId: string;
  createdAt: string;
  enrollment: {
    capacity: number;
    enrolled: number;
    waitlisted: number;
  };
}
