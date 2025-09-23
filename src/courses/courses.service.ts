import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from 'src/common/services/audit.service';
import {
  paginateArray,
  PaginatedResult,
} from 'src/common/utils/pagination.util';
import { CourseQuery } from 'src/courses/dto/course-query.dto';
import { CreateCourseRequest } from 'src/courses/dto/create-course.dto';
import {
  CourseDetail,
  CourseLesson,
  CourseRecord,
  CourseSummary,
} from 'src/courses/interfaces/course.interface';

@Injectable()
export class CoursesService {
  private readonly courses: CourseRecord[] = [
    {
      id: 'course-nest-fundamentals',
      title: 'NestJS Fundamentals',
      description:
        'Learn how to build reliable services with NestJS and TypeScript.',
      tags: ['nestjs', 'backend', 'typescript'],
      instructorId: 'user-instructor',
      startsAt: '2024-02-01T09:00:00.000Z',
      endsAt: '2024-03-01T09:00:00.000Z',
      createdAt: '2023-12-15T10:00:00.000Z',
      updatedAt: '2024-01-20T12:00:00.000Z',
      lessons: [
        {
          id: 'lesson-1',
          title: 'Project setup and architecture',
          order: 1,
          durationMinutes: 45,
        },
        {
          id: 'lesson-2',
          title: 'Dependency injection and modules',
          order: 2,
          durationMinutes: 50,
        },
        {
          id: 'lesson-3',
          title: 'Building RESTful controllers',
          order: 3,
          durationMinutes: 55,
        },
      ],
      enrollment: {
        capacity: 40,
        enrolledUserIds: ['user-learner'],
        waitlistUserIds: [],
      },
    },
    {
      id: 'course-event-driven',
      title: 'Event-Driven Microservices',
      description:
        'Design resilient microservices with message-driven patterns.',
      tags: ['microservices', 'event-driven'],
      instructorId: 'user-instructor',
      startsAt: '2024-04-05T09:00:00.000Z',
      endsAt: '2024-05-15T09:00:00.000Z',
      createdAt: '2024-01-10T11:00:00.000Z',
      updatedAt: '2024-01-25T09:30:00.000Z',
      lessons: [
        {
          id: 'lesson-1',
          title: 'Domain events and integration events',
          order: 1,
          durationMinutes: 60,
        },
        {
          id: 'lesson-2',
          title: 'Implementing outbox pattern',
          order: 2,
          durationMinutes: 55,
        },
        {
          id: 'lesson-3',
          title: 'Scaling consumers and observability',
          order: 3,
          durationMinutes: 50,
        },
      ],
      enrollment: {
        capacity: 30,
        enrolledUserIds: ['user-learner', 'user-admin'],
        waitlistUserIds: [],
      },
    },
  ];

  constructor(private readonly auditService: AuditService) {}

  listCourses(query: CourseQuery): PaginatedResult<CourseSummary> {
    const filtered = this.courses.filter((course) => {
      if (query.tag && !course.tags.includes(query.tag)) {
        return false;
      }

      if (query.instructorId && course.instructorId !== query.instructorId) {
        return false;
      }

      if (query.search) {
        const normalized = query.search.toLowerCase();
        return (
          course.title.toLowerCase().includes(normalized) ||
          course.description.toLowerCase().includes(normalized) ||
          course.tags.some((tag) => tag.toLowerCase().includes(normalized))
        );
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (query.sort === 'title') {
        return a.title.localeCompare(b.title);
      }

      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });

    const paginated = paginateArray(sorted, {
      page: query.page,
      limit: query.limit,
    });

    return {
      data: paginated.data.map((course) => this.toSummary(course)),
      pagination: paginated.pagination,
    };
  }

  getCourseById(courseId: string): CourseDetail {
    const course = this.courses.find((item) => item.id === courseId);
    if (!course) {
      throw new NotFoundException({
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found.',
      });
    }

    return this.toDetail(course);
  }

  createCourse(
    request: CreateCourseRequest,
    traceId: string | undefined,
  ): CourseDetail {
    const duplicate = this.courses.find(
      (course) => course.title.toLowerCase() === request.title.toLowerCase(),
    );
    if (duplicate) {
      throw new ConflictException({
        code: 'COURSE_ALREADY_EXISTS',
        message: 'A course with this title already exists.',
      });
    }

    const now = new Date().toISOString();
    const courseId = `course-${randomUUID()}`;
    const lessons: CourseLesson[] = request.lessons.map((lesson, index) => ({
      id: `${courseId}-lesson-${index + 1}`,
      title: lesson.title,
      durationMinutes: lesson.durationMinutes,
      order: index + 1,
    }));

    const record: CourseRecord = {
      id: courseId,
      title: request.title,
      description: request.description,
      tags: request.tags,
      instructorId: request.instructorId,
      startsAt: request.startsAt.toISOString(),
      endsAt: request.endsAt.toISOString(),
      createdAt: now,
      updatedAt: now,
      lessons,
      enrollment: {
        capacity: request.capacity,
        enrolledUserIds: [],
        waitlistUserIds: [],
      },
    };

    this.courses.push(record);

    this.auditService.record('course.created', {
      userId: request.instructorId,
      traceId,
      metadata: {
        courseId,
      },
    });

    return this.toDetail(record);
  }

  isUserEnrolled(courseId: string, userId: string): boolean {
    const course = this.courses.find((item) => item.id === courseId);
    if (!course) {
      return false;
    }

    return course.enrollment.enrolledUserIds.includes(userId);
  }

  calculateEtag(course: CourseDetail): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(course));
    return hash.digest('hex');
  }

  private toSummary(course: CourseRecord): CourseSummary {
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      tags: [...course.tags],
      startsAt: course.startsAt,
      endsAt: course.endsAt,
      updatedAt: course.updatedAt,
    };
  }

  private toDetail(course: CourseRecord): CourseDetail {
    return {
      ...this.toSummary(course),
      instructorId: course.instructorId,
      createdAt: course.createdAt,
      lessons: course.lessons.map((lesson) => ({ ...lesson })),
      enrollment: {
        capacity: course.enrollment.capacity,
        enrolled: course.enrollment.enrolledUserIds.length,
        waitlisted: course.enrollment.waitlistUserIds.length,
      },
    };
  }
}
