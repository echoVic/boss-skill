---
description: A request for requirements only runs the PM stage, verifies the PRD and stops before architecture.
tags: [stage, contract]
runs: 2
max_turns: 80
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
---

I want a command-line todo app for myself that saves tasks to a local JSON file. Write the requirements
document for it so I can review it before anything else happens. Use the feature name `todo-cli`. Do not
ask me questions: make reasonable assumptions and state them in the document.
