#!/bin/bash

set -e

IMAGE_NAME="json-e-release"

version="${1}"
if [ -z "${version}" ] || [[ "${version}" == v* ]]; then
    echo 'USAGE: ./release-docker.sh <version>  (without `v` prefix)'
    exit 1
fi

# Build the release image if needed
echo "=== Building release Docker image ==="
docker build -f Dockerfile.release -t "$IMAGE_NAME" .

# Collect credential mount arguments
MOUNTS=()

if [ -f "$HOME/.cargo/credentials.toml" ]; then
    MOUNTS+=(-v "$HOME/.cargo/credentials.toml:/root/.cargo/credentials.toml:ro")
elif [ -f "$HOME/.cargo/credentials" ]; then
    MOUNTS+=(-v "$HOME/.cargo/credentials:/root/.cargo/credentials:ro")
fi

if [ -f "$HOME/.npmrc" ]; then
    MOUNTS+=(-v "$HOME/.npmrc:/root/.npmrc:ro")
fi

if [ -f "$HOME/.pypirc" ]; then
    MOUNTS+=(-v "$HOME/.pypirc:/root/.pypirc:ro")
fi

# SSH agent forwarding
SSH_ARGS=()
if [ -n "${SSH_AUTH_SOCK:-}" ]; then
    SSH_ARGS+=(-v "$SSH_AUTH_SOCK:/ssh-agent" -e "SSH_AUTH_SOCK=/ssh-agent")
fi

# Pass through PyPI env vars if set
ENV_ARGS=()
if [ -n "${TWINE_USERNAME:-}" ]; then
    ENV_ARGS+=(-e "TWINE_USERNAME=$TWINE_USERNAME")
fi
if [ -n "${TWINE_PASSWORD:-}" ]; then
    ENV_ARGS+=(-e "TWINE_PASSWORD=$TWINE_PASSWORD")
fi
if [ -n "${CARGO_REGISTRY_TOKEN:-}" ]; then
    ENV_ARGS+=(-e "CARGO_REGISTRY_TOKEN=$CARGO_REGISTRY_TOKEN")
fi
if [ -n "${NPM_TOKEN:-}" ]; then
    ENV_ARGS+=(-e "NPM_TOKEN=$NPM_TOKEN")
fi

echo "=== Running release inside Docker ==="
docker run --rm -it \
    -v "$(pwd):/work" \
    "${MOUNTS[@]}" \
    "${SSH_ARGS[@]}" \
    "${ENV_ARGS[@]}" \
    "$IMAGE_NAME" \
    ./release.sh "$version"
