---
type: regex
pattern: '^#{2,4}\s+.*(out[- ]of[- ]scope|not in scope|non[- ]goals|not doing|won.t do|exclu(sions|ded))'
flags: im
target: { source: file, path: .boss/todo-cli/prd.md }
arm: with-only
---
