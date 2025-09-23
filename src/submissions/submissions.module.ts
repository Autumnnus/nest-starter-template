import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { CoursesModule } from 'src/courses/courses.module';
import { SubmissionsController } from 'src/submissions/submissions.controller';
import { SubmissionsService } from 'src/submissions/submissions.service';

@Module({
  imports: [CommonModule, CoursesModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
