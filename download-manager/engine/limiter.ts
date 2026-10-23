/**
 * Token bucket that lets concurrent callers go into "debt": each take() reserves
 * its bytes immediately and sleeps until the bucket would have refilled, so the
 * long-run rate stays at `rate` no matter how many connections share it.
 */
export class TokenBucket {
  rate: number;
  private tokens: number;
  private last = performance.now();

  constructor(rate = 0) {
    this.rate = rate;
    this.tokens = rate;
  }

  setRate(rate: number) {
    this.rate = Math.max(0, rate | 0);
    this.tokens = Math.min(this.tokens, this.rate);
  }

  async take(n: number, signal?: AbortSignal): Promise<void> {
    if (!this.rate) return;
    const now = performance.now();
    this.tokens = Math.min(this.rate, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    this.tokens -= n;
    if (this.tokens >= 0) return;
    const waitMs = (-this.tokens / this.rate) * 1000;
    await sleep(waitMs, signal);
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}
