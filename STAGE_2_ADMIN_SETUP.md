# Stage 2 — Dynamic website setup

This branch adds a private admin dashboard and a Cloudflare D1 database for Eyaelo Construction Ltd.

## What it supports
- Private admin sign-in at \`/admin\`
- Add, edit, publish and remove building-material catalogue entries
- Add, edit, publish and remove services and project portfolio entries
- Update the home page headline and introductory text
- Review saved construction and material enquiries and change their status
- Save website enquiries in D1 while continuing to open WhatsApp for the visitor
- Keep online ordering and checkout disabled

## Required Cloudflare secret
Before using the admin dashboard, set a Worker secret named \`ADMIN_PASSWORD\` for the \`eyaelo-construction\` Worker. Use a unique password of at least 12 characters and do not put it in this repository.

Cloudflare Dashboard → **Workers & Pages** → **eyaelo-construction** → **Settings** → **Variables and Secrets** → add a **Secret** named \`ADMIN_PASSWORD\` → save and deploy.

The admin login is intentionally disabled until this secret is present.

## Product and project photos
For the initial version, the admin dashboard accepts an image URL. Cloudflare R2 is not enabled on the account yet, so direct image uploads are not configured. Once R2 Object Storage is enabled in the Cloudflare dashboard, the upload feature can be connected securely.

## Database
The Worker is configured to use the Cloudflare D1 database named \`eyaelo-business-content\`. Tables store services, products, projects, site settings, customer enquiries and expiring admin sessions.

## Notes
- Published products may appear in the materials catalogue, but prices are informational only and checkout stays disabled.
- A visitor still needs to tap **Send** in WhatsApp to send the prefilled WhatsApp message.
- File attachments are not automatically saved or sent by the form; users must attach files separately in WhatsApp.
