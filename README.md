# Docker Manager for Zync

### Local overlay integration candidate

The SDK dependency is pinned to the published `2.1.0-beta.4` registry version;
installation does not require a sibling SDK checkout. Dropdowns register
their rectangles without resizing the embedded terminal. Only popup bounds are
clipped on the updated host; the uncovered header and terminal remain visible.

Local, unsigned development plugin. Not published or marketplace-ready.

See [the roadmap](docs/ROADMAP.md) for product phases, permissions, request pacing,
architecture rules and release gates.

See [signing and CI](docs/SIGNING.md) for publisher-key reuse, local signing commands,
and automated validation.

## Workspace

The UI follows the supplied Docker workspace reference: a compact header and
resource navigation, Compose-grouped container list, and a side-by-side inspector.
Below 900px **pane width**, the inspector becomes a full-pane view with a Back
button. Search, filters, group selection and collapsible groups work in narrow
panes, without enlarging the host workspace.

- Containers: search, running/stopped filters, Compose/network/no grouping, live CPU/memory
  samples and recent charts, native-confirmed start/stop/restart/remove.
- Whole-group start/stop/restart: sequential batches of up to five containers, with confirmation for each batch. Cancellation or failure stops remaining batches. Batch removal targets stopped containers only and keeps volumes.
- Inspector: overview, filtered/polled logs, interactive shells, masked environment
  values, published ports and mounts. Copy copies only the displayed value.
- Images, volumes and networks: searchable, read-only Docker resource lists.
- Loading, empty, disconnected, permission and Docker-unavailable states.
- Host theme colors via `@zync-sh/plugin-ui`; preview-only theme/state controls.

Exec / Shell now shows an interactive-only shell UI. Docker proposes fixed
`docker exec -it <full-id> /bin/sh` (or `/bin/bash`) argv, while Zync owns the PTY,
renderer and confirmation. The permission grant permits proposals; each new
session separately requires host approval. Typing within an approved session
does not prompt again. The selected shell must exist in the container. When the
host does not support embedded terminals, copy the shell command into a regular
terminal on the same server. No command runner, direct Docker socket or external
backend is used.

Network groups use Docker's reported network names. A container attached to more
than one network appears in each group; selection and batch actions count its ID
once. Compose grouping remains the default. The packaged SVG is used in the
workspace and Zync's plugin list. Initial and detail/resource loading use skeleton
rows; refresh preserves the visible workspace and shows its progress.

## Develop and install

```sh
npm install
npm run dev
npm run check
npm run test:browser
npm run format:check
```

If browser binaries are missing, run `npx playwright install chromium` once.
The standalone Vite preview is simulated: it never contacts an SSH server.

Build with `npm run build`, then install this repository's **dist** directory
through Zync's Plugins → Developer local installation flow. For an existing
0.1.0 installation, reinstall the rebuilt 0.2.0 package and approve its added
confirmation permission. Close the old Docker pane and open a fresh one.
The existing 0.2.0 release requires Zync 2.33.1 / Plugin API 2.1 and Docker CLI
access on the connected server. The current local terminal candidate additionally
requires the updated Zync checkout implementing `ssh.terminal.open`; do not load
it in older released desktop builds or publish it with the current engine range.

### Testing the embedded-terminal candidate

Install the rebuilt `dist` folder through the updated local Zync build's
Developer flow, then close any old Docker pane and open a new one. On a disposable
running container, select **Exec / Shell** and choose sh/bash. The proposal is
prepared automatically, without launching a process. Approve the optional terminal permission,
then approve the exact launch in Zync's automatically opened confirmation.
Check typing, resizing, switching away, closing, connection loss and opening again.
Switching detail tabs or resource sections preserves the selected container's
shell and its output. Returning does not request a new session. Closing the
inspector, selecting another container, changing shell/connection, or closing
the plugin disposes it; sessions are not restored after app restart.
The copied-command fallback remains available; the command runner is removed.
No real-server terminal test has been performed automatically.

The package version is unchanged for local development. Before a marketplace
release, choose a new version and raise the minimum desktop engine to the first
published Zync build supporting this capability; see [the roadmap](docs/ROADMAP.md).

## Safety and limits

### Workspace controls

Drag the details-panel divider (or focus it and use Left/Right arrows) to resize.
Use Expand to give logs or the shell the full pane without changing the selected
tab. The question-mark button reopens the dismissible quick-start guide. Container
names support Up/Down and Home/End navigation; Enter opens the focused container.
Search fields retain their values during refresh, and Clear filters recovers an
empty search. Removal is in the container's More actions menu.

Logs support wrap, timestamps, level/search filters, pause, follow and copying
the displayed output. Scrolling away from the bottom stops automatic following.
Direct downloads are deferred: the current Zync iframe sandbox blocks them.
Grouping, panel width and guide dismissal use browser storage where available;
isolated panes fall back to memory and may reset these preferences on reload.

### Server operations

Docker command selection stays in the Worker; embedded PTY input/output stays
entirely in Zync. Requests validate full container IDs,
operation names, batch sizes and input lengths. Every operation is bound to the
pane's connection token and Docker daemon ID. Mutations inspect selected
containers before confirmation and recheck the daemon and container state after
confirmation. Removal never forces a running container and never removes volumes.
Do not retry timed-out mutations without refreshing: their outcome can be unknown.

Docker access may grant root-equivalent authority. Shell commands run as the
container's configured user and may change files or services. Install only trusted
plugins. Logs and environment variables can contain secrets; there is no telemetry
or persistent storage in this plugin.

Lists are bounded to 500 objects; each confirmed batch is bounded to five. Logs request the last
400 lines and display at most 48,000 characters. Metrics and open logs refresh
every five seconds while the page is visible. Container membership/status refresh
on explicit Refresh and after lifecycle actions. Resource deletion, image pulls,
Compose deployment and streaming logs are not implemented. Interactive TTYs are
available only in the experimental local host-terminal integration.
Resource columns reflect fields returned by Docker, not invented size/usage data.

## Architecture

- `src/domain`: typed requests, validation and pure Docker output parsing.
- `src/worker`: pane authority, fixed Docker invocation paths, confirmation and
  connection checks. Arbitrary host programs are never accepted.
- `src/ui`: small React views and a serialized, disposable pane client. Large
  responses are chunked below the host's 64KiB pane-message limit.
- `src/preview`: development-only implementation of the same client interface.
- `tests`: parsing, bridge, safety-boundary and responsive browser regressions.
- `scripts/build.mjs`: self-contained minified HTML, SDK validation, 512KiB pane
  size gate and a build-metadata check excluding preview implementation bytes.

The reference project is design input, not a runtime dependency. React and Lucide
are bundled locally; no SSR, runtime CDN, remote fonts or external assets.

Before publication: smoke-test real Zync/SSH permissions and lifecycle operations,
then add release CI, publisher signing and registry approval. No repository,
release, or registry entry has been published by this development work.
