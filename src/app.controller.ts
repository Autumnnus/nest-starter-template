import { Controller, Get, Req } from '@nestjs/common';
import { type Request } from 'express';
import { AppService } from 'src/app.service';

@Controller({ path: 'health', version: '1' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(@Req() request: Request) {
    return this.appService.getHealth(request.traceId);
  }
}
