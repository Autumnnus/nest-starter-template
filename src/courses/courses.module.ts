import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { CoursesController } from 'src/courses/courses.controller';
import { CoursesService } from 'src/courses/courses.service';

@Module({
  imports: [CommonModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
