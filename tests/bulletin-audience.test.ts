import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findNextUpcomingBulletin,
  isBulletinVisibleToAudience,
  isUpcomingBulletin,
} from "../shared/bulletin-audience.ts";

describe("bulletin audience", () => {
  it("only includes bulletins connected to one of the user's groups", () => {
    assert.equal(
      isBulletinVisibleToAudience(
        { groups: ["group-a"] },
        ["group-a"],
        ["Beginners"],
      ),
      true,
    );
    assert.equal(
      isBulletinVisibleToAudience(
        { groups: ["group-b"] },
        ["group-a"],
        ["Beginners"],
      ),
      false,
    );
  });

  it("supports legacy group names without exposing hidden bulletins", () => {
    assert.equal(
      isBulletinVisibleToAudience(
        { group: ["Beginners"] },
        ["group-a"],
        ["Beginners"],
      ),
      true,
    );
    assert.equal(
      isBulletinVisibleToAudience(
        { group: ["Beginners"], hidden: true },
        ["group-a"],
        ["Beginners"],
      ),
      false,
    );
  });
});

describe("upcoming bulletin events", () => {
  it("keeps date-only events visible through their final day", () => {
    const now = new Date(2026, 5, 20, 18, 0);
    assert.equal(
      isUpcomingBulletin(
        { date: "2026-06-19", endDate: "2026-06-20" },
        now,
      ),
      true,
    );
  });

  it("selects the earliest upcoming event", () => {
    const next = findNextUpcomingBulletin(
      [
        { title: "Later", date: "2026-07-10" },
        { title: "Past", date: "2026-06-01" },
        { title: "Next", date: "2026-06-25" },
      ],
      new Date(2026, 5, 20, 12, 0),
    );

    assert.equal(next?.title, "Next");
  });
});
