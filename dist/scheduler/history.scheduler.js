import { pruneHistory } from '../database/history.retention.js';
import { logger } from '../utils/logger.js';
const DAY_MS = 24 * 60 * 60 * 1000;
export class HistoryScheduler {
    cleanup;
    timer = null;
    running = null;
    stopped = true;
    constructor(cleanup = pruneHistory) {
        this.cleanup = cleanup;
    }
    start() {
        if (!this.stopped)
            return;
        this.stopped = false;
        // Give startup and the initial stock check a head start.
        this.schedule(60_000);
    }
    async stop() {
        this.stopped = true;
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
        await this.running;
    }
    schedule(delay) {
        if (this.stopped)
            return;
        this.timer = setTimeout(() => {
            this.timer = null;
            this.running = this.run().finally(() => {
                this.running = null;
                this.schedule(DAY_MS);
            });
        }, delay);
    }
    async run() {
        try {
            const result = await this.cleanup();
            logger.info('History cleanup finished', `cutoff=${result.cutoff.toISOString()} history=${result.history} notifications=${result.notifications}`);
        }
        catch (error) {
            logger.error('History cleanup failed - will retry next day', error);
        }
    }
}
export const historyScheduler = new HistoryScheduler();
//# sourceMappingURL=history.scheduler.js.map