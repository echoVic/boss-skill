#!/usr/bin/env bash
# A PRD that breaks its contract three ways: no summary section first, a leftover TBD,
# and no Given-When-Then acceptance scenario.
set -euo pipefail

mkdir -p .boss/invoices
cat > .boss/invoices/prd.md <<'MD'
# PRD: Invoices

## Background

Customers need to download invoices for their orders.

## Requirements

### R1 Download an invoice (P0)

The user can download a PDF invoice from the order page. The experience should be smooth.

### R2 Email an invoice (P1)

Delivery provider: TBD

## Out of scope

- Credit notes.
MD
