import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from 'src/app.service';
import { ROUTES } from 'src/common/routes';

import type { Request } from 'express';

@ApiTags('Health')
@Controller(ROUTES.health.root)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns service health information.',
  })
  @ApiOkResponse({
    description: 'Health status',
    schema: {
      example: {
        status: 'ok',
        version: '1.0.0',
        timestamp: '2025-09-25T20:40:00.000Z',
        traceId: '123e4567-e89b-12d3-a456-426614174000',
      },
    },
  })
  getHealth(@Req() request: Request) {
    return this.appService.getHealth(request.traceId);
  }
}
