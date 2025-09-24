import { Test } from '@nestjs/testing';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';

import type { TestingModule } from '@nestjs/testing';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return a health payload', () => {
    const result = appController.getHealth({ traceId: 'test-trace' } as any);
    expect(result.status).toBe('ok');
    expect(result.traceId).toBe('test-trace');
  });
});
