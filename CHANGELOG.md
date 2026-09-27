# Changelog

## Unreleased

### Added

- Tag-based release workflow with separate tested-candidate, protected signing and publishing jobs; pinned publisher verification and signed ZIP/checksum artifacts.

- GitHub Actions checks on Ubuntu and Windows for formatting, tests, package validation and browser regressions, with unsigned candidate artifacts.
- Publisher-key reuse and local signing documentation; PR checks do not access signing secrets.

- Local unsigned Manifest v2 Docker Manager development plugin, with modular domain parsing, a permission-bound worker, and a responsive React workspace.
- Container search, filters, Compose/network grouping, metrics, logs, bounded shell commands, and native-confirmed container actions.
- Read-only images, networks, and volumes; responsive inspector, loading states, and masked environment values.
- Docker whale SVG from the supplied reference, with the wordmark removed.
- Host visibility handling to pause hidden metrics/log polling and refresh stale snapshots on return.
- Logic and browser regression coverage, including responsive layouts and hidden-pane polling.

### Changed

- Expired or canceled requests are checked before dispatch; pending approval no longer blocks SSH reads in other panes. Commands already dispatched cannot be undone.
- Shared container-state rules offer Stop for restarting containers, disable unsupported paused-state actions, and filter group actions to eligible targets.

- Shared worker request pacing across panes, without automatic mutation retries.
- Sandbox-safe command input without HTML form submission or broader iframe permissions.
- Confirmed completion counts survive batch transport failures; phased operator-workflow roadmap documented.

- Docker-logo loading indicator, themed scrollbars, and shared accessible dropdowns/tooltips.
- Whole-group actions run in confirmed batches; stopped-container removal keeps volumes and stops batching on cancellation or failure.
- Larger command output, automatic output scrolling, command-input focus, and clearer non-interactive shell guidance.

The plugin remains unpublished and unsigned. This initial development snapshot does not constitute a marketplace release.
