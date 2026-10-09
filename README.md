# AppHost

Static web-app hosting site (English UI, responsive, admin panel).

## Deploy on GitHub Pages
1. Create a new repository on GitHub (e.g. `apphost`).
2. Upload all files from this folder to the repository root (including `.nojekyll`).
3. Go to **Settings > Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
4. After a minute the site is live at `https://<username>.github.io/<repo>/`.

## Admin panel
Open `<site-url>/#/admin`.
Default login: `admin` / `admin123` - change it immediately in the Account section.

## Notes
- Uploaded apps (single self-contained .html files) are stored in the browser (IndexedDB) of the device used for uploading. They are not shared with other visitors.
- Login is client-side only and is not real security.
