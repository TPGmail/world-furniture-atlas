# World Furniture Atlas

**Standalone static website**, version **1.4**. A dedicated GitHub repository, unrelated to the Tien Phat website.

## Repository layout

- `site/`: only files deployed to GitHub Pages.
- `.github/workflows/pages.yml`: automatic GitHub Pages deployment from `main`.
- `.gitignore`: protects local exports, backups and credential files.

## Deployment

1. Create a **new repository** under the intended GitHub account, suggested name `world-furniture-atlas`. Do not use `tienphat-website`.
2. Upload the *contents of this package* to the repository root, preserving `site/` and `.github/workflows/`.
3. In **Settings → Pages**, choose **Source: GitHub Actions**.
4. Review the Actions workflow. Open the deployment URL after the workflow succeeds.

## Google Drive synchronization

The site runs offline/local-first without OAuth. To enable cloud sync, create a **Google Cloud project / Web OAuth client dedicated to Atlas**, register the actual HTTPS origin and add the intended Google account as an allowed tester where required. Enter the OAuth Client ID on the Atlas page. **Never publish a client secret.**

The cloud data uses the app-specific Google Drive `appDataFolder`, not the release folder and not the Tien Phat website. OAuth has not been activated or tested with real Google accounts.

## Privacy

GitHub Pages publishes all files in `site/`, including the 59 initial knowledge records embedded in `site/atlas-data.js`. No personal browser notes, raw user exports or backups are included in this release package. Do not commit private notes or credentials.

## Known limitations

- Map library and world geometry load from external CDNs; a fallback displays the catalogue when they fail.
- Existing notes in a different website origin do not migrate automatically. **Export JSON on the old site and import into this one.**
- GitHub Pages hosting only provides static files. Google Drive sync needs independent OAuth configuration.
