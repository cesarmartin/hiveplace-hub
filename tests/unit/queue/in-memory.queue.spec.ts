import { InMemoryQueue, QueueJob } from '../../../src/queue/in-memory.queue';

describe('InMemoryQueue', () => {
  let queue: InMemoryQueue<{ data: string }>;

  beforeEach(() => {
    queue = new InMemoryQueue<{ data: string }>({ maxSize: 10, maxRetries: 3 });
  });

  afterEach(async () => {
    await queue.stop();
  });

  describe('enqueue', () => {
    it('should add job to queue and return true', () => {
      const result = queue.enqueue({ data: 'test' });
      expect(result).toBe(true);
      expect(queue.depth).toBe(1);
    });

    it('should return false when queue is at capacity', () => {
      const fullQueue = new InMemoryQueue<{ data: string }>({ maxSize: 2 });
      fullQueue.enqueue({ data: '1' });
      fullQueue.enqueue({ data: '2' });

      const result = fullQueue.enqueue({ data: '3' });
      expect(result).toBe(false);
    });

    it('should assign unique job ids', () => {
      queue.enqueue({ data: 'a' });
      queue.enqueue({ data: 'b' });

      // Jobs should have different IDs
      const jobs = (queue as any).jobs as QueueJob<{ data: string }>[];
      expect(jobs[0].id).not.toBe(jobs[1].id);
    });
  });

  describe('depth', () => {
    it('should return current queue size', () => {
      expect(queue.depth).toBe(0);
      queue.enqueue({ data: '1' });
      expect(queue.depth).toBe(1);
      queue.enqueue({ data: '2' });
      expect(queue.depth).toBe(2);
    });
  });

  describe('registerHandler', () => {
    it('should allow registering a handler', async () => {
      const handler = jest.fn();
      queue.registerHandler(handler);
      expect((queue as any).handlers.size).toBe(1);
    });

    it('should allow unregistering a handler', async () => {
      const handler = jest.fn();
      queue.registerHandler(handler);
      queue.unregisterHandler(handler);
      expect((queue as any).handlers.size).toBe(0);
    });
  });

  describe('start/stop', () => {
    it('should start the worker loop', () => {
      expect((queue as any).running).toBe(false);
      queue.start();
      expect((queue as any).running).toBe(true);
    });

    it('should stop the worker loop', async () => {
      queue.start();
      await queue.stop();
      expect((queue as any).running).toBe(false);
    });

    it('should not start twice', () => {
      queue.start();
      const firstRunning = (queue as any).running;
      queue.start();
      expect((queue as any).running).toBe(firstRunning);
    });
  });
});