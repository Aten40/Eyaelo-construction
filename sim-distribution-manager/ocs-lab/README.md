# Eyaelo OCS Lab — SigScale foundation

## Decision

Eyaelo will use the open-source [SigScale OCS](https://github.com/sigscale/ocs) as the first working OCS foundation, then develop Eyaelo-owned integration code and product logic around it. We are not trying to re-create every OCS function from scratch.

The upstream project documents prepaid charging, subscriber/product/balance management, TM Forum Open APIs, and telecom interfaces including Diameter and RADIUS. Its upstream Docker installation procedure is documented in [SigScale README.docker.md](https://github.com/sigscale/ocs/blob/master/README.docker.md). This lab uses that published image and preserves its licence notices.

## First implementation step

On a computer or Linux development host with Docker installed, run:

```bash
bash sim-distribution-manager/ocs-lab/start-sigscale-lab.sh
```

The script pulls the upstream image, initializes a persistent Docker volume, and starts the OCS container. The web/API and protocol ports are bound to `127.0.0.1` on the host, not exposed to the public internet.

Useful commands:

```bash
docker logs -f eyaelo-sigscale-ocs
docker stop eyaelo-sigscale-ocs
docker start eyaelo-sigscale-ocs
```

The OCS lab requires a Docker-capable computer/server. It does not run inside the existing Cloudflare Worker. The current Eyaelo SIM Manager Worker remains separate.

## Development sequence

1. **Boot the upstream OCS.** Confirm the container starts and the management interface is reachable locally.
2. **Create a lab subscriber and balance.** Follow the upstream SigScale HOWTO; use test identities only.
3. **Exercise TMF654 against SigScale itself.** Confirm a balance adjustment is reflected in the SigScale bucket. This proves the real open-source OCS is processing the request, rather than only Eyaelo's D1 simulator.
4. **Build the Eyaelo adapter.** Add a separate server-side adapter that calls the OCS API, maps Eyaelo transaction IDs to OCS operation IDs, and handles timeout/duplicate/unknown outcomes safely.
5. **Automate conformance tests.** Check success, invalid requests, duplicate external references, authentication failures, and balance read-back.
6. **Research and implement network-specific adapters.** Keep each network adapter separate from the OCS core so the system can be tested and extended independently.

## Non-negotiable transaction rules

- Use a unique Eyaelo transaction reference and idempotency key for every intended recharge.
- Never blindly retry a request with an unknown result; query the target OCS for its operation/balance state first.
- Keep an auditable transaction ledger and reconcile Eyaelo transactions against the OCS result.
- Do not represent an OCS lab balance as real mobile airtime. The SigScale lab changes balances in its own test OCS; the current Cloudflare simulator changes only Eyaelo's D1 test ledger.
- Never expose management ports or credentials publicly. The script binds ports to localhost for development.

## Source and licensing

- SigScale OCS source: https://github.com/sigscale/ocs
- SigScale Docker instructions: https://github.com/sigscale/ocs/blob/master/README.docker.md
- TM Forum TMF654 Prepay Balance Management API: https://www.tmforum.org/open-digital-architecture/open-apis/prepay-balance-management-api-TMF654/v4.0

SigScale's repository states Apache-2.0. Preserve upstream copyright/licence notices and review the exact image/source version and dependency licences before redistributing a modified build.

## Current status

- [x] Chosen open-source OCS foundation.
- [x] Added a repeatable, localhost-only Docker lab bootstrap script.
- [ ] Run the script on a Docker-capable host and confirm startup.
- [ ] Provision a test subscriber and perform a TMF654 balance adjustment against SigScale.
- [ ] Implement the Eyaelo-to-SigScale adapter and automated integration tests.
- [ ] Investigate and implement each target network interface separately.

**No real operator airtime has been credited by this lab.** The next software milestone is to run the OCS and connect Eyaelo's existing recharge transaction flow to it.
