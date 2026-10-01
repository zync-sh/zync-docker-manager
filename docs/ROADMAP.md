# Docker Manager roadmap

## Goal and current scope

Support monitor → investigate → act safely on the pane's server. Today the plugin
has container search, Compose/network grouping, metrics, inspection, logs,
confirmed actions and read-only image/volume/network lists. Grouping is not Compose
management. The local terminal candidate replaces the bounded command runner.

## Phase 1 — Reliability (in progress)

- [x] Explicit button/Enter command execution without HTML forms or `allow-forms`.
- [x] Shared privileged-request pacing across all panes in the worker runtime.
- [x] Five-container confirmation batches; stop on cancellation or failure.
- [x] Preserve confirmed completions after later transport errors; never retry
      mutations automatically when their outcome is uncertain.
- [x] Docker loading logo, themed scrollbars, shared dropdowns and tooltips.
- [ ] Real Zync sandbox smoke test on disposable containers.
- [ ] Concurrent multi-pane testing against the host request budget.
- [ ] Per-container results and explicit cancellation between batches.

Exit: group operations finish reliably, partial outcomes are understandable, and
operators refresh before deciding whether to retry uncertain changes.

## Phase 2 — Investigation

Exit codes, OOM status, restart counts, health-check output and recent events.
Logs need follow/pause, search, timestamps, copy/export and explicit truncation.
Explain failures using evidence rather than guessing their cause.

Interactive container terminals should open a native terminal pane with resize
and input support. This requires a supported, permission-scoped Zync capability;
do not hardcode workspace layout or grant iframe access to host internals. Keep
the copied-command fallback until that capability is available.

### Embedded terminal integration candidate

The local candidate uses the published SDK 2.1.0-beta.4 and the updated Zync checkout.
Exec / Shell directly shows the terminal UI and automatically prepares an offer
for the selected sh/bash shell, without launching a process.
The worker verifies the connection token, Docker daemon and running container;
only fixed `docker exec -it <full-container-id> /bin/sh` (or `/bin/bash`) argv
can be proposed. When the surface is visible, the updated host opens its trusted
confirmation automatically; approve the session there. Output and input are
never exposed to Docker's iframe or worker.

After the first Exec visit, the shell stays mounted while switching detail tabs
or Docker resource sections. Its hidden surface reports no geometry; returning
uses the same session. Changing the container/shell/connection, closing the
inspector or slot, or disposing the plugin still cleans up the session. Retention
is bounded to the selected container, not an accumulating cache of containers.
No automatic start, reconnect or retry is performed.
If the worker API or surface is unavailable, use the copied shell command in
the server's terminal. The one-shot command runner and its worker protocol are
removed. Pending offers abandoned before mounting expire on the host. Permission
approval allows proposals only; each new session needs separate host approval.
Typing in an already approved session does not require per-command confirmation.
Daemon/container checks are preflight checks, not a lock: remote state may change
while the host approval is pending, and Docker can reject the final exec.

Do not publish this package yet. Older desktop versions reject unknown manifest
permissions, including optional ones. Before release, raise `engines.zync` to
the first published desktop version supporting `ssh.terminal.open`; runtime
fallback cannot make this new manifest installable on older hosts. The existing
0.2.0 release and registry remain unchanged. Complete packaged desktop and real
SSH/container lifecycle tests, including the host's documented cancellation and
flood-profile release gates, before shipping the terminal integration.

## Phase 3 — Compose-aware workflows

Service/dependency overview, configuration inspection, project start/stop and
eventual up/down/recreate with a change preview. Account for external projects,
missing configuration files and secrets. Network grouping is not deployment authority.

## Phase 4 — Resource management and deployment

Images: inspect, pull, tag, remove and identify unused images. Networks: inspect
configuration, attachments and connectivity. Volumes: attachments, usage, scoped
removal and backup/restore workflows. Container creation/recreation and image
updates require explicit configuration review. Destructive cleanup must preview
exact targets and warn about data loss; never make prune a default action.

## Architecture and UX contract

Domain owns pure parsing/types/validation. Worker owns authority and command
execution. UI uses the typed client; shared controls and orchestration prevent
duplication. Mock data never ships. Keep server/container identity visible,
preserve pane context, support keyboard interaction and responsive pane sizing.
Use consistent loading, empty, disabled and error states. Full IDs, connection
tokens, daemon checks and native confirmation remain mandatory.

## Request budget

Current Zync allows 30 counted authorizations per 10 seconds per runtime. SSH
commands authorize before dispatch and before returning output; confirmation
also revalidates authority. Five containers can generate many more than five calls.

The shared worker scheduler serializes SSH calls and confirmation dispatch and waits
at least one second after each scheduled operation before starting another.
Approval waiting happens outside the scheduler so other panes can read Docker.
Spacing from SSH completion avoids bursts after slow commands and leaves budget headroom.
Pane message delivery is outside this scheduler. No host limiter is disabled, no
permissions are bypassed and rejected mutations are never automatically retried.

This is a conservative compatibility policy, not negotiated quota discovery.
Revisit it if host accounting changes. Requests carry capped deadlines and cancel
on UI timeout or disposal. The worker checks expiry/cancellation before dispatch
and after approval; late approval cannot authorize subsequent commands. A command
already dispatched cannot be undone, and its outcome may remain uncertain.
The host confirmation dialog may remain visible after expiry, but accepting it
does not continue the canceled request. Large groups take longer; queued work
must never be presented as already completed.

## Permissions and release gates

Required: `ui.pane.register`, `ssh.command.execute`, `ui.dialog.confirm`; optional:
`ssh.terminal.open`. Docker uses the SSH account's authority and may be
root-equivalent. The shell slot does not require `allow-forms` or broader iframe
permissions. Interactive PTY access uses the separate host terminal capability.

Before publication: unit and packaged-worker tests, browser/sandbox regression
tests, build validation, formatting, real-server disposable-container smoke tests,
grant checks, package signing and registry verification. Automated preview tests
must not mutate real servers. Commit/push/publication require operator authorization.
