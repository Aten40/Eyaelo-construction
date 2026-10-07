# Eyaelo E-Commerce Roadmap

## Phase 1 — Construction website + catalogue
- Launch construction pages and enquiry forms.
- Introduce Building Materials categories.
- Keep `STORE_ENABLED=false`.
- No fake prices, stock, delivery fees or payment claims.

## Phase 2 — Live catalogue
- Connect verified product data to the existing Product model.
- Add product detail pages, search, category filtering and availability.
- Add material enquiry workflow.

## Phase 3 — Ordering
- Enable cart and checkout.
- Add customer accounts and order history.
- Add inventory and order statuses: Pending, Confirmed, Processing, Ready, Dispatched, Delivered, Cancelled.
- Add delivery logic suitable for bulky materials.

## Phase 4 — Payments + administration
- Integrate a Uganda-compatible payment provider after commercial, legal and technical verification.
- Build authenticated admin dashboard for products, categories, inventory, orders, customers and content.
- Add real email/WhatsApp/payment notifications.

## Phase 5 — Full Eyaelo platform
- Expand into equipment hire, transport, aggregate delivery, ready-mix/concrete, steel, roofing, plumbing, electrical and hardware categories only when Eyaelo actually offers them.
- Add reporting, customer service workflows and operational integrations.

## Data migration principle
The initial site keeps business data in central modules rather than scattering it across UI components. Later, the same TypeScript shapes can be supplied by an API/database.
