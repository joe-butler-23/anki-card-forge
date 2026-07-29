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
