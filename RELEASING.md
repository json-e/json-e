# Making a Release

There are two ways to run the release: inside Docker (recommended) or natively.

## Option A: Docker-based release (recommended)

This runs the release inside a container with all tools pre-installed. You only
need Docker and credentials configured on the host.

### Prerequisites

1. **Docker** installed and running
2. **Credentials** configured (see [Credential Setup](#credential-setup) below)
3. **SSH agent** running with a key that has push access to `github.com:json-e/json-e`

### Run

```bash
./release-docker.sh <version>   # without the `v` prefix
```

The script builds the Docker image (cached after first build), mounts your
credentials read-only, forwards your SSH agent, and runs `release.sh` inside
the container.

## Option B: Native release

Run the release directly on your machine.

### Required tools

| Tool | Install |
|------|---------|
| git | system package manager |
| Python >= 3.10 | system package manager or pyenv |
| pip packages: `build`, `twine`, `towncrier` | `pip install build twine towncrier` |
| Node.js (LTS) + npm | https://nodejs.org or nvm |
| yarn | `corepack enable` (ships with Node.js) |
| Rust + cargo | https://rustup.rs |
| mdbook | `cargo install mdbook` or [pre-built binary](https://github.com/rust-lang/mdBook/releases) |

### Run

```bash
./release.sh <version>   # without the `v` prefix
```

The script runs comprehensive pre-flight checks before doing any work. If
anything is missing or misconfigured, it reports all failures at once so you can
fix everything in one pass.

## Credential Setup

### npm (npmjs.com)

```bash
npm login
```

Verify with `npm whoami`.

### crates.io (Rust)

```bash
cargo login
```

This saves a token to `~/.cargo/credentials.toml`. Alternatively, set the
`CARGO_REGISTRY_TOKEN` environment variable.

### PyPI

Create a `~/.pypirc` file:

```ini
[pypi]
username = __token__
password = pypi-<your-api-token>
```

Or set `TWINE_USERNAME` and `TWINE_PASSWORD` environment variables. Generate an
API token at https://pypi.org/manage/account/token/.

### Git (SSH push access)

Ensure you have an SSH key that can push to `github.com:json-e/json-e`. The
release script auto-detects which git remote points to the `json-e/json-e`
repository (it does not assume a specific remote name like `origin` or
`upstream`).

```bash
ssh -T git@github.com   # should show your username
```

## What the release script does

1. **Pre-flight checks** — verifies all tools, credentials, Python version,
   repo state (clean tree, on `main`, tag doesn't exist yet)
2. **Changelog** — runs `towncrier build` to generate the changelog entry
3. **Version bump** — updates version in `rs/Cargo.toml`, `js/package.json`,
   and `py/setup.py`
4. **Commit & tag** — creates a `v<version>` commit and tag
5. **Publish** — uploads to crates.io, npm, and PyPI
6. **Push** — pushes the commit and tag to GitHub
7. **Docs** — rebuilds and deploys documentation via `deploy-docs.sh`
