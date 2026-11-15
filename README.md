# OpenFox Workflow Visualizer

> **Status: native OpenFox feature validated locally; standalone community plugin not yet packaged.**

A compact, read-only view of an OpenFox workflow while it runs: see the current step, execution graph, and iteration counters directly from the chat, without opening the workflow editor.

**Français :** visualisation en direct de l'étape active, du graphe et des compteurs d'itérations des workflows OpenFox. L'implémentation actuelle est **native** et n'est pas encore un plugin installable depuis le Hub.

## What it does

- Shows a compact **WorkflowBar** in the chat while a workflow executes.
- Opens the workflow graph on hover, click, or keyboard interaction.
- Highlights the active workflow step and displays iteration progress.
- Preserves iteration information across workflow state updates.
- Resolves the actual workflow scope instead of displaying a shadowing definition.
- Keeps the visualizer read-only, with minimal additional server notifications.

The visualizer is an interface aid, **not** a workflow executor or an automation engine.

## Architecture and compatibility

The first implementation modifies the OpenFox core (React UI, workflow execution state, server events). The current `openfox/plugin` API v2 supports declarative UI slots, panels and iframe assets, but **does not let a plugin replace arbitrary React internals**. A package consisting only of a manifest or README would therefore not provide this experience.

**Consequently, this repository is not yet installable as an OpenFox plugin.** Do not attempt `npm install openfox-workflow-visualizer` or install this repository from the Plugins tab until a working v2 entry point has been implemented and tested.

Native implementation: [feature branch in the OpenFox fork](https://github.com/theshwal/openfox/tree/feat/workflow-visualizer-native). This branch is intended to be submitted as a pull request to [co-l/openfox](https://github.com/co-l/openfox), targeting `develop`. No release/version compatibility claim is made before upstream review.

## Verification

The native implementation has been checked with:

| Verification | Result |
| --- | --- |
| Targeted component / server tests | 150 passed |
| TypeScript (server and web) | Passed |
| ESLint | Passed |
| Acceptance criteria | 12 / 12 |
| Independent code-review findings | 9 / 9 resolved |
| Chromium / Playwright E2E (local patched build, mock provider) | Passed, exit code 0 |

The E2E scenario launched a workflow through the chat, displayed the workflow bar, opened its SVG graph, confirmed the active step and iteration counter, and exercised click and Escape interactions. Screenshots and the `result.json` report were generated on the OpenFox Lab development machine.

**Not yet demonstrated by that E2E:** actual resume after a pause, browser reload, multi-session isolation, or a production deployment. The E2E used a temporary local server with an in-memory database and a mock LLM provider.

## How to try the native version

For contributors who want to evaluate the patch **before it merges upstream**:

1. Review the [native feature branch](https://github.com/theshwal/openfox/tree/feat/workflow-visualizer-native) and its pull request before running code.
2. Build and run it using the matching instructions and runtime requirements in the [OpenFox repository](https://github.com/co-l/openfox).
3. Open a session and launch a workflow such as `Build & Verify`; the bar and diagram appear while the workflow executes.

This is a **source build**, not a Plugins-tab installation.

## Roadmap to the Community Hub

- [x] Prototype and validate the native behavior.
- [x] Validate an actual browser interaction with Chromium and capture screenshots.
- [ ] Complete upstream native-feature review and integration.
- [ ] Design a **genuinely installable** plugin around supported `openfox/plugin` v2 UI / RPC / asset contracts, or have the host expose the minimal extension point needed.
- [ ] Add a versioned `package.json` with an accurate `openfox.apiVersion: 2`, capabilities and ESM entry point **when functional code exists**.
- [ ] Test installation, enable/disable/re-enable, and uninstall on a fresh OpenFox instance.
- [ ] Add a plugin-specific README screenshot/GIF, automated tests, release notes and a license.
- [ ] Make the distributable repository public when approved.
- [ ] Propose a curated listing by pull request to the official `plugins-registry.json` with name, displayName, description and githubUrl.

The [OpenFox Community Hub](https://github.com/JamesDAdams/openfox-community-hub) also distributes workflow, agent, skill and command content. This native UI feature is not one of those shareable content packs, and should not be listed there as though it were.

## Privacy and security

The visualizer displays workflow/session metadata already used by OpenFox. It does not need external telemetry or a third-party service. The E2E verification used synthetic test data and a mock LLM. As with other OpenFox plugins, any future v2 package runs in-process and must be reviewed before installation.

## Contributing

Contributions and usability reports are welcome. Please keep native OpenFox changes in the upstream pull request and separate plugin packaging work in this repository. Include reproducible tests for behavior changes, and do not commit secrets, local session databases, Playwright caches or generated test logs.

## License

**Not yet selected for this standalone repository.** Community redistribution should wait until an appropriate license is explicitly added. The native upstream contribution is subject to the upstream repository's applicable contribution and licensing requirements.

## References

- [OpenFox plugin authoring guide](https://github.com/co-l/openfox/blob/develop/docs/PLUGINS.md)
- [OpenFox plugin architecture](https://github.com/co-l/openfox/blob/develop/docs/PLUGIN-ARCHITECTURE.md)
- [OpenFox curated plugin registry](https://github.com/co-l/openfox/blob/develop/plugins-registry.json)
