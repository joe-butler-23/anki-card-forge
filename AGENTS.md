# Purpose — anki-forge-app

`anki-forge-app` turns material the learner already understands into a small, high-quality Anki card set with minimal effort. It provides an Electron generation-and-review workflow and a local MCP review bridge.

Success means candidate cards remain reviewable drafts until the learner explicitly approves them; only approved content reaches the intended local Anki deck; generation, review, and delivery failures remain visible; and no path performs an AnkiWeb sync or silently retries an ambiguous write.

## Workflow

- The Electron app requires an authenticated Codex CLI plus Anki running locally with AnkiConnect. The learner selects a topic and deck, supplies notes or images, generates candidates, reviews or edits each card, rejects unsuitable cards, and delivers only the approved set.
- The MCP bridge supports Codex Desktop study sessions. It reviews and delivers proposed cards but does not generate them, bypass learner approval, or sync AnkiWeb.

## Product Boundaries

- Learner review is the authority. Generation, rendering, validation, or queueing does not imply approval. Editing a card returns it to pending review, and rejected or unresolved cards must never cross an Anki write boundary.
- AnkiConnect endpoints must remain localhost-only. Treat every `addNotes` operation as non-idempotent: preflight where possible, never retry after an ambiguous result, and tell the user to inspect Anki if the result or receipt is uncertain.
- The MCP write path accepts only the exact reviewed deck, model, front, back, and tags bound to a short-lived one-time token from `validate_reviewed_cards`. Reject invalid or duplicate batches before calling AnkiConnect.
- `src/prompts/topics.json` owns shipped prompt defaults. User prompt overrides and backups are runtime data under Electron’s user-data directory; preserve them and do not copy them into the repository.

## Architecture

- `electron/` owns the privileged desktop main process: Codex CLI execution, prompt persistence, the window and IPC boundary, and the private per-user card-packet inbox. `electron/preload.js` is the renderer capability allowlist.
- `src/` owns the React workflow, review state, and renderer-side localhost AnkiConnect path. `mcp/` owns the optional stdio server, embedded review widget, reviewed-payload token, and Electron inbox client.
- The Electron and MCP paths have separate schemas, sanitizers, and AnkiConnect clients. Changes to card models, fields, tags, sanitisation, review states, duplicate handling, or write semantics must reconcile both paths explicitly and add regression coverage.
- This repository owns source and its flake package. `~/nix-config` owns the installed system runtime and launcher.

## Verification

```bash
nix develop -c npm ci
npm test
npm run build
nix build --no-link '.#'
```

With Anki and AnkiConnect running, `npm run mcp:smoke` must prove the MCP transport, complete tool inventory, widget resource, local connection, deck lookup, and dry-run validation without adding a note.

For user-facing changes, run `npm run electron:dev` and inspect the actual Electron surface. Exercise the affected generation, review, editing, rejection, and delivery path. Perform a real Anki write only with explicit authority, then confirm that approved cards appear exactly once and unresolved cards do not appear.

For installed-runtime proof, update the source pin in `~/nix-config`, run `ns`, launch the system `anki-card-forge`, and verify the affected surface there.

<!-- clai:instructions:coding:start -->
<!-- source-sha256:125fbd0ba45f15bcd8964ecd8bb5dd139da49002dbaf2db8229a6156593a274e -->
## Engineering Principles

- **Modern and idiomatic:** Use current, supported language, framework, and platform conventions. Match surrounding code when it is sound; do not reproduce obsolete patterns merely for consistency.
- **Lean end state:** Implement the intended final design directly. Remove superseded code, compatibility paths, shims, flags, dependencies, tests, comments, documentation, and configuration unless compatibility or migration is an explicit requirement. Git preserves history; current files describe only the current system.
- **Simple and explicit:** Use the least code and fewest moving parts that solve the problem. Prefer clear contracts, bounded resources, observable state, and existing project or platform primitives over speculative abstractions.
- **Efficient by design:** Avoid repeated work and unnecessary process, file, database, or network round trips. Reuse long-lived resources, batch small operations, stream large inputs, and keep concurrency, buffering, and retries bounded.
- **Evidence-led performance:** Set budgets and measure realistic workloads before optimizing. Fix algorithms, I/O, contention, and lifecycle design before micro-optimizing.
- **Risk-proportionate verification:** Define success before editing. Run the cheapest sufficient checks first and escalate according to risk. Bugs require regression coverage, and completion requires evidence at the surface the user cares about.
- **Timing and state:** Use time to model time, not to infer state. When work involves polling, debounce, readiness, timeouts, TTLs, cooldowns, throttling, retries, scheduling, animation timing, or event delivery, load the `timer-inference` skill.
<!-- clai:instructions:coding:end -->
