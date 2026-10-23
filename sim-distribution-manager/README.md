# Eyaelo SIM Distribution Manager — Foundation

## Purpose
A separate application for managing South African SIM-distribution operations across MTN, Vodacom, Cell C, and Telkom. This work is kept on a feature branch so it does not change the live Eyaelo Construction website.

## First milestone: safe, usable dashboard
- SIM register: phone number, network, assigned agent/location, registration date, and operational status.
- Search, filters, and CSV import/export.
- Recharge request queue with explicit states: draft, queued, submitted, confirmed, failed, and unknown.
- Audit trail for user actions and provider responses.
- Separate ledgers for real airtime transactions, verified network activity, and commission statements.
- Demo mode clearly labelled; demo records must never be represented as real network activity.
- Provider connector interface so an authorised airtime provider can be integrated later without rewriting the dashboard.

## Safety and financial controls
- No live recharge until an authorised provider connection is configured and a small test transaction can be reconciled.
- Provider credentials and signing secrets must remain in server-side secrets, never in browser code or source control.
- Never store SIM PINs, PUKs, one-time passwords, or carrier account passwords in the SIM register.
- Do not fabricate usage, activation, or commission eligibility. Store only genuine provider/carrier evidence for real activity.
- Require confirmation before bulk recharge; show total estimated spend and number of affected lines.
- Idempotency keys and duplicate-request checks should prevent accidental double charging.

## Initial technical direction
- Front end: React + TypeScript.
- Backend: Cloudflare Worker.
- Data: Cloudflare D1, subject to checking current account availability and binding setup.
- Authentication: server-validated admin session, not a client-side password check.
- Provider integration: adapter interface with a demo adapter first and a documented, authorised live adapter later.

## Milestones
1. Confirm repository and hosting separation.
2. Build responsive dashboard and SIM register using demo data.
3. Add persistent database schema and server-side authentication.
4. Add recharge queue, audit log, and duplicate protection.
5. Evaluate provider onboarding, API access, wallet funding, and supported networks.
6. Conduct one low-value, authorised live recharge and reconcile the provider response.
7. Add commission statement import and discrepancy reporting.

## Not yet implemented
This document records the starting design only. It does not claim that a working app, database, provider integration, or live recharge capability already exists.
