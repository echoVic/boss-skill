# Security Policy — dsh-boss-mode

`dsh-boss-mode` is the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai)
bundle published from
[`integrations/deepseek-harness`](https://github.com/echoVic/boss-skill/tree/main/integrations/deepseek-harness)
in the boss-skill repository. The project-wide security policy applies here:
see the root [SECURITY.md](https://github.com/echoVic/boss-skill/blob/main/SECURITY.md)
for the full scope, response process, and security-sensitive capabilities.

## Supported Versions

Security fixes are applied to the latest published release of `dsh-boss-mode`.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a Vulnerability

Report privately so the issue can be addressed before public disclosure.
- **Preferred:** Open a [GitHub Security Advisory](https://github.com/echoVic/boss-skill/security/advisories/new)
  for the boss-skill repository.
- **Alternative:** Email the maintainer at `137844255@qq.com` with the subject
  line `[SECURITY] dsh-boss-mode`.

Please include:
- The affected `dsh-boss-mode` version (`npm ls dsh-boss-mode` or the installed
  bundle directory), and the DSH version.
- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept, affected commands, or configuration).

Do **not** open a public issue for security reports.

## Scope

This bundle loads the Boss skills and agent definitions into DSH and registers
the Boss mode UI. Security-sensitive surfaces include:
- `cordis.patch.yml` and `client.js`, which patch the DSH client at load time.
- `resources.json`, whose embedded skills and agent instructions are loaded
  into agent context.
- Hook and workflow definitions shipped in the bundled Boss skills, which may
  execute local commands when invoked.

Treat the bundle as executable extension code: install it only from the
official npm package or the release assets of this repository, and review
updates before deploying them in sensitive environments.

Thank you for helping keep the project and its users safe.
