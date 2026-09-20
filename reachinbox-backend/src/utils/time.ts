/**
 * Returns the send time for the Nth (0-indexed) recipient in a batch, given a start
 * time and a fixed delay between emails. This is a pure function so it's trivially
 * testable and reused both when creating jobs and when re-deriving delays after a
 * rate-limit reschedule.
 */
export function computeSendTime(startTime: Date, index: number, delayBetweenEmailsMs: number): Date {
  return new Date(startTime.getTime() + index * delayBetweenEmailsMs);
}

/**
 * Hour-window bucket key for a given date, e.g. "2026-09-20T10". Used as the Redis
 * key suffix for hourly rate limit counters and Slack de-dupe flags, so all sends
 * within the same UTC hour share the same counter.
 */
export function hourWindowKey(date: Date): string {
  return date.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

/** Start of the next hour window after the given date. */
export function nextHourWindowStart(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

/** Milliseconds remaining until the current hour window (of `date`) elapses. */
export function msUntilNextHour(date: Date): number {
  return nextHourWindowStart(date).getTime() - date.getTime();
}
