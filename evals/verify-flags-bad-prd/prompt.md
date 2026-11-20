---
description: Verifying existing artifacts runs the checker, reports the broken contract and leaves the PRD alone.
tags: [contract]
runs: 2
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

Use Boss to verify the artifacts of the `invoices` feature. I only want to know what is wrong with them:
do not change the documents.
