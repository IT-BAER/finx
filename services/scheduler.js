/**
 * Background Job Scheduler
 * Handles periodic processing of recurring transactions
 */

class Scheduler {
  constructor() {
    this.intervals = new Map();
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.info("Scheduler is already running");
      return;
    }

    console.info("Starting background job scheduler...");
    this.isRunning = true;

    console.info("Background job scheduler started successfully");
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.info("Scheduler is not running");
      return;
    }

    console.info("Stopping background job scheduler...");

    // Clear all intervals
    for (const [jobName, intervalId] of this.intervals) {
      clearInterval(intervalId);
      console.info(`Stopped job: ${jobName}`);
    }

    this.intervals.clear();
    this.isRunning = false;

    console.info("Background job scheduler stopped");
  }

  /**
   * Schedule a recurring job
   */
  scheduleJob(name, callback, intervalMs, initialDelay = 0) {
    if (this.intervals.has(name)) {
      console.info(`Job ${name} is already scheduled`);
      return;
    }

    const runJob = async () => {
      try {
        console.info(`Running scheduled job: ${name}`);
        await callback();
        console.info(`Completed scheduled job: ${name}`);
      } catch (error) {
        console.error(`Error in scheduled job ${name}:`, error);
      }
    };

    // Run immediately if no initial delay, otherwise schedule first run
    if (initialDelay === 0) {
      runJob();
    } else {
      setTimeout(runJob, initialDelay);
    }

    // Schedule recurring runs
    const intervalId = setInterval(runJob, intervalMs);
    this.intervals.set(name, intervalId);

    console.info(
      `Scheduled job: ${name} (interval: ${intervalMs}ms, initial delay: ${initialDelay}ms)`,
    );
  }

  /**
   * Get the next run time for a specific hour and minute
   */
  getNextRunTime(hour, minute) {
    const now = new Date();
    const next = new Date();

    next.setHours(hour, minute, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime() - now.getTime();
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.intervals.keys()),
      jobCount: this.intervals.size,
    };
  }
}

// Create singleton instance
const scheduler = new Scheduler();

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.info("Received SIGTERM, stopping scheduler...");
  scheduler.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.info("Received SIGINT, stopping scheduler...");
  scheduler.stop();
  process.exit(0);
});

module.exports = scheduler;
