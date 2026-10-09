# AppHost

Static web-app hosting site for GitHub Pages. English UI, light/dark theme, desktop + mobile layouts, public app list, and an admin panel that publishes apps directly into this repository.

## 1. Deploy
1. Create a GitHub repository (e.g. `apphost`) and upload every file from this folder to its root (including `.nojekyll`).
2. **Settings > Pages**: Source = *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
3. The site goes live at `https://<username>.github.io/<repo>/` after a minute or two.

## 2. Create an access token (one time)
1. GitHub > **Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token**.
2. Repository access: **Only select repositories** > choose this repository.
3. Repository permissions: **Contents = Read and write**.
4. Copy the token (GitHub shows it only once).

## 3. Admin panel
Open `https://<username>.github.io/<repo>/#/admin`.
First visit on a device: choose an admin username + password, confirm the repository and paste the token. The token is encrypted with your password (AES-GCM, PBKDF2) and stored only in that browser. On another device, repeat the setup with the same token.

From the panel you can upload an app (a single self-contained .html file), set its name, short description and icon, hide/show it, edit it, replace its file, or delete it.
Apps are saved in `apps/` and listed in `apps.json`, so everyone sees them. Changes appear 1-2 minutes after publishing.

## Notes
- Apps run in a sandboxed frame. They cannot use localStorage/cookies of the site (browser storage inside the app is blocked by the sandbox).
- "Hidden" apps are not listed, but their files remain in the repository.
- GitHub Pages limits: 1 GB site size, ~100 GB/month bandwidth. Pages is not meant for commercial/e-commerce hosting.
- Change colours at the top of `style.css`; texts are in `index.html` and `app.js`.
