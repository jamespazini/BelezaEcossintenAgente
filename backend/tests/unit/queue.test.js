'use strict';

process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = 'redis-test';
process.env.REDIS_PORT = '16379';

const addMock = jest.fn();
const queueMock = jest.fn((name) => ({ name }));
const queueSchedulerMock = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((options) => ({
    ...options,
    connect: jest.fn(async () => true),
    on: jest.fn(),
    quit: jest.fn(async () => true),
  }));
});

jest.mock('bullmq', () => ({
  Queue: jest.fn((name, options) => ({ name, ...options })),
  QueueScheduler: jest.fn((name, options) => ({ name, ...options })),
}));

const IORedis = require('ioredis');
const { Queue, QueueScheduler } = require('bullmq');
const { queues, redisConnection } = require('../../src/queue/queue');

describe('Queue initialization', () => {
  test('creates a Redis connection using environment variables', () => {
    expect(IORedis).toHaveBeenCalledTimes(1);
    expect(IORedis).toHaveBeenCalledWith({
      host: 'redis-test',
      port: 16379,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
    expect(redisConnection).toBeDefined();
  });

  test('initializes the expected BullMQ queues', () => {
    expect(QueueScheduler).toHaveBeenCalledTimes(4);
    expect(Queue).toHaveBeenCalledTimes(4);
    expect(queues).toHaveProperty('inboundMessages');
    expect(queues).toHaveProperty('outboundMessages');
    expect(queues).toHaveProperty('aiProcessing');
    expect(queues).toHaveProperty('appointmentReminders');
    expect(queues.inboundMessages.name).toBe('inbound-messages');
    expect(queues.outboundMessages.name).toBe('outbound-messages');
  });
});
