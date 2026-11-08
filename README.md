# World Furniture Atlas v2.0 · OpenStreetMap + Leaflet

Release: 2026-11-08. Repository: `TPGmail/world-furniture-atlas`.

## Correct customer positions

- Customer map is now rendered with Leaflet and OpenStreetMap tiles. No Google Cloud key or billing is needed.
- 123 customer addresses remain in `site/customer-addresses.js`, unchanged from v1.9.
- **Only locations independently checked against a real OSM address/POI are pinned.** Verified positions are in `site/customer-verified-points.js`. No city/street-level centroid, guessed coordinates, or x/y visual offsets are accepted.
- Each point has an OSM object type/id, a verification level (`address`) and a traceable matched address. Source quality is important: a geocoder finding the address does **not** itself prove the customer is currently registered there.
- Entries without exact OSM geolocation remain available in a collapsed **Chưa đủ tọa độ chính xác** directory. The map does **not** place an approximate dot for them.
- Red dot sizes stay tiny: large 2 px, medium 1.2 px, small 0.8 px radius. A larger invisible touch region keeps the pins clickable. Multiple customers at exactly the same GPS share one popup.
- The production website does **not** call Nominatim or other geocoding APIs; geocoding is done once during a manually audited research step, and results are committed as a small static dataset. This avoids burdening public OSMF Nominatim servers from visitors.
- Map tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attributed to OpenStreetMap contributors. Commercial/large-traffic use may need a dedicated tile provider; see OSMF tile use policy.

## Project continuity

- World market Atlas (D3), all 59 market records, personal notes, and Google Drive sync are unchanged.
- Previous inaccurate customer coordinates are deleted from the production site. No changes to `TPGmail/tienphat-website`.
- `CUSTOMER_OSM_AUDIT_v2.0.csv` lists every customer, source and decision, so no uncertain location is silently presented as verified.

## Sources/policy

- https://operations.osmfoundation.org/policies/nominatim/ (max 1 req/sec, one-time small bulk only with a single thread, cache, proper identity and attribution; no generic geocoding API added to Atlas).
- https://operations.osmfoundation.org/policies/tiles/
- https://leafletjs.com/examples/quick-start/