import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPerSessionSignupEvent,
  getSessionSelectionChange,
} from "../shared/activity-log.ts";

describe("per-session selection activity", () => {
  it("reports added, removed, and resulting session ids deterministically", () => {
    assert.deepEqual(
      getSessionSelectionChange(
        ["session-2", "session-1"],
        ["session-3", "session-2"],
      ),
      {
        addedSessionIds: ["session-3"],
        removedSessionIds: ["session-1"],
        resultingSessionIds: ["session-2", "session-3"],
      },
    );
  });

  it("does not create a change for an unchanged selection", () => {
    assert.equal(
      getSessionSelectionChange(
        ["session-2", "session-1"],
        ["session-1", "session-2"],
      ),
      null,
    );
  });

  it("builds a readable generic event with stable metadata", () => {
    const change = getSessionSelectionChange(
      ["session-1"],
      ["session-2", "session-3"],
    );
    assert.ok(change);

    const event = buildPerSessionSignupEvent({
      studentId: "student-1",
      studentName: "Alex Rivera",
      classId: "class-1",
      className: "Summer Dance",
      actorId: "user-1",
      change,
    });

    assert.equal(event.entityType, "student");
    assert.equal(event.entityId, "student-1");
    assert.equal(event.actorId, "user-1");
    assert.equal(event.eventType, "per_session_signup_updated");
    assert.match(event.summary, /Alex Rivera's Summer Dance/);
    assert.match(event.summary, /added 2/);
    assert.match(event.summary, /removed 1/);
    assert.deepEqual(event.metadata, {
      classId: "class-1",
      addedSessionIds: ["session-2", "session-3"],
      removedSessionIds: ["session-1"],
      resultingSessionIds: ["session-2", "session-3"],
    });
    assert.equal("createdAt" in event, false);
  });
});
