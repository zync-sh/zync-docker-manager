# Changelog

## 0.3.0

- Replace the command runner with host-owned interactive container terminals using
  the published SDK `2.1.0-beta.4` (`1a7f979`).
- Improve workspace navigation, inspector sizing, log controls, clipboard fallback
  and dropdown overlays; preserve terminal sessions across section changes (`d22cc74`).
- Fix search Escape handling and initial dropdown overlay synchronization. Host
  geometry browser tests skip when the sibling Zync checkout is unavailable.
- Document terminal integration and implementation references (`5a41875`).

This version requires a compatible Zync build with embedded plugin terminal and
overlay support. Publish marketplace metadata only after that host release is available.

## Unreleased

### Implementation references

- `1a7f979` — Host-owned interactive terminal integration and published SDK dependency.
- `d22cc74` — Workspace UX, terminal overlays, clipboard fallback and review regressions.

### Added

- Experimental embedded container shells using SDK 2.1.0-beta.4. Docker proposes fixed, validated argv; Zync owns approval, PTY input/output and the terminal surface. Each new session requires approval, not each typed command.
- Prepare the proposal automatically on entering Exec / Shell, removing the extra Prepare button without automatically starting or approving a session.
- Optional `ssh.terminal.open` permission and terminal identity, cancellation, fallback and slot-disposal regressions. This is a local integration candidate, not a marketplace release.

- Tag-based release workflow with separate tested-candidate, protected signing and publishing jobs; pinned publisher verification and signed ZIP/checksum artifacts.

- GitHub Actions checks on Ubuntu and Windows for formatting, tests, package validation and browser regressions, with unsigned candidate artifacts.
- Publisher-key reuse and local signing documentation; PR checks do not access signing secrets.

- Local unsigned Manifest v2 Docker Manager development plugin, with modular domain parsing, a permission-bound worker, and a responsive React workspace.
- Container search, filters, Compose/network grouping, metrics, logs, interactive shells, and native-confirmed container actions.
- Read-only images, networks, and volumes; responsive inspector, loading states, and masked environment values.
- Docker whale SVG from the supplied reference, with the wordmark removed.
- Host visibility handling to pause hidden metrics/log polling and refresh stale snapshots on return.
- Logic and browser regression coverage, including responsive layouts and hidden-pane polling.

### Changed

- Copy shell commands from a user gesture in sandboxed panes, with an explicit
  manual-copy message when clipboard access is blocked.

- Align shell toolbar/terminal gutters and register dropdown overlays through
  the published SDK, without moving or resizing the terminal. Synchronize already-open
  dropdowns immediately when their overlay registration effect starts.

- Escape clears a non-empty container search without triggering ancestor shortcuts;
  an empty search leaves Escape available to the workspace.

- Retain the selected container's terminal across detail-tab and resource-section
  navigation. Hide its surface without disposing the session; explicit close,
  container or connection changes still release it. Add navigation/cleanup coverage.

- Compact shell selection, fallback and close controls into one toolbar so the
  terminal fills the remaining inspector height. Updated Zync hosts request
  launch confirmation automatically when the shell surface appears.

- Refine workspace surfaces, container rows and group summaries. Add a resizable and expandable details panel, keyboard row navigation, inline quick start, per-container action progress and clearer resource search states.
- Add log wrap, timestamp visibility, explicit follow and copy controls; preserve reading position across refreshes. Collapse the separate-terminal fallback to give the embedded shell more room.
- Keep view preferences in available browser storage with an in-memory fallback for isolated panes. Direct log file export remains deferred until Zync exposes a supported host download API.

- Exec / Shell now opens the interactive-only UI directly. Remove the one-shot command runner, history, output renderer and worker/client execution path; retain a copied-command fallback for unsupported hosts.

- Consistent LF checkouts keep Windows formatting checks aligned with Ubuntu; narrow headers wrap enhanced controls without horizontal overflow.

- Expired or canceled requests are checked before dispatch; pending approval no longer blocks SSH reads in other panes. Commands already dispatched cannot be undone.
- Shared container-state rules offer Stop for restarting containers, disable unsupported paused-state actions, and filter group actions to eligible targets.

- Shared worker request pacing across panes, without automatic mutation retries.
- Sandbox-safe command input without HTML form submission or broader iframe permissions.
- Confirmed completion counts survive batch transport failures; phased operator-workflow roadmap documented.

- Docker-logo loading indicator, themed scrollbars, and shared accessible dropdowns/tooltips.
- Whole-group actions run in confirmed batches; stopped-container removal keeps volumes and stops batching on cancellation or failure.
- Larger command output, automatic output scrolling, command-input focus, and clearer non-interactive shell guidance.

The plugin remains unpublished and unsigned. This initial development snapshot does not constitute a marketplace release.
