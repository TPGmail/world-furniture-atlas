# World Furniture Atlas · Furniverse

Updated: 2026-11-09. Repository: `TPGmail/world-furniture-atlas`.

## Customer map: 123 sourced locations

- `site/customer-addresses.js`: all **123 original customer addresses**, preserved without overwriting.
- `site/customer-verified-points.js`: 16 previously audited exact building/address markers, preserved.
- `site/customer-geocoded-points.js`: 100 additional cached results from one-time Nominatim research.
- `site/customer-corroborated-points.js`: 7 independently reconciled locations or administrative areas. Manual corrections override generated candidates; the 16 original verified points remain authoritative.
- **123/123 customers have a map reference**: **48** matches at number/building level, **22** road-level reference points, and **53** administrative-area references. A road/ward/city reference is NOT a verified customer office address.
- Map markers: **solid red** = number/building match; **hollow amber** = road, town or administrative area representative. Popups disclose the confidence level and link to a geographical source.
- `CUSTOMER_LOCATION_RESEARCH.json`: per-customer audit status, precision and source references, plus corrections and QA exceptions. All original source rows remain unchanged.
- Address matching alone does not independently prove that the company currently occupies the building. The coordinates express geographic precision, not guaranteed company tenancy.

## Map technology

- Leaflet customer/country overlays on OpenFreeMap vector tiles (Vietnamese labels preferred via `name:vi`), with OpenStreetMap raster fallback.
- No Google Maps API key or browser geocoding. Customer coordinates are static.
- One-time, explicitly source-based geocoding lives in `scripts/geocode_customer_locations.py`, executed from `.github/workflows/customer-location-once.yml` when the research script is updated (or manually dispatched). Requests are serialized and throttled to 1 call per 1.5 seconds. Production visits never geocode.
- OpenStreetMap attribution is retained.

## Project continuity

- Market notes, 59 archive records, Google Drive sync, and original 123 customer records preserved.
- Furniverse and Tien Phat Materials remain separate repositories.

## Sources / map use

- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://leafletjs.com/
- https://openfreemap.org/
