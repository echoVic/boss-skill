#!/usr/bin/env bash
# A small repository whose feature branch adds a discount with two planted bugs:
# the percentage is never validated, and the discount is applied twice.
set -euo pipefail

git init -q -b main .
git config user.email "eval@example.com"
git config user.name "Eval"

mkdir -p src
cat > src/cart.js <<'JS'
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function total(items) {
  return subtotal(items);
}
JS
cat > package.json <<'JSON'
{ "name": "cart", "version": "1.0.0", "type": "module" }
JSON
git add -A
git commit -q -m "feat: cart subtotal"

git switch -q -c discount-codes
cat > src/cart.js <<'JS'
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function applyDiscount(amount, percent) {
  return amount - amount * (percent / 100);
}

export function total(items, percent = 0) {
  const discounted = applyDiscount(subtotal(items), percent);
  return applyDiscount(discounted, percent);
}
JS
git add -A
git commit -q -m "feat: discount codes"
