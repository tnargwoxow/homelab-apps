type Job<T> = () => Promise<T>;

export interface QueueStats {
  active: number;
  pending: number;
  done: number;
  failed: number;
}

export class WorkQueue {
  private active = 0;
  private done = 0;
  private failed = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  stats(): QueueStats {
    return { active: this.active, pending: this.waiting.length, done: this.done, failed: this.failed };
  }

  size(): number {
    return this.active + this.waiting.length;
  }

  async run<T>(job: Job<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>(resolve => this.waiting.push(resolve));
    }
    this.active++;
    try {
      const result = await job();
      this.done++;
      return result;
    } catch (err) {
      this.failed++;
      throw err;
    } finally {
      this.active--;
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}
