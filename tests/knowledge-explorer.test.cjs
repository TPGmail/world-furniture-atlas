const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname,"..");
const site = path.join(root,"site");
const context = {window:{}};
const dataJs = fs.readFileSync(path.join(site,"furniverse-knowledge-data.js"),"utf8");
const uiJs = fs.readFileSync(path.join(site,"furniverse-knowledge.js"),"utf8");
new vm.Script(dataJs,{filename:"furniverse-knowledge-data.js"});
new vm.Script(uiJs,{filename:"furniverse-knowledge.js"});
vm.runInNewContext(dataJs,context);
const db = context.window.FURNIVERSE_KNOWLEDGE_V1;
assert.equal(db.schemaVersion,1);
assert.equal(db.topics.length,12);
assert.ok(db.topics.reduce((sum,topic)=>sum+topic.entries.length,0)>=50);
assert.deepEqual([...db.topics.map(t=>t.id)].sort(),
  ["wood","dna","trade","manufacturing","engineering","compliance","history",
   "logistics","sustainability","retail","opportunity","encyclopedia"].sort());
const expectedSources=new Set(Object.keys(db.sources));
const briefsJs=fs.readFileSync(path.join(site,"atlas-briefs.js"),"utf8");
vm.runInNewContext(briefsJs,context);
const published=new Set(Object.keys(context.window.ATLAS_BRIEFS_V15.records));
for (const t of db.topics) {
  assert.ok(t.title && t.label && t.summary && t.icon);
  assert.ok(t.entries.length>=3);
  for (const e of t.entries) {
    assert.ok(e.title && e.body);
    assert.ok(e.sources?.length>0,"Topic content must cite a source: "+e.title);
    for (const id of e.sources) assert.ok(expectedSources.has(id),"Unknown source "+id);
    for (const country of e.countries||[]) assert.ok(published.has(country),
      "Country-specific material without published country brief: "+country);
  }
}
for(const s of Object.values(db.sources)) {
  assert.match(s.url,/^https:\/\/[^/]+/);
  assert.ok(s.title.length>6);
}
for(const item of [...db.wood,...db.timeline,...db.anatomy]) {
  assert.ok(item.sources.length,"Uncited interactive content");
  for(const id of item.sources) assert.ok(expectedSources.has(id));
}
const html = fs.readFileSync(path.join(site,"index.html"),"utf8");
assert.ok(html.includes('href="furniverse-knowledge.css"'));
assert.ok(html.indexOf('src="furniverse-knowledge-data.js"') <
  html.indexOf('src="furniverse-knowledge.js"'));
assert.ok(html.indexOf('src="app.js"') <
  html.indexOf('src="furniverse-knowledge.js"'));
assert.ok(html.indexOf('src="furniverse-knowledge.js"') <
  html.indexOf('src="country-intelligence.js"'));
const country = fs.readFileSync(path.join(site,"country-intelligence.js"),"utf8");
assert.ok(country.includes("FurniverseKnowledge?.countryHTML(id)"));
assert.ok(uiJs.includes("data-fvk=\"map\""));
assert.ok(uiJs.includes("FurniverseKnowledge = Object.freeze"));
console.log("Furniverse Knowledge: 12 topics, sources and integration validated.");