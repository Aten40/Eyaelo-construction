# Android + GitHub + Cloudflare Pages deployment

## 1. Upload the project to GitHub from your Android phone

The easiest method is to upload the project files from the GitHub website in your browser while using Desktop mode.

1. Open your Eyaelo GitHub repository.
2. Open **Add file → Upload files**.
3. Upload the project contents, not the outer ZIP folder.
4. Make sure `index.html`, `package.json`, `src/`, `public/`, `README.md`, `.gitignore` and the other root files are visible in the repository root.
5. Commit the files to the `main` branch.

If GitHub's browser upload does not accept a folder tree conveniently on Android, extract the ZIP on your phone first and upload the folders/files in manageable batches.

## 2. Cloudflare Pages

1. Sign in to Cloudflare.
2. Go to Pages/Workers & Pages.
3. Choose the GitHub/Git integration option.
4. Select the Eyaelo repository.
5. Framework/build configuration:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 22 if Cloudflare asks for a version.
6. Deploy.
7. Test the generated `pages.dev` address.

## 3. Custom domain later

The domain has not been purchased. Do not enter a made-up DNS record. After the domain is purchased and added to Cloudflare, use the exact DNS instructions Cloudflare displays. Then verify HTTPS and redirects.

## 4. Before going live

Replace placeholders for verified phone, email, address, WhatsApp and domain. Do not enable `STORE_ENABLED` until products, pricing, inventory, delivery, checkout and payment integration are genuinely ready.
