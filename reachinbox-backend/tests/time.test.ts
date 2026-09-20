import { describe, it, expect } from "vitest";
import { computeSendTime, hourWindowKey, nextHourWindowStart, msUntilNextHour } from "../src/utils/time";

describe("computeSendTime", () => {
  it("spaces recipients by the configured delay", () => {
    const start = new Date("2026-09-20T10:00:00.000Z");
    expect(computeSendTime(start, 0, 2000).toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(computeSendTime(start, 1, 2000).toISOString()).toBe("2026-09-20T10:00:02.000Z");
    expect(computeSendTime(start, 3, 2000).toISOString()).toBe("2026-09-20T10:00:06.000Z");
  });

  it("handles zero delay (all at start time)", () => {
    const start = new Date("2026-09-20T10:00:00.000Z");
    expect(computeSendTime(start, 5, 0).getTime()).toBe(start.getTime());
  });
});

describe("hourWindowKey", () => {
  it("buckets timestamps within the same hour together", () => {
    const a = hourWindowKey(new Date("2026-09-20T10:00:00.000Z"));
    const b = hourWindowKey(new Date("2026-09-20T10:59:59.000Z"));
    const c = hourWindowKey(new Date("2026-09-20T11:00:00.000Z"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe("2026-09-20T10");
  });
});

describe("nextHourWindowStart / msUntilNextHour", () => {
  it("rolls over to the top of the next hour", () => {
    const now = new Date("2026-09-20T10:37:12.000Z");
    const next = nextHourWindowStart(now);
    expect(next.toISOString()).toBe("2026-09-20T11:00:00.000Z");
    expect(msUntilNextHour(now)).toBe(next.getTime() - now.getTime());
  });
});
