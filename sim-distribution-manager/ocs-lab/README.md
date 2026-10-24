# Eyaelo SigScale OCS lab

This lab runs the upstream SigScale OCS container on a Docker-capable development host. It is separate from the Cloudflare Worker because the OCS is an Erlang/OTP service and cannot run inside a Worker.

Run:

    bash sim-distribution-manager/ocs-lab/start-sigscale-lab.sh

The script initializes a persistent Docker volume, creates required IPDR log directories, and binds API/protocol ports to localhost only.

Health check:

    curl --fail http://127.0.0.1:8080/health

Check logs:

    docker logs -f eyaelo-sigscale-ocs

The initial OCS instance uses a local development database. Provision a test subscriber/product through the SigScale interface, then use the Eyaelo OCS adapter endpoints documented in worker/OCS-SIMCLOUD-INTEGRATION.md. The Eyaelo SIM Manager must be able to reach the OCS URL over HTTPS for integration tests; localhost-only binding is deliberately safe but is not reachable from Cloudflare.

Never interpret a balance change in this lab as actual mobile-network airtime. The SIMcloud API route is a separate real airtime delivery path.
