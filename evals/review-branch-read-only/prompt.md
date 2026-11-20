---
description: Reviewing the current branch writes code-review.md with line-cited findings, edits no source, and stops.
tags: [stage, brownfield]
runs: 2
max_turns: 80
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

Use Boss to review the changes on my current branch before I open a pull request.
