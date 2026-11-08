# Furniverse Country Intelligence · v2.0

Released scope: standalone GitHub Pages app, site/ only. This feature adds a right-hand country drawer, six editorial Industry Roles, verified source links, a trade-data section, a customer point directory, and comparison of up to three markets.

## Existing data preserved
- site/atlas-data.js: 59 canonical historic profile records preserved without modifications.
- site/atlas-briefs.js: 10 source-linked briefs preserved without modifications.
- site/customer-addresses.js and site/customer-google-map.js (v1.9): preserved without modifications. No city-centre coordinates reintroduced.
- site/atlas-cloud.js: Google Drive OAuth and notes sync preserved.
- Browser storage key worldFurnitureNotes, import/export, note editor: preserved.

## Features
1. Click a map region or catalogue card to open the country drawer; use the Notes/Edit button for historical notes.
2. Tabs: Overview / Industry / Trade / Market / Network / Compare.
3. Filter by role: Resource, Manufacturing, Design, Consumer, Trading, Technology.
4. Compare 2-3 countries. Missing numeric trade data is explicitly labeled missing.
5. Network lists published addresses only when a known country name is explicitly present. It never invents geocodes. The independent Google Maps mode validates precise ROOFTOP points only.

## Information quality
- Roles, focus industries, region labels and taxonomy tags are **editorial guidance only** and explicitly disclosed as such in the UI.
- Verified policy excerpts link to original sources from atlas-briefs.js; check effective dates before relying on them.
- Quantitative trade tiles currently exist only for Vietnam (2025), citing the existing ITPC source. Different HS definitions are not summed.
- Unlisted countries do not receive fabricated roles, industry sizes, suppliers, trade metrics or certifications.
- Public customer addresses are inherited from v1.9, not invented. No coordinates are published by this feature.

## Adding a new verified country
Edit site/country-intelligence-data.js, adding a numeric ISO country code or cn-XX province key.
- Add roles only with a human-reviewed rationale; do not present editorial roles as verified rankings.
- Add trade metrics only with year, scope, units and official source key; create the source in atlas-briefs.js and record a reference.
- Do not add sensitive or private CRM/customer notes to public site.
- Preserve original records; do not overwrite site/atlas-data.js to author a profile.

## Validation
GitHub Actions runs JavaScript syntax and structural checks on PR/push.
Manual smoke test after deploy: open Vietnam, click Germany, test industry role filter, compare 2 countries, inspect network, edit note, test mobile and dark mode. Validate that Google OAuth remains separately configured; deploying does not activate OAuth automatically.
