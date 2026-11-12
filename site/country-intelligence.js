/* Furniverse Country Intelligence: read-only professional profiles, no invented metrics. */
(function () {
  "use strict";
  const data = window.FURNIVERSE_INDUSTRY;
  const catalogue = window.ATLAS_KNOWLEDGE_V2 && window.ATLAS_KNOWLEDGE_V2.records || {};
  const briefs = window.ATLAS_BRIEFS_V15 || {records:{},sources:{},reviewedOn:""};
  const panel = document.getElementById("industry-panel");
  const roleFilter = document.getElementById("industry-role-filter");
  if (!data || !panel || !roleFilter) return;
  const roles = data.roles;
  const known = data.profiles;
  const state = {id:null,name:"",comparison:[]};
  const html = value => String(value == null ? "" : value).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const key = value => {
    const v = String(value);
    return /^\d{1,3}$/.test(v) ? v.padStart(3,"0") : v;
  };
  const url = value => {
    try { const u = new URL(String(value)); return /^(https?):$/.test(u.protocol) ? u.href : null; }
    catch (_) { return null; }
  };
const sourceLink = id => {
    const item = briefs.sources && briefs.sources[id];
    const href = item && url(item.url);
    return href ? '<a href="' + html(href) + '" target="_blank" rel="noopener noreferrer">' +
      html(item.title || "Tài liệu tham khảo") + "</a>" : "";
  };
  const profile = id => known[key(id)] || null;
  const factBrief = id => briefs.records && briefs.records[key(id)] || null;
  const record = id => catalogue[key(id)] || null;
  const rolesFor = id => profile(id) && profile(id).roles || [];
const badges = (items,kind) => (items || []).filter(Boolean).map(item =>
    '<span class="ic-tag ' + (kind === "role" ? "ic-tag-role" : "") + '">' +
    html(kind === "role" ? roles[item] || item : item) + "</span>").join("");
  const section = (title, body) => body && body.trim() ?
    '<div class="ic-section"><h3>' + html(title) + '</h3>' + body + '</div>' : '';
  const published = id => {
    const brief = factBrief(id);
    return Boolean(brief && brief.summary && Array.isArray(brief.facts) &&
      brief.facts.some(f => f.text && sourceLink(f.source)));
  };
  const flag = id => {
    const two = record(id) && record(id).geography && record(id).geography.isoAlpha2;
    if (!two || !/^[A-Z]{2}$/.test(two)) return "🌐";
    return Array.from(two).map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  };
const facts = id => {
    const brief = factBrief(id);
    const entries = brief && Array.isArray(brief.facts) ? brief.facts.filter(f =>
      f.text && sourceLink(f.source)) : [];
    return entries.length ? '<ul class="ic-facts">' + entries.map(f =>
      "<li>" + html(f.text) + '<div class="ic-source">' +
      sourceLink(f.source) + "</div></li>").join("") + "</ul>" : "";
  };
  function listTerms(id, field) {
    const terms = record(id) && record(id).taxonomy && record(id).taxonomy[field] || [];
    return badges(terms.slice(0,18),"term");
  }
  function customerMatches(id) {
    const geo = window.FURNIVERSE_COUNTRY_ISO;
    const iso2 = geo && geo.forAtlasId(key(id));
    if (!iso2) return [];
    return (window.ATLAS_CUSTOMER_ADDRESSES || []).filter(row => geo.forCustomer(row) === iso2);
  }
function renderOverview(id) {
    return section("Vai trò",badges(rolesFor(id),"role"));
  }
  function renderIndustry(id) {
    const p = profile(id);
    return section("Lĩnh vực",badges(p && p.focus || [],"term")) +
      section("Nguyên liệu",listTerms(id,"materials")) +
      section("Sản phẩm",listTerms(id,"products")) +
      section("Phong cách",listTerms(id,"design_styles"));
  }
  function renderTrade(id) {
    const p = profile(id);
    const rows = (p && p.trade || []).filter(item => item.year && item.metric &&
      item.value && sourceLink(item.source));
    const stats = rows.map(item => '<div class="ic-stat"><span>' +
      html(item.metric) + '</span><strong>' + html(item.value) +
      '</strong><small>Năm ' + html(item.year) + ' · ' +
      sourceLink(item.source) + '</small></div>').join("");
    return stats ? section("Xuất / nhập khẩu",'<div class="ic-stats">' +
      stats + '</div>') : "";
  }
  function renderMarket(id) {
    return section("Quy định thương mại",facts(id)) +
      section("Tiêu chuẩn",listTerms(id,"standards_and_certifications"));
  }
  function addCompare(id) {
    const v = key(id);
    if (!state.comparison.includes(v) && state.comparison.length < 3) state.comparison.push(v);
  }
function renderCompare() {
    const ids = state.comparison.filter(published);
    const candidates = Object.keys(briefs.records || {}).filter(published).sort((a,b) =>
      String(record(a) && record(a).name || a).localeCompare(String(record(b) && record(b).name || b),"vi"));
    const options = candidates.filter(id => !ids.includes(id)).map(id =>
      '<option value="' + html(id) + '">' + html(record(id) && record(id).name ||
      (id === state.id ? state.name : id)) + '</option>').join("");
    const pick = options && ids.length < 3
      ? '<div class="ic-compare-picker"><label for="ic-compare-select">Chọn quốc gia để so sánh</label>' +
        '<select id="ic-compare-select">' + options + '</select>' +
        '<button type="button" data-action="add-picker">Thêm</button></div>' : "";
    if (ids.length < 2) return pick;
    const columns = ids.map(id => '<th>' + html(record(id) && record(id).name ||
      (id === state.id ? state.name : id)) + '<button type="button" data-action="removecompare" data-id="' +
      html(id) + '" title="Loại khỏi so sánh">×</button></th>').join("");
    const rows = [
      ["Vai trò",id => rolesFor(id).map(role => roles[role]).join("; ")],
      ["Khu vực",id => profile(id) && profile(id).region || ""],
      ["Lĩnh vực",id => profile(id) && profile(id).focus && profile(id).focus.join("; ") || ""],
      ["Dữ liệu thương mại",id => profile(id) && profile(id).trade && profile(id).trade.filter(t =>
        t.source && sourceLink(t.source)).map(t => t.metric + ": " + t.value + " (" + t.year + ")").join("; ") || ""]
    ].filter(([_,fn]) => ids.every(id => String(fn(id)).trim()));
    const body = rows.map(([label,fn]) => '<tr><th>' + html(label) + '</th>' +
      ids.map(id => '<td>' + html(fn(id)) + '</td>').join("") + '</tr>').join("");
    return pick + (body ? '<div class="ic-table-scroll"><table class="ic-table"><thead><tr><th>Tiêu chí</th>' +
      columns + '</tr></thead><tbody>' + body + '</tbody></table></div>' : "");
  }
function render() {
    const id = state.id;
    if (!id || !published(id)) { panel.hidden = true; return; }
    const sameCountry = panel.dataset.renderedCountry === id && !panel.hidden;
    const previousBody = panel.querySelector(".ic-body");
    const previousScroll = sameCountry && previousBody ? previousBody.scrollTop : 0;
    const previousSections = sameCountry ? Array.from(panel.querySelectorAll(".ic-unified-section")) : [];
    const expanded = previousSections.length ?
      new Set(previousSections.filter(item => item.open).map(item => item.dataset.section)) :
      new Set(["overview","industry"]);
    const p = profile(id);
    const name = state.name || record(id) && record(id).name || id;
    const heading = '<header class="ic-header"><div class="ic-name"><span class="ic-flag" aria-hidden="true">' +
      html(flag(id)) + '</span><div><h2 id="ic-title">' + html(name) + '</h2>' +
      (p && p.region ? '<p>' + html(p.region) + '</p>' : "") + '</div></div>' +
      '<button class="ic-close" type="button" data-action="close" aria-label="Đóng hồ sơ">×</button></header>';
    const views = [
      ["overview","Tổng quan",renderOverview(id)],
      ["industry","Ngành nội thất",renderIndustry(id)],
      ["trade","Thương mại",renderTrade(id)],
      ["market","Thị trường",renderMarket(id)],
      ["compare","So sánh",renderCompare()]
    ].filter(([_,__,content]) => Boolean(content && content.trim()));
    const body = '<div class="ic-body" role="region" aria-label="Thông tin tổng hợp quốc gia">' +
      views.map(([key,label,content]) => '<details class="ic-unified-section" data-section="' + key + '"' +
        (expanded.has(key) ? " open" : "") + '><summary>' + html(label) +
        '</summary><div class="ic-unified-content">' + content + '</div></details>').join("") + '</div>';
    const comparisonActive = state.comparison.includes(id);
    const footer = '<footer class="ic-footer"><button type="button" data-action="' +
      (comparisonActive ? "removecompare" : "addcompare") + '" data-id="' + html(id) + '"' +
      (!comparisonActive && state.comparison.length >= 3 ? " disabled" : "") + '>' +
      (comparisonActive ? "Bỏ so sánh" : "＋ Thêm so sánh") + ' (' + state.comparison.length + '/3)</button>' +
      '<button type="button" data-action="legacy">Ghi chú</button></footer>';
    panel.innerHTML = heading + body + footer;
    panel.hidden = false;
    panel.dataset.renderedCountry = id;
    panel.querySelector(".ic-body").scrollTop = previousScroll;
  }
  panel.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "close") {panel.hidden = true;return;}
    if (action === "addcompare") {addCompare(btn.dataset.id || state.id);render();return;}
    if (action === "removecompare") {
      state.comparison = state.comparison.filter(id => id !== key(btn.dataset.id));render();return;
    }
    if (action === "add-picker") {
      const choice = panel.querySelector("#ic-compare-select");
      if (choice && choice.value) {addCompare(choice.value);render();}
      return;
    }
    if (action === "legacy") {
      panel.hidden = true;
      if (typeof openModal === "function") openModal(state.id,state.name,
        (typeof savedNotes !== "undefined" && savedNotes[state.id] && savedNotes[state.id].text) ||
        (record(state.id) && record(state.id).text) || "");
    }
  });
  document.addEventListener("keydown",e => {
    if (e.key === "Escape" && !panel.hidden) panel.hidden = true;
  });
  roleFilter.addEventListener("change", () => {
    if (typeof refreshDiscovery === "function") refreshDiscovery();
  });
function open(id,name) {
    const normalized = key(id);
    if (!published(normalized)) return false;
    state.id = normalized;
    state.name = String(name || record(state.id) && record(state.id).name || state.id);
    if (!state.comparison.includes(state.id) && !state.comparison.length) state.comparison.push(state.id);
    render();
    const closeButton = panel.querySelector(".ic-close");
    if (closeButton) closeButton.focus({preventScroll:true});
    return true;
  }
  window.FurniverseCountry = {
    open,
    hasRole:(id,role) => published(id) && rolesFor(id).includes(role),
    hasCountry:published,
    getRoles:id => rolesFor(id).slice(),
    close:() => {panel.hidden = true;}
  };
})();
