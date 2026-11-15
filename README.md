# OpenFox Workflow Visualizer

An **in-chat workflow indicator for OpenFox**, shipped as a real `openfox/plugin` **API v2** package: when a workflow runs, the plugin shows the workflow name, the current step and the engine's exact iteration counters **above the chat composer** — no React patching, no DOM hacking, no monkey patching.

> Status: **v0.1.0 — working, installable plugin, early.** The full graphical diagram (nodes + edges + active highlight) exists as a **native core feature** and is proposed upstream in [co-l/openfox#465](https://github.com/co-l/openfox/pull/465) (draft). This repository is the plugin that works **today**, within the current plugin contract.

---

## What it does

- Contributes a **`composer.top`** zone component (above the composer) through `registerUiComponent` + an RPC content source refreshed every 1.5 s.
- Listens to the **`workflow.execution.changed`** hook to cache, **per session**, the engine's own values: workflow name, status, current step, `iterations`, `totalIterations`, `maxIterations`, `stepIterations`, `workflowScope`.
- Shows **nothing** when no workflow is running (the zone stays empty — no reserved space).
- Ships a **declarative panel** ("Workflow progress") listing the engine-observed per-step run counts, with the current step marked.
- Never invents data: an absent counter stays absent; an unknown step count is reported as unknown.

### What it does *not* do (honest limits)

| Limitation | Reason |
| --- | --- |
| No SVG diagram / edges | Panel content in API v2 is static (`content: DeclarativeNode[]`), it has no RPC content source; an iframe panel would need an RPC bridge that the contract does not expose yet. The visual graph is proposed natively in upstream PR #465. |
| The bar can appear after the first workflow event | The hook cache lives in the plugin process; on host restart the bar repopulates at the next `workflow.execution.changed`. There is no public "read the current execution" API for plugins yet. |
| Counters appear when the event carries them | Some early events (e.g. `startWorkflow`) carry no counters; the counter line then appears at the next step event. |
| `reinstall` does not refresh a changed source | Use **uninstall → install** to pick up plugin code changes (host behaviour, verified). |

Both gaps are addressed by a small, generic proposal at the end of this README.

---

## Compatibility

- **OpenFox ≥ 2.0.161** (`peerDependencies`), plugin **`apiVersion: 2`**.
- Verified against a locally built OpenFox `develop` @ `0694574` (the tree used for PR #465): plugin loaded, enabled, disabled, re-enabled and uninstalled through the real API; RPC served live workflow data in a real Chromium session.
- Uses only: `registerHook`, `registerRpc`, `registerUiComponent`, `registerUiPanel`. No `registerUiOverride`, no assets, no tools, no network, no telemetry.

## Installation

### From Settings → Plugins (GitHub URL)

1. Open **Settings → Plugins**.
2. **Install from GitHub** and paste:

   ```
   https://github.com/theshwal/openfox-workflow-visualizer
   ```

3. Enable the plugin, then start any workflow. The bar appears above the composer.

### From a local checkout (development)

```bash
git clone https://github.com/theshwal/openfox-workflow-visualizer
# then, in OpenFox: Settings → Plugins → Install from path
#   /absolute/path/to/openfox-workflow-visualizer
# or through the API:
curl -X POST http://localhost:<port>/api/plugins/install \
  -H 'content-type: application/json' \
  -d '{"path":"/absolute/path/to/openfox-workflow-visualizer"}'
```

> Do **not** use `hub_install` for this plugin: the Community Hub registry indexes workflow/agent/skill/MCP **packs**, not plugin packages.

## Usage

Start a workflow (chat slash command such as `/default`, or the workflow launcher). While it runs:

- **Above the composer**: `Build & Verify · <current step> · iteration 3/50` — a resumed run also shows `· 12 total`.
- **Panel "Workflow progress"**: status, scope, and the per-step run counts reported by the engine.

## Tests

```bash
npm install
npm test          # 22 unit/integration tests, no host required
npm pack --dry-run
```

Coverage: registry registration (zone, RPC, hook, panel), RPC ↔ hook integration, per-session isolation, late-event rejection from a replaced execution, empty state, counter formatting (cap, cumulative total, singular), step ordering, and "never invent a counter".

Real-environment verification (outside this repo's test suite):

- Plugin installed from path on an isolated OpenFox instance (mock LLM, in-memory DB): `loaded: true`, `apiVersion: 2`.
- Lifecycle: `disable` → `enable` → `uninstall` → `install` all HTTP 200.
- Chromium (Playwright) run launching a real workflow: the plugin RPC returned `{"type":"badge","label":{"en":"Build & Verify"},"tone":"info"}` plus the current step — i.e. the hook → cache → RPC → zone chain works end to end. Screenshot: [`docs/plugin-in-chat.png`](docs/plugin-in-chat.png).

## Privacy & security

- **No network calls**, no telemetry, no analytics, no remote code.
- Reads only the hook payloads the host already broadcasts; caches them **in memory**, keyed by session id. Nothing is written to disk, no secrets, no environment access.
- Renders exclusively through the host's declarative node renderer: no HTML injection, no `eval`, no DOM access.
- Least privilege: declares only `ui`, `hooks`, `rpc`.

## Architecture

```
src/index.js   register(registry): hook + 2 RPCs + composer.top component + panel
src/state.js   pure cache + declarative view builders (unit-tested, host-free)
```

The plugin is a thin, honest adapter over the v2 contract — see [`docs/PLUGINS.md`](https://github.com/co-l/openfox/blob/develop/docs/PLUGINS.md) upstream.

### Proposed generic extension point (for the OpenFox core team)

Two small additions would close the gaps above without any per-plugin hacks:

1. `PluginUiPanel.contentSource?: PluginUiContentSource` — lets a panel refresh from RPC, enabling a live declarative graph.
2. A read-only `context.sessions.activeWorkflow(sessionId)` (or an RPC-visible snapshot) — lets a plugin restore its bar after a host reload without waiting for the next event.

## Roadmap

- [ ] Live graph panel (SVG) once panels support `contentSource`, or via a documented iframe RPC bridge.
- [ ] Restore state on host reload (needs the read API above).
- [ ] Optional badge / notification on workflow completion.
- [ ] Publish to the Community Hub "Related OpenFox plugins" section once the install flow is battle-tested.

## Relationship to upstream PR #465

[co-l/openfox#465](https://github.com/co-l/openfox/pull/465) is a **native core** feature (WorkflowBar in chat, SVG graph, iteration persistence, scope propagation). It is a **draft**, not merged, and not required by this plugin. This plugin reproduces the *behaviour that the current plugin API allows*, and documents what only a native change can deliver.

## Contributing

Issues and PRs welcome. Please:

- keep the plugin dependency-free at runtime (ESM only, no bundler),
- add a unit test for every behaviour change (`npm test`),
- never widen capabilities without documenting why.

## License

MIT — see [LICENSE](LICENSE).
