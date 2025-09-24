import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CoursesModule } from '../courses/courses.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [CommonModule, CoursesModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
