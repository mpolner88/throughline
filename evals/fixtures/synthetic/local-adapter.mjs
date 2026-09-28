export default async function syntheticAdapter(input) {
  const bytes = await Deno.readFile(input.audio_path);
  if (bytes.byteLength === 0) throw new Error("synthetic_audio_empty");
  return {
    type: "freeform",
    title: "Synthetic note",
    summary: "A generated note for plumbing tests.",
    most_important: ["Verify plumbing"],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "neutral",
    people: [],
    projects: ["Throughline"],
    tags: ["synthetic"],
    centers_of_balance: ["profession"],
  };
}
