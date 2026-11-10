const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html = read('site/index.html');
const app = read('site/app.js');
const map = read('site/customer-leaflet-map.js');
const iso = read('site/customer-country-iso.js');
const country = read('site/country-intelligence.js');
for(const name of ['site/app.js','site/customer-leaflet-map.js','site/customer-country-iso.js','site/country-intelligence.js'])
  new vm.Script(read(name),{filename:name});
assert.ok(html.includes('id="layer-countries" type="checkbox" checked'));
assert.ok(html.includes('id="layer-customers" type="checkbox" checked'));
assert.ok(html.includes('src="customer-country-iso.js"'));
assert.ok(html.includes('href="unified-map.css"'));
assert.ok(!html.includes('id="map-mode-customers"'));
assert.ok(!html.includes('id="map-mode-countries"'));
assert.ok(html.includes('id="customer-country-filter"'));
assert.ok(html.includes('id="customer-status-filter"'));
assert.ok(html.includes('id="customer-filter-count"'));
assert.ok(app.includes('new Event("atlas:geography-ready")'));
assert.ok(app.includes('window.AtlasMapBridge = Object.freeze('));
assert.ok(map.includes("window.L.geoJSON("));
assert.ok(map.includes("window.L.circleMarker("));
assert.ok(map.includes('point.checkedAddress === entryById.get(point.id).address'));
assert.ok(map.includes("point.verificationLevel === 'address'"));
assert.ok(html.includes('src="customer-geocoded-points.js"'),'New research data loaded');
assert.ok(map.includes("['street','postal','administrative']"),'Non-rooftop precision supported');
assert.ok(map.includes("'Khu vực tham chiếu'"),'Area reference locations are clearly identified');
assert.ok(map.includes("const preciseCount"),'Exact and approximate counts split');

assert.ok(map.includes("feature.id !== 'intl-island'"));
assert.ok(country.includes('geo.forCustomer(row) === iso2'));
assert.ok(!country.includes('Google Maps'));
assert.equal((html.match(/<div\b/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
// Confirm published records and verified GPS payload are unchanged by this feature.
const window={};
vm.runInNewContext(read('site/atlas-data.js'),{window});
vm.runInNewContext(read('site/customer-addresses.js'),{window});
vm.runInNewContext(read('site/customer-verified-points.js'),{window});
vm.runInNewContext(iso,{window});
const resolver=window.FURNIVERSE_COUNTRY_ISO;
assert.equal(Object.keys(window.ATLAS_KNOWLEDGE_V2.records).length,59);
assert.equal(window.ATLAS_CUSTOMER_ADDRESSES.length,123);
assert.equal(window.ATLAS_VERIFIED_CUSTOMER_POINTS.length,16);
assert.equal(resolver.forAddress('123 Baker Street, London, United Kingdom'),'GB');
assert.equal(resolver.forAddress('1 Ashley Way, Arcadia WI, USA'),'US');
assert.equal(resolver.forAddress('Street 3, Vietnam-Singapore Industrial Park, Binh Duong, Vietnam'),'VN');
assert.equal(resolver.forAddress('Unit 3, Singapore 368001'),'SG');
assert.equal(resolver.forAddress('South Tower, Hong Kong SAR'),'HK');
assert.equal(resolver.forAddress('Street 3, Brea, CA 92821'),null,'Do not guess from a US state code');
assert.equal(resolver.forAddress('10018'),null,'Do not infer from a postal code');
assert.equal(resolver.forAtlasId('704'),'VN');
assert.equal(resolver.forAtlasId('cn-44'),'CN');
assert.equal(resolver.forAtlasId('cn-81'),'HK');
assert.equal(resolver.forAtlasId('840'),'US');
assert.ok(!iso.includes('row.market'),'Do not confuse sales market with customer country');
let verified = 0;
const lookup=new Map(window.ATLAS_CUSTOMER_ADDRESSES.map(row=>[row.id,row]));
for(const p of window.ATLAS_VERIFIED_CUSTOMER_POINTS) {
  assert.equal(p.verificationLevel,'address');
  assert.equal(p.checkedAddress,lookup.get(p.id).address);
  assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  verified++;
}
assert.equal(verified,16);

const researchContext={window:{}};
for(const file of ['site/customer-geocoded-points.js','site/customer-corroborated-points.js'])
  vm.runInNewContext(read(file),researchContext);
const researched=researchContext.window.ATLAS_RESEARCHED_CUSTOMER_POINTS;
const corroborated=researchContext.window.ATLAS_CORROBORATED_CUSTOMER_POINTS;
const allPoints=new Map([...researched,...corroborated,...window.ATLAS_VERIFIED_CUSTOMER_POINTS].map(p=>[p.id,p]));
assert.equal(researched.length,100,'100 independently sourced Nominatim candidate locations');
assert.equal(corroborated.length,22,'22 manually corroborated or corrected locations');
assert.equal(allPoints.size,123,'Every customer has one source-backed map point');
const categories={address:0,street:0,administrative:0};
for(const [id,point] of allPoints) {
  assert.equal(point.checkedAddress,lookup.get(id).address,'Source address must be unchanged: '+id);
  assert.ok(Number.isFinite(point.lat) && point.lat>=-90 && point.lat<=90,'Latitude: '+id);
  assert.ok(Number.isFinite(point.lon) && point.lon>=-180 && point.lon<=180,'Longitude: '+id);
  assert.ok(['address','street','administrative'].includes(point.verificationLevel),'Precision: '+id);
  categories[point.verificationLevel]++;
  const hasOsm=point.osmType && Number.isSafeInteger(point.osmId);
  const hasSource=typeof point.sourceUrl==='string' && point.sourceUrl.startsWith('https://');
  assert.ok(hasOsm || hasSource,'Geographic source required: '+id);
}
assert.deepEqual(categories,{address:49,street:22,administrative:52});
assert.ok(html.includes('src="customer-corroborated-points.js"'),'Manual source overrides load before the map');
assert.ok(!allPoints.get('cust-087-fast-direct-corp').matchedAddress.includes('Roosevelt'),'Exclude wrong New York location');
assert.ok(!allPoints.get('cust-129-sklum-home-and-deco-s-l').matchedAddress.includes('Andalusia'),'Exclude wrong Spanish town');
assert.equal(allPoints.get('cust-154-ove-decors').verificationLevel,'street','Conflicting postcode is not a rooftop');
const customerAudit=JSON.parse(read('CUSTOMER_LOCATION_RESEARCH.json'));
assert.equal(customerAudit.publishedLocated,123);
const liFung=allPoints.get('cust-037-li-fung');
assert.equal(liFung.verificationLevel,'address','Li & Fung must point at the verified building');
assert.equal(liFung.osmId,354995756,'LiFung Tower OSM way');
assert.equal(liFung.osmType,'way');
assert.equal(customerAudit.missing,0);

console.log('Unified map / ISO tests passed: 123/123 source-linked customers (49 exact, 22 street, 52 administrative).');
