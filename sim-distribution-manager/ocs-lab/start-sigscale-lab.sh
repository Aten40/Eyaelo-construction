#!/usr/bin/env bash
set -euo pipefail

# Eyaelo OCS lab bootstrap for the upstream SigScale OCS Docker image.
# All host ports are bound to 127.0.0.1; this is a development lab, not production.

IMAGE="${SIGSCALE_OCS_IMAGE:-sigscale/ocs}"
CONTAINER="${EYAELO_OCS_CONTAINER:-eyaelo-sigscale-ocs}"
VOLUME="${EYAELO_OCS_VOLUME:-eyaelo-ocs-db}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine/Desktop, then rerun this script." >&2
  exit 1
fi

if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container '$CONTAINER' already exists. Start it with: docker start $CONTAINER"
  exit 0
fi

echo "Pulling upstream SigScale OCS image: $IMAGE"
docker pull "$IMAGE"
docker volume create "$VOLUME" >/dev/null

echo "Initializing the persistent OCS database volume..."
docker run --rm --entrypoint bash -h host1 -v "$VOLUME:/home/otp/db" "$IMAGE" -lc "bin/initialize"

echo "Starting the OCS lab with host access restricted to localhost..."
docker run -d --name "$CONTAINER" -h host1 \
  -v "$VOLUME:/home/otp/db" \
  -p 127.0.0.1:8080:8080/tcp \
  -p 127.0.0.1:1812:1812/udp \
  -p 127.0.0.1:1813:1813/udp \
  -p 127.0.0.1:3868:3868/tcp \
  "$IMAGE" >/dev/null

echo
echo "Eyaelo SigScale OCS lab container started: $CONTAINER"
echo "Web/API port is bound to localhost only: http://127.0.0.1:8080"
echo "Check startup logs with: docker logs -f $CONTAINER"
echo "Stop with: docker stop $CONTAINER"
echo "Remove container (database volume remains): docker rm -f $CONTAINER"
echo "Remove test database permanently: docker volume rm $VOLUME"
echo
echo "This is an isolated test OCS. It does not credit MTN, Vodacom, Cell C or Telkom."
