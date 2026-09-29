import test from "node:test";
import assert from "node:assert/strict";

import { normalizeExtraction } from "./extraction-pipeline.mjs";

test("normalization fills title and summary when the model omits them", () => {
  const note = normalizeExtraction({
    type: "freeform",
    title: "",
    summary: "",
    most_important: ["Call the dentist", "Review onboarding analytics"],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "neutral",
    people: [],
    projects: ["Onboarding"],
    tags: ["launch"],
    centers_of_balance: ["profession"],
  });

  assert.equal(note.title, "Call the dentist");
  assert.equal(note.summary, "Call the dentist. Review onboarding analytics");
});

test("normalization preserves valid model title and summary", () => {
  const note = normalizeExtraction({
    type: "morning",
    title: "Launch morning",
    summary: "Finish the small release and verify it.",
    most_important: [],
    todos: [{ text: "Verify the release", priority: "high" }],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "focused",
    people: [],
    projects: ["Throughline"],
    tags: ["launch"],
    centers_of_balance: ["profession"],
  });

  assert.equal(note.title, "Launch morning");
  assert.equal(note.summary, "Finish the small release and verify it.");
  assert.equal(note.todos[0].text, "Verify the release");
});

test("only explicit todos become checkable action items", () => {
  const note = normalizeExtraction({
    type: "morning",
    title: "Plan the day",
    summary: "The user wants to feel more organized.",
    most_important: ["The user wants to feel more organized"],
    todos: [{ text: "Call the dentist", priority: "high" }],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "focused",
    people: [],
    projects: [],
    tags: [],
    centers_of_balance: [],
  });

  assert.deepEqual(
    note.action_items.map(({ text, source }) => ({ text, source })),
    [{ text: "Call the dentist", source: "todo" }],
  );
});

test("normalization remains byte-for-byte stable across the shared-contract refactor", () => {
  const note = normalizeExtraction({
    type: "morning",
    title: "  Launch morning  ",
    summary: "",
    most_important: [],
    todos: [{
      text: "Verify the release",
      status: "done",
      priority: "high",
      due: "today",
      for_date: "tomorrow",
      context: "  After deployment  ",
    }],
    priorities: ["Ship the release", " Ship the release "],
    intentions: ["Keep it small"],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "focused",
    people: [],
    projects: ["Throughline"],
    tags: ["launch"],
    centers_of_balance: ["profession", "unsupported"],
  }, { user_local_date: "2026-08-22" });

  assert.equal(
    JSON.stringify(note),
    JSON.stringify({
      type: "morning",
      title: "Launch morning",
      summary: "Ship the release. Verify the release",
      most_important: [
        "Ship the release",
        "Verify the release",
        "Keep it small",
      ],
      todos: [{
        text: "Verify the release",
        status: "open",
        priority: "high",
        due: "2026-08-22",
        for_date: "2026-08-23",
        context: "After deployment",
      }],
      priorities: ["Ship the release", "Ship the release"],
      intentions: ["Keep it small"],
      accomplishments: [],
      tomorrow_todos: ["Verify the release"],
      mood: "focused",
      people: [],
      projects: ["Throughline"],
      tags: ["launch"],
      centers_of_balance: ["profession"],
      action_items: [{
        id: "act_verify-the-release",
        text: "Verify the release",
        status: "open",
        source: "todo",
        completed_at: null,
      }],
    }),
  );
});
