# Docker Manager for Zync

Local, unsigned development plugin. Not published or marketplace-ready.

## Workspace

The UI follows the supplied Docker workspace reference: a compact header and
resource navigation, Compose-grouped container list, and a side-by-side inspector.
Below 900px **pane width**, the inspector becomes a full-pane view with a Back
button. Search, filters, group selection and collapsible groups work in narrow
panes, without enlarging the host workspace.

- Containers: search, running/stopped filters, Compose/network/no grouping, live CPU/memory
  samples and recent charts, native-confirmed start/stop/restart/remove.
- Batch start/stop/restart: at most five containers per confirmed operation.
- Inspector: overview, filtered/polled logs, shell commands, masked environment
  values, published ports and mounts. Copy copies only the displayed value.
- Images, volumes and networks: searchable, read-only Docker resource lists.
- Loading, empty, disconnected, permission and Docker-unavailable states.
- Host theme colors via `@zync-sh/plugin-ui`; preview-only theme/state controls.

The shell is a **non-interactive command runner**, not a persistent terminal.
Every command requires native Zync confirmation and runs through a fixed
`docker exec <full-id> /bin/sh -c <input>` invocation, or `/bin/bash` when selected.
The selected shell must exist in the container. Copy the interactive shell command
into a regular terminal on the same server for a persistent session. Zync's v2
plugin API currently cannot create terminal panes. No direct Docker socket or
external backend is used.

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
Requires Zync 2.33.1 / Plugin API 2.1 and Docker CLI access on the connected server.

## Safety and limits

All server operations stay in the Worker. Requests validate full container IDs,
operation names, batch sizes and input lengths. Every operation is bound to the
pane's connection token and Docker daemon ID. Mutations inspect selected
containers before confirmation and recheck the daemon and container state after
confirmation. Removal never forces a running container and never removes volumes.
Do not retry timed-out mutations without refreshing: their outcome can be unknown.

Docker access may grant root-equivalent authority. Shell commands run as the
container's configured user and may change files or services. Install only trusted
plugins. Logs and environment variables can contain secrets; there is no telemetry
or persistent storage in this plugin.

Lists are bounded to 500 objects; batch operations to five. Logs request the last
400 lines and display at most 48,000 characters. Metrics and open logs refresh
every five seconds while the page is visible. Container membership/status refresh
on explicit Refresh and after lifecycle actions. Resource deletion, image pulls,
Compose deployment, streaming logs and interactive TTYs are not implemented.
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
