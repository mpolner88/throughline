import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const requiredFiles = [
  ".claude/skills/ui-handoff/SKILL.md",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "app-store/screenshots/iphone-6.9/README.md",
  "decision-log.md",
  "docs/ARCHITECTURE.md",
  "docs/AGENT_TANDEM.md",
  "docs/CURRENT_STATE.md",
  "docs/PRODUCT.md",
  "docs/WORKFLOW.md",
  "docs/handoffs/README.md",
  "docs/hosted-backend.md",
  "docs/releases/README.md",
  "docs/releases/TEMPLATE.md",
  "docs/prompts/claude-code-ui-design.md",
  "docs/templates/UI_DESIGN_HANDOFF.md",
  "product/README.md",
  "product/backlog.json",
  "product/metrics.md",
  "throughline-brand-decisions.md"
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    errors.push(`missing canonical file: ${file}`);
  }
}

let backlog;
try {
  backlog = JSON.parse(readFileSync(join(root, "product/backlog.json"), "utf8"));
} catch (error) {
  errors.push(`invalid product/backlog.json: ${error.message}`);
}

if (backlog) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const states = new Set(backlog.states ?? []);
  const items = Array.isArray(backlog.items) ? backlog.items : [];
  const itemIDs = new Set();
  const requiredItemFields = [
    "id",
    "title",
    "type",
    "state",
    "problem",
    "evidence",
    "primary_metric",
    "guardrail",
    "authority",
    "dependencies",
    "next_action"
  ];

  if (!datePattern.test(backlog.updated_at ?? "")) {
    errors.push("backlog updated_at must be YYYY-MM-DD");
  }

  if (!Array.isArray(backlog.states) || states.size !== backlog.states.length) {
    errors.push("backlog states must be a unique array");
  }

  if (backlog?.portfolio_rules?.priority_owner !== "Mike") {
    errors.push("backlog portfolio_rules.priority_owner must preserve Mike's priority authority");
  }

  if (!datePattern.test(backlog?.next_portfolio_decision?.as_of ?? "")) {
    errors.push("backlog next_portfolio_decision.as_of must be YYYY-MM-DD");
  }

  if (backlog?.next_portfolio_decision?.owner !== "Mike") {
    errors.push("backlog next_portfolio_decision.owner must name Mike");
  }

  if (!["unselected", "selected", "deferred"].includes(backlog?.next_portfolio_decision?.status)) {
    errors.push("backlog next_portfolio_decision.status must be unselected, selected, or deferred");
  }

  if (!backlog?.next_portfolio_decision?.question) {
    errors.push("backlog next_portfolio_decision must name the current question");
  }

  for (const item of items) {
    const label = item?.id ?? "<missing id>";

    for (const field of requiredItemFields) {
      if (item?.[field] === undefined || item?.[field] === "") {
        errors.push(`${label} is missing ${field}`);
      }
    }

    if (!/^TL-[A-Z]+-\d{3}$/.test(item?.id ?? "")) {
      errors.push(`${label} has an invalid id`);
    } else if (itemIDs.has(item.id)) {
      errors.push(`duplicate backlog id: ${item.id}`);
    } else {
      itemIDs.add(item.id);
    }

    if (!states.has(item?.state)) {
      errors.push(`${label} uses undeclared backlog state: ${item?.state}`);
    }

    if (!datePattern.test(item?.evidence?.as_of ?? "")) {
      errors.push(`${label} evidence.as_of must be YYYY-MM-DD`);
    } else if (item.evidence.as_of > backlog.updated_at) {
      errors.push(`${label} evidence.as_of is newer than backlog updated_at`);
    }

    if (!Array.isArray(item?.dependencies)) {
      errors.push(`${label} dependencies must be an array`);
    }
  }

  const byID = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    for (const dependency of item.dependencies ?? []) {
      if (!byID.has(dependency)) {
        errors.push(`${item.id} references missing dependency: ${dependency}`);
      }
      if (dependency === item.id) {
        errors.push(`${item.id} depends on itself`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) {
      errors.push(`backlog dependency cycle: ${[...path, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;

    visiting.add(id);
    for (const dependency of byID.get(id)?.dependencies ?? []) {
      if (byID.has(dependency)) visit(dependency, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byID.keys()) visit(id);
}

const markdownFiles = [
  ".claude/skills/ui-handoff/SKILL.md",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/AGENT_TANDEM.md",
  "docs/CURRENT_STATE.md",
  "docs/PRODUCT.md",
  "docs/WORKFLOW.md",
  "docs/app-store-readiness.md",
  "docs/hosted-backend.md",
  "docs/handoffs/README.md",
  "docs/launch-marketing.md",
  "docs/releases/README.md",
  "docs/releases/TEMPLATE.md",
  "docs/prompts/claude-code-ui-design.md",
  "docs/templates/UI_DESIGN_HANDOFF.md",
  "product/README.md",
  "product/metrics.md",
  "throughline-brand-decisions.md"
];
const sliceFiles = [];

for (const directory of ["docs/history", "docs/programs", "docs/slices"]) {
  for (const file of readdirSync(join(root, directory))) {
    if (extname(file) !== ".md") continue;
    const repositoryPath = join(directory, file);
    markdownFiles.push(repositoryPath);
    if (directory === "docs/slices") sliceFiles.push(repositoryPath);
  }
}

for (const directory of ["marketing", "marketing/agents", "marketing/assets", "marketing/experiments"]) {
  for (const file of readdirSync(join(root, directory))) {
    if (extname(file) === ".md") markdownFiles.push(join(directory, file));
  }
}

if (backlog) {
  const compatiblePhases = new Map([
    ["collecting_evidence", new Set(["baseline"])],
    ["ready_for_mock", new Set(["candidate"])],
    ["awaiting_mock_approval", new Set(["candidate", "selected", "design_approved"])],
    ["approved_for_build", new Set(["selected", "design_approved", "planned", "building", "canary"])],
    ["shipped", new Set(["canary", "measuring"])],
    ["measuring", new Set(["measuring", "iterate"])],
    ["closed", new Set(["closed"])]
  ]);
  const backlogByID = new Map(backlog.items.map((item) => [item.id, item]));

  for (const file of sliceFiles) {
    const source = readFileSync(join(root, file), "utf8");
    const backlogState = source.match(/^\*\*Backlog state:\*\* `([^`]+)`/m)?.[1];
    const slicePhase = source.match(/^\*\*Slice phase:\*\* `([^`]+)`/m)?.[1];
    const backlogID = source.match(/^\*\*Backlog:\*\* `([^`]+)`/m)?.[1];

    if (!backlogState || !backlog.states.includes(backlogState)) {
      errors.push(`${file} is missing a declared backlog state`);
    }
    if (!slicePhase) {
      errors.push(`${file} is missing a slice phase`);
    } else if (!compatiblePhases.get(backlogState)?.has(slicePhase)) {
      errors.push(`${file} has incompatible backlog state and slice phase: ${backlogState}/${slicePhase}`);
    }
    if (/^\*\*Status:\*\*/m.test(source)) {
      errors.push(`${file} uses ambiguous bare Status instead of named state fields`);
    }
    if (backlogID) {
      const backlogItem = backlogByID.get(backlogID);
      if (!backlogItem) {
        errors.push(`${file} references missing backlog item: ${backlogID}`);
      } else if (backlogItem.state !== backlogState) {
        errors.push(`${file} disagrees with ${backlogID}: ${backlogState}/${backlogItem.state}`);
      }
    }
  }
}

const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const source = readFileSync(join(root, file), "utf8");
  for (const match of source.matchAll(markdownLink)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.split("#", 1)[0].split("?", 1)[0];

    if (!target || /^(https?:|mailto:|data:)/.test(target)) continue;
    if (target.startsWith("file:") || isAbsolute(target)) {
      errors.push(`${file} contains an absolute local link: ${target}`);
      continue;
    }

    let decodedTarget = target;
    try {
      decodedTarget = decodeURIComponent(target);
    } catch {
      errors.push(`${file} contains an invalid encoded link: ${target}`);
      continue;
    }

    const destination = resolve(root, dirname(file), decodedTarget);
    if (!existsSync(destination)) {
      errors.push(`${file} contains a missing local link: ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Repository foundation verification failed:");
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Repository foundation verified: ${backlog.items.length} backlog items, ${markdownFiles.length} checked Markdown files.`
);
