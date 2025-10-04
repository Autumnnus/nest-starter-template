import { Test } from '@nestjs/testing';
import { PresenceService } from 'src/presence/presence.service';
import { RedisService } from 'src/redis/redis.service';

import type { TestingModule } from '@nestjs/testing';

type RedisClientMock = {
  setex: jest.Mock<Promise<'OK'>, [string, number, string]>;
  pipeline: jest.Mock;
};

describe('PresenceService', () => {
  let service: PresenceService;
  let redisService: jest.Mocked<RedisService>;
  let redisClient: RedisClientMock;

  beforeEach(async () => {
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      pipeline: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient as unknown),
    } as unknown as jest.Mocked<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get(PresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should ping presence with default TTL', async () => {
    await service.presencePing('user-1');

    expect(redisClient.setex).toHaveBeenCalledWith(
      'presence:user-1',
      30,
      'online',
    );
  });

  it('should ping presence with custom TTL', async () => {
    await service.presencePing('user-2', 45);

    expect(redisClient.setex).toHaveBeenCalledWith(
      'presence:user-2',
      45,
      'online',
    );
  });

  it('should return presence map for provided users', async () => {
    const execMock = jest.fn().mockResolvedValue<unknown>([
      [null, 'online'],
      [null, null],
    ]);
    const pipelineMock = {
      get: jest.fn().mockReturnThis(),
      exec: execMock,
    };

    redisClient.pipeline.mockReturnValue(pipelineMock);

    const presence = await service.getPresence(['user-1', 'user-2']);

    expect(redisClient.pipeline).toHaveBeenCalledTimes(1);
    expect(pipelineMock.get).toHaveBeenNthCalledWith(1, 'presence:user-1');
    expect(pipelineMock.get).toHaveBeenNthCalledWith(2, 'presence:user-2');
    expect(presence).toEqual({ 'user-1': 'online', 'user-2': 'offline' });
  });

  it('should return empty presence map when user list is empty', async () => {
    const presence = await service.getPresence([]);

    expect(presence).toEqual({});
    expect(redisClient.pipeline).not.toHaveBeenCalled();
  });

  it('should throw when redis pipeline returns an error', async () => {
    const error = new Error('redis failed');
    const execMock = jest.fn().mockResolvedValue([[error, null]]);
    const pipelineMock = {
      get: jest.fn().mockReturnThis(),
      exec: execMock,
    };

    redisClient.pipeline.mockReturnValue(pipelineMock);

    await expect(service.getPresence(['user-1'])).rejects.toThrow(
      'redis failed',
    );
  });
});
