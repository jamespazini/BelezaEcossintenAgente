/**
 * BullMQ Queue configuration
 */

const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const env = require('../config/env');

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const createQueue = (name) => {
  return new Queue(name, { connection: redisConnection });
};

const queues = {
  inboundMessages: createQueue('inbound-messages'),
  outboundMessages: createQueue('outbound-messages'),
  aiProcessing: createQueue('ai-processing'),
  appointmentReminders: createQueue('appointment-reminders'),
};

module.exports = {
  redisConnection,
  queues,
};
