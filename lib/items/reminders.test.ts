import { afterEach, describe, expect, it } from "vitest";
import { fromLocalDateTime, toLocalDateTime } from "./reminders";

const timezone = process.env.TZ;
afterEach(() => {
  if (timezone === undefined) delete process.env.TZ;
  else process.env.TZ = timezone;
});
describe("revisit date boundaries", () => {
  it("round-trips local dates to ISO UTC", () => {
    process.env.TZ = "America/New_York";
    expect(fromLocalDateTime("2030-06-10T12:30")).toBe(
      "2030-06-10T16:30:00.000Z",
    );
    expect(toLocalDateTime("2030-06-10T16:30:00.000Z")).toBe(
      "2030-06-10T12:30",
    );
    expect(fromLocalDateTime("")).toBeUndefined();
  });
  it("rejects impossible calendar dates and nonexistent daylight-saving times", () => {
    process.env.TZ = "America/New_York";
    expect(() => fromLocalDateTime("2030-03-10T02:30")).toThrow(
      /does not exist/,
    );
    expect(() => fromLocalDateTime("2030-02-30T12:00")).toThrow();
    expect(() => fromLocalDateTime("tomorrow")).toThrow();
  });
  it("uses the earlier occurrence of an ambiguous fall-back hour", () => {
    process.env.TZ = "America/New_York";
    expect(fromLocalDateTime("2030-11-03T01:30")).toBe(
      "2030-11-03T05:30:00.000Z",
    );
  });
});
