const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const site = path.join(__dirname,"..","site");
for (const name of ["app.js","country-intelligence-data.js","country-intelligence.js","atlas-briefs.js","atlas-data.js"]) {
  new vm.Script(fs.readFileSync(path.join(site,name),"utf8"),{filename:name});
}
const win = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(site,"country-intelligence-data.js"),"utf8"),win);
const d = win.window.FURNIVERSE_INDUSTRY;
assert.equal(d.schemaVersion,1);
assert.equal(Object.keys(d.roles).length,6);
assert.ok(Object.keys(d.profiles).length >= 10);
assert.equal(d.profiles["704"].trade[0].year,2025);
assert.equal(d.profiles["704"].trade[0].source,"vn-trade");
assert.ok(Object.entries(d.profiles).every(([id,p])=>p.roles.every(r=>d.roles[r])));
assert.ok(Object.entries(d.profiles).filter(([id,p])=>p.trade).every(([id,p])=>p.trade.every(item=>item.year && item.metric && item.value && item.source)));
const html = fs.readFileSync(path.join(site,"index.html"),"utf8");
for (const x of ["industry-role-filter","industry-panel","country-intelligence.css",
                  "country-intelligence-data.js","country-intelligence.js"]) assert.ok(html.includes(x),x);
assert.ok(html.indexOf('src="app.js"') < html.indexOf('src="country-intelligence.js"'));
assert.ok(html.includes('customer-addresses.js') && !html.includes('customer-points.js'));
assert.ok(html.indexOf('src="country-intelligence-data.js"') < html.indexOf('src="app.js"'));
const app = fs.readFileSync(path.join(site,"app.js"),"utf8");
assert.ok(app.includes("window.FurniverseCountry?.open"));
assert.ok(app.includes("window.FurniverseCountry?.hasRole"));
assert.ok(app.includes("worldFurnitureNotes")); // unchanged browser note storage
console.log("Country Intelligence structural tests passed.");
