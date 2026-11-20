---
type: regex
pattern: 'given[\s\S]{0,400}?when[\s\S]{0,400}?then'
flags: i
target: { source: file, path: .boss/todo-cli/prd.md }
arm: with-only
weight: 2
---
