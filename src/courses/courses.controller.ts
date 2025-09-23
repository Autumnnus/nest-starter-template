import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Idempotent } from 'src/common/decorators/idempotent.decorator';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/types/role.enum';
import { CoursesService } from 'src/courses/courses.service';
import { validateCourseQuery } from 'src/courses/dto/course-query.dto';
import { validateCreateCourseRequest } from 'src/courses/dto/create-course.dto';

import type { Request, Response } from 'express';

@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  list(
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, max-age=60');
    const filters = validateCourseQuery(query);
    return this.coursesService.listCourses(filters);
  }

  @Get(':id')
  getCourse(
    @Param('id') courseId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const course = this.coursesService.getCourseById(courseId);
    const etag = this.coursesService.calculateEtag(course);
    const quotedEtag = `"${etag}"`;
    const ifNoneMatch = request.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string' && ifNoneMatch === quotedEtag) {
      response.status(304);
      return;
    }

    response.setHeader('ETag', quotedEtag);
    response.setHeader('Last-Modified', course.updatedAt);
    response.setHeader('Cache-Control', 'public, max-age=600');
    return course;
  }

  @Post()
  @Roles(Role.Admin)
  @Idempotent()
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  createCourse(@Body() body: unknown, @Req() request: Request) {
    const payload = validateCreateCourseRequest(body);
    return this.coursesService.createCourse(payload, request.traceId);
  }
}
