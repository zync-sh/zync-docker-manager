# Docker plugin development

- Keep Docker parsing/commands pure in domain; Zync authority stays in worker.
- UI must use the client interface, never execute commands or access Docker sockets.
- Validate untrusted messages at runtime. Never allow arbitrary programs or arguments.
- Future mutations require native confirmation and expected connection tokens.
- Mock data is development-only and must not appear in release artifacts.
- Use host theme tokens and pane/container sizing, not viewport-only responsiveness.
- Prefer small components and explicit state; no generated monolithic workspace file.
- Run `npm run check` and `npm run format:check` before handoff.
- No commit, push, publication, or real-server operation without user authorization.
