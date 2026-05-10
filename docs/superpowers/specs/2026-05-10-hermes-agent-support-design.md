# Hermes Agent Support Design

## Goal

Add Hermes Agent as a first-class `boss-skill install` target.

## Design

Hermes uses the same copy-install flow as Codex, OpenClaw, and Antigravity. The installer detects Hermes when `~/.hermes` exists and copies the thin boss skill bundle to `~/.hermes/skills/boss`.

The copied `SKILL.md` receives Hermes-specific metadata:

```yaml
metadata:
  hermes:
    emoji: "👔"
    requires:
      bins:
        - node
        - bash
```

## Behavior

`boss install --dry-run --json`, `boss install`, and `boss uninstall --yes` include Hermes in structured actions when the Hermes home directory exists. Human-readable help lists Hermes in compatibility and auto-detect documentation.

## Testing

Add Vitest coverage for dry-run, install, and uninstall using a temporary HOME containing `.hermes`. Also verify the copied Hermes `SKILL.md` contains `metadata.hermes`.
