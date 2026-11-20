---
type: llm
focus: { source: file, path: .boss/discount-codes/code-review.md }
arm: with-only
weight: 2
---

The review reports that `total` applies the discount twice (it calls `applyDiscount` on an amount that
was already discounted). PASS only if the review states this defect explicitly. A review that only
mentions missing validation or missing tests is a FAIL.
