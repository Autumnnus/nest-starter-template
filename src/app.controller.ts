import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from 'src/app.service';
import { ROUTES } from 'src/common/routes';

import type { Request } from 'express';

@Controller(ROUTES.health.root)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(@Req() request: Request) {
    return this.appService.getHealth(request.traceId);
  }
}
