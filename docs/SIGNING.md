# Signing and CI

## Reusing your publisher identity

The existing `publisher-v3` Ed25519 private key can sign Docker Manager as well as
PM2 Monitor. Both manifests use publisher `com.zync`. Signing keys identify the
publisher, not a single plugin; the signed manifest and payload bind each package
to its own plugin ID and version. Do not use the registry-root private key here.

Reusing the key avoids another identity to approve, but compromise would affect
both plugins. A separate key is also valid; it needs its own registry approval.
Only public keys/fingerprints belong in public metadata. Never commit private keys.

## Local signing

From the Docker Manager directory, first build and validate the package:

```powershell
npm run check
```

The local Zync SDK supports these commands. Use a new output directory each time:

```powershell
node "E:\work\personal\projects\project-zync\zync\packages\plugin-sdk\bin\zync-plugin.mjs" sign --source ".\dist" --key "C:\ZyncSigningKeys\publisher-v3\publisher-private.pem" --out "C:\ZyncSigningKeys\docker-manager-0.2.0-signed"

node "E:\work\personal\projects\project-zync\zync\packages\plugin-sdk\bin\zync-plugin.mjs" verify --source "C:\ZyncSigningKeys\docker-manager-0.2.0-signed"
```

Signing already verifies the result; the separate verify command is an additional
check. An encrypted key prompts for its passphrase; the existing unencrypted key
does not need one. These are local SDK commands, not a claim that the installed
beta npm CLI already exposes every signing command.

If choosing a separate publisher key, generate it outside Git:

```powershell
node "E:\work\personal\projects\project-zync\zync\packages\plugin-sdk\bin\zync-plugin.mjs" keygen --out "C:\ZyncSigningKeys\docker-publisher-v1"
```

## CI checks

`.github/workflows/check.yml` runs on pushes, pull requests and manual dispatch.
Ubuntu and Windows jobs install locked dependencies, check formatting, run unit
tests, build/validate the package and run Chromium browser regressions. Artifacts
are unsigned candidates. No signing secret is required for these checks.

This workflow does not sign, tag, push or publish releases. No Git remote is
configured in the local Docker repository at the time this setup is written.

## Later release automation

For automatic signed tag releases, use the same separated candidate → protected
signing → publishing structure as PM2. Add the publisher private key only to the
Docker repository's protected `plugin-release` environment, not to pull-request
checks. A repository variable can hold the public publisher-key fingerprint.
An unencrypted key needs no passphrase secret. Do not assume PM2 repository
secrets are automatically available in the Docker repository.

After publishing a verified signed archive, add the Docker release to the approved
registry inputs and publish newly signed registry metadata. A signed package alone
does not make a plugin appear in the marketplace. Complete real-Zync testing before
publication; automated browser tests use simulated servers.
