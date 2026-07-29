# Upgrade the JS/TS SDK safely

Before upgrading, read [CHANGELOG.md](../CHANGELOG.md) and
[BREAKING_CHANGES.md](../BREAKING_CHANGES.md), test against the target
Conductor server, and pin the new package version in a staging environment.
Run unit tests and one representative workflow and agent execution before
production rollout.

Configuration env vars are `CONDUCTOR_*`/`CONDUCTOR_AGENT_*`-prefixed with no
legacy alias — this is a clean break, not a compatibility shim, so renaming
an old env var name is required, not optional, when upgrading across a major
that changed it (see `CHANGELOG.md`'s `[Unreleased]` entries for the current
set). Roll back by restoring the prior package lock and keeping workflow
definitions versioned rather than changing active behavior in place.
