# Boss Mode for DeepSeek Harness

Boss Mode adds a selectable `Boss 专家小队` preset to DeepSeek Harness. It adapts the
repository's PM → Architect → UI → Tech Lead → Scrum Master → Dev → QA → Ship workflow
to DSH Agent Teams and shows live members and task status in a right sidebar panel.

The bundle is generated from the root `skill/` directory. It carries role prompts,
quality contracts, references, templates, and methods in `resources.json`, so an installed
package remains usable without cloning this repository.

## Install

The package is published to npm as [`dsh-boss-mode`](https://www.npmjs.com/package/dsh-boss-mode)
and versioned independently from the root Boss skill. Install it into a DSH profile that
already has the standard profile. For team delegation and the native roster/task
projection, also enable DSH's `@deepseek-ai/dsh-experimental-agent-team-profile` bundle in
that profile. With the DSH CLI:

```sh
dsh plugin --profile desktop add dsh-boss-mode
```

Or install the tarball attached to the
[GitHub Release](https://github.com/echoVic/boss-skill/releases/tag/dsh-boss-mode-v0.1.3):

```sh
dsh plugin --profile desktop add https://github.com/echoVic/boss-skill/releases/download/dsh-boss-mode-v0.1.3/dsh-boss-mode-0.1.3.tgz
```

Or add the [raw market index](https://raw.githubusercontent.com/echoVic/boss-skill/main/integrations/deepseek-harness/marketplace.json) to the DSH plugin market. Then fully
restart DeepSeek Harness, create a new session, and choose **Boss 专家小队**. Agent Teams
must be enabled for the live team panel and `spawn_teammate` workflow; without it, the
preset still provides the role contract and uses the available `subagent` tool when one
exists. The Boss bundle intentionally does not duplicate the optional Agent Teams service,
so it can be installed alongside an existing team profile.

This integration is community maintained. The authoritative Boss skill remains in the
repository root; this package does not install the historical Boss CLI or hooks.
