# World Furniture Atlas v1.7 · Curated customer overlay

**Live source:** `TPGmail/world-furniture-atlas` (standalone GitHub Pages).  
**Content review:** 2026-11-08.  
**Safety:** Original 59 records, 28 source variants, local browser notes and cloud sync files are unchanged.

## Customer map update (2026-11-08)

- Red customer pins sized by the approved 3-level business rule (large chain / medium sourcing / small independent).
- Only customers with a specific physical address and identifiable city are shown; unresolved entities remain in the local audit rather than being placed at an arbitrary national center.
- New source links for externally researched HQs are embedded in the public pin data.
- **Important:** Red marker coordinates are approximate CITY centers, NOT geocoded building entrances. Pin tooltips state this limitation and link to a Google Maps search using the full address.
- The customer list is visible to anyone on the public website. Do not add confidential notes, private emails, or private deal data.
- Internal audit (`CUSTOMER_MAP_AUDIT_v1.7.md`, `customer_map_review_v1.7.csv`) is in the private release ZIP only; it is not deployed to GitHub Pages.

## What changed previously (v1.5)

- Default screen displays 10 source-linked priority market briefs, rather than 59 long raw notes.
- All 59 legacy profiles remain accessible through “Tất cả”, search, and map selection.
- Verified facts link to official primary sources; older raw notes explicitly marked as not fully checked.
- Search remains visible. Filters, note editing, imports, backup history, and Drive OAuth settings are collapsed until needed.
- Removed destructive delete controls from the quick cards, but retained note edit and JSON export.
- See `CONTENT_AUDIT_v1.5.md` for sources and validation decisions.

---

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