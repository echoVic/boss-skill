---
type: regex
pattern: 'return applyDiscount\(discounted, percent\);'
target: { source: file, path: src/cart.js }
arm: with-only
weight: 2
---
