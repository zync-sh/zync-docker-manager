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

The check workflow does not sign, tag, push or publish releases. A separate
`release.yml` workflow runs on stable version tags matching all package versions.
It tests a clean candidate, signs in the protected environment, verifies the exact
payload and publisher fingerprint, then publishes the signed ZIP and SHA-256 file.
The publish job has no signing secrets and refuses to overwrite existing releases.
No Git remote is configured locally yet.

## Configure tag release automation

Create the public `zync-sh/zync-docker-manager` repository and configure its
`plugin-release` environment. Add these values:

- Environment secret `DOCKER_PUBLISHER_PRIVATE_KEY`: complete publisher-v3 private PEM.
- Optional environment secret `DOCKER_PUBLISHER_KEY_PASSPHRASE`: omit for your unencrypted key.
- Repository variable `DOCKER_PUBLISHER_KEY_ID`: `sha256:eeccbf7e9cb69165aa2fce6df48a1128032930081f4c89d44a8b35155efdb125`.

Enable required review by yourself with self-review prevention off if you are the
only maintainer. Never expose these secrets to PR checks. PM2 repository secrets
are not automatically available in the Docker repository. The root registry key
must never be added to this plugin's signing environment.

Once logged into GitHub, create/configure the repository and push only after
reviewing and committing the release setup. Tag `v0.2.0` only after the environment
is ready and CI is green. The tag must point to the committed workflow and source.
Do not upload your local signed directory as an unsigned candidate; CI builds and
signs the tested package itself.

After publishing a verified signed archive, add the Docker release to the approved
registry inputs and publish newly signed registry metadata. A signed package alone
does not make a plugin appear in the marketplace. Complete real-Zync testing before
publication; automated browser tests use simulated servers.
