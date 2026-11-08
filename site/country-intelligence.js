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
      html(item.title || "Nguồn") + "</a>" : '<span class="ic-muted">Nguồn chưa xác định</span>';
  };
  const profile = id => known[key(id)] || null;
  const factBrief = id => briefs.records && briefs.records[key(id)] || null;
  const record = id => catalogue[key(id)] || null;
  const rolesFor = id => profile(id) && profile(id).roles || [];
  const badges = (items,kind) => items.length ? items.map(item =>
    '<span class="ic-tag ' + (kind === "role" ? "ic-tag-role" : "") + '">' +
    html(kind === "role" ? roles[item] || item : item) + "</span>").join("") :
    '<span class="ic-muted">Chưa có dữ liệu được phân loại</span>';
  const flag = id => {
    const two = record(id) && record(id).geography && record(id).geography.isoAlpha2;
    if (!two || !/^[A-Z]{2}$/.test(two)) return "🌐";
    return Array.from(two).map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  };
  const facts = id => {
    const brief = factBrief(id);
    if (!brief || !brief.facts || !brief.facts.length) {
      return '<p class="ic-empty">Chưa có thông tin đã đối chiếu nguồn cho hồ sơ này.</p>';
    }
    return '<ul class="ic-facts">' + brief.facts.map(f =>
      "<li>" + html(f.text) + '<div class="ic-source">Nguồn: ' +
      sourceLink(f.source) + "</div></li>").join("") + "</ul>";
  };
  const caveat = '<p class="ic-caution">Vai trò ngành và từ khóa sản phẩm là phân loại tham khảo, không phải số liệu đã kiểm chứng. ' +
    'Yêu cầu pháp lý phụ thuộc mã HS, sản phẩm và ngày áp dụng.</p>';
  function listTerms(id, field) {
    const terms = record(id) && record(id).taxonomy && record(id).taxonomy[field] || [];
    return terms.length ? badges(terms.slice(0,18),"term") +
      '<p class="ic-caption">Trích tự động từ ghi chú gốc; chưa kiểm chứng chuyên môn.</p>' :
      '<p class="ic-empty">Chưa có danh mục kiểm chứng.</p>';
  }
  function customerMatches(id) {
    const geo = window.FURNIVERSE_COUNTRY_ISO;
    const iso2 = geo && geo.forAtlasId(key(id));
    if (!iso2) return [];
    return (window.ATLAS_CUSTOMER_ADDRESSES || []).filter(row => geo.forCustomer(row) === iso2);
  }
  function externalList() {
    return '<ul class="ic-links">' + data.publicResearch.map(item =>
      '<li><a href="' + html(item.url) + '" target="_blank" rel="noopener noreferrer">' +
      html(item.label) + "</a></li>").join("") + "</ul>";
  }
  function renderOverview(id) {
    const p = profile(id), b = factBrief(id);
    return '<div class="ic-section"><h3>Vai trò trong ngành nội thất</h3>' +
      badges(rolesFor(id),"role") + '<p class="ic-caption">Industry Role: phân loại biên tập, không phải xác nhận chính thức.</p></div>' +
      '<div class="ic-section"><h3>Tổng quan thị trường</h3><p>' +
      html(b ? b.summary : "Quốc gia / vùng lãnh thổ chưa có bản tin ngành được đối chiếu nguồn.") +
      '</p><p class="ic-muted">Khu vực: ' + html(p && p.region || "Chưa phân loại") + '</p></div>' +
      '<div class="ic-section"><h3>Điểm cần biết và nguồn</h3>' + facts(id) + '</div>';
  }
  function renderIndustry(id) {
    const p = profile(id);
    return '<div class="ic-section"><h3>Lĩnh vực trọng tâm</h3>' + badges(p && p.focus || [],"term") +
      '<p class="ic-caption">Các lĩnh vực định hướng cần xác minh thêm trước khi sử dụng để ra quyết định.</p></div>' +
      '<div class="ic-section"><h3>Nguyên liệu từ hồ sơ gốc</h3>' + listTerms(id,"materials") + '</div>' +
      '<div class="ic-section"><h3>Nhóm sản phẩm</h3>' + listTerms(id,"products") + '</div>' +
      '<div class="ic-section"><h3>Phong cách thiết kế</h3>' + listTerms(id,"design_styles") +
      '</div>' + caveat;
  }
  function renderTrade(id) {
    const p = profile(id);
    const rows = p && p.trade || [];
    return '<div class="ic-section"><h3>Xuất / nhập khẩu</h3>' +
      (rows.length ? '<div class="ic-stats">' + rows.map(item =>
        '<div class="ic-stat"><span>' + html(item.metric) + '</span><strong>' +
        html(item.value) + '</strong><small>Năm ' + html(item.year) + ' · ' +
        sourceLink(item.source) + '</small></div>').join("") + '</div>' :
        '<p class="ic-empty">Chưa có số liệu xuất nhập khẩu đã xác minh theo năm, giá trị và mã HS. Không suy diễn từ dữ liệu ghi chú.</p>') +
      '</div><div class="ic-section"><h3>Tra cứu dữ liệu gốc</h3>' + externalList() +
      '<p class="ic-caption">Đối chiếu HS 9403/9401 và HS 44 tùy mục đích; không cộng số liệu ngành gỗ với nội thất.</p></div>';
  }
  function renderMarket(id) {
    return '<div class="ic-section"><h3>Quy định và lưu ý thương mại</h3>' + facts(id) +
      '</div><div class="ic-section"><h3>Tiêu chuẩn trong ghi chú gốc</h3>' +
      listTerms(id,"standards_and_certifications") +
      '</div><div class="ic-section"><h3>Hướng nghiên cứu thị trường</h3>' +
      '<p>Kiểm tra yêu cầu importer, sản phẩm và mã HS; nghiên cứu mức giá, phong cách, quy định vật liệu trước khi lập RFQ.</p>' +
      '</div>' + caveat;
  }
  function renderNetwork(id) {
    const all = customerMatches(id);
    const shown = all.slice(0,35);
    return '<div class="ic-section"><h3>Khách hàng theo quốc gia (ISO)</h3>' +
      '<p class="ic-muted">' + html(all.length) + ' địa chỉ đã liên kết ISO từ quốc gia ghi rõ trong địa chỉ, không dùng thị trường bán hàng.</p>' +
      (shown.length ? '<div class="ic-customer-list">' + shown.map(c => {
        const href = url(c.website);
        const point = (window.ATLAS_VERIFIED_CUSTOMER_POINTS || []).find(p =>
          p.id === c.id && p.checkedAddress === c.address && p.verificationLevel === "address" &&
          ["node","way","relation"].includes(p.osmType) && Number.isSafeInteger(Number(p.osmId)));
        const mapHref = point
          ? "https://www.openstreetmap.org/" + point.osmType + "/" + point.osmId
          : "https://www.openstreetmap.org/search?query=" + encodeURIComponent(c.address || c.name);
        return '<div class="ic-customer"><strong>' + html(c.name) + '</strong><small>' +
          html(c.address || "Chưa có địa chỉ") + '</small><div class="ic-customer-links">' +
          '<a href="' + html(mapHref) + '" target="_blank" rel="noopener noreferrer">' + (point ? "Bản ghi GPS" : "Tra cứu OSM") + '</a>' +
          (href ? '<a href="' + html(href) + '" target="_blank" rel="noopener noreferrer">Website</a>' : "") +
          '</div></div>';
      }).join("") + '</div>' : '<p class="ic-empty">Chưa tìm thấy địa chỉ có tên quốc gia được ghi rõ. Không tự suy đoán từ thị trường xuất khẩu.</p>') +
      (all.length > shown.length ? '<p class="ic-caption">Đang hiển thị 35 địa điểm đầu tiên.</p>' : "") +
      '<p class="ic-caption">Danh bạ chỉ dùng quốc gia ghi rõ trong địa chỉ. Chấm trên bản đồ chỉ dùng tọa độ OSM đã xác minh ở mức địa chỉ. ' +
      'Các ghi chú khách hàng nội bộ không được công bố.</p>' +
      '</div>';
  }
  function addCompare(id) {
    const v = key(id);
    if (!state.comparison.includes(v) && state.comparison.length < 3) state.comparison.push(v);
  }
  function renderCompare() {
    const ids = state.comparison;
    const candidates = Object.keys(known).sort((a,b) =>
      String(record(a) && record(a).name || a).localeCompare(String(record(b) && record(b).name || b),"vi"));
    const options = candidates.filter(id => !ids.includes(id)).map(id =>
      '<option value="' + html(id) + '">' + html(record(id) && record(id).name || id) + '</option>').join("");
    const pick = '<div class="ic-compare-picker"><label for="ic-compare-select">Thêm quốc gia (tối đa 3)</label>' +
      '<select id="ic-compare-select"' + (!options || ids.length >= 3 ? " disabled" : "") + '>' + options + '</select>' +
      '<button type="button" data-action="add-picker"' + (!options || ids.length >= 3 ? " disabled" : "") + '>Thêm</button></div>';
    if (ids.length < 2) return '<p class="ic-empty">Chọn 2 hoặc 3 quốc gia để so sánh vai trò, lĩnh vực và mức độ xác minh.</p>' + pick;
    const columns = ids.map(id => '<th>' + html(record(id) && record(id).name ||
      (id === state.id ? state.name : id)) + '<button type="button" data-action="removecompare" data-id="' +
      html(id) + '" title="Loại khỏi so sánh">×</button></th>').join("");
    const tr = (label,fn) => '<tr><th>' + html(label) + '</th>' +
      ids.map(id => '<td>' + html(fn(id)) + '</td>').join("") + '</tr>';
    const table = '<div class="ic-table-scroll"><table class="ic-table"><thead><tr><th>Tiêu chí</th>' +
      columns + '</tr></thead><tbody>' +
      tr("Vai trò",id => rolesFor(id).map(role => roles[role]).join("; ") || "Chưa phân loại") +
      tr("Khu vực",id => profile(id) && profile(id).region || "Chưa có") +
      tr("Lĩnh vực",id => profile(id) && profile(id).focus.join("; ") || "Chưa có") +
      tr("Dữ liệu thương mại",id => profile(id) && profile(id).trade && profile(id).trade.length ?
        profile(id).trade.map(t => t.metric + ": " + t.value + " (" + t.year + ")").join("; ") : "Chưa có số liệu đối chiếu") +
      tr("Bản tin có nguồn",id => factBrief(id) ? "Có · " + briefs.reviewedOn : "Chưa có") +
      '</tbody></table></div>';
    return pick + table + caveat;
  }
  function render() {
    const id = state.id;
    if (!id) { panel.hidden = true; return; }
    const sameCountry = panel.dataset.renderedCountry === id && !panel.hidden;
    const previousBody = panel.querySelector(".ic-body");
    const previousScroll = sameCountry && previousBody ? previousBody.scrollTop : 0;
    const previousSections = sameCountry ? Array.from(panel.querySelectorAll(".ic-unified-section")) : [];
    const expanded = previousSections.length ? new Set(previousSections.filter(section => section.open).map(section => section.dataset.section)) : new Set(["overview","industry"]);
    const p = profile(id), brief = factBrief(id);
    const name = state.name || record(id) && record(id).name || id;
    const heading = '<header class="ic-header"><div class="ic-name"><span class="ic-flag" aria-hidden="true">' +
      html(flag(id)) + '</span><div><h2 id="ic-title">' + html(name) +
      '</h2><p>' + html(p && p.region || "Chưa phân loại khu vực") + ' · ' +
      (brief ? "Có tài liệu tham khảo" : "Chưa có bản tin đối chiếu") + '</p></div></div>' +
      '<button class="ic-close" type="button" data-action="close" aria-label="Đóng hồ sơ">×</button></header>';
    const views = [
      ["overview","Tổng quan",renderOverview(id)],
      ["industry","Ngành nội thất",renderIndustry(id)],
      ["trade","Thương mại",renderTrade(id)],
      ["market","Thị trường",renderMarket(id)],
      ["network","Khách hàng và liên kết",renderNetwork(id)],
      ["compare","So sánh quốc gia",renderCompare()]
    ];
    const body = '<div class="ic-body" role="region" aria-label="Thông tin tổng hợp quốc gia">' +
      views.map(([key,label,content]) => '<details class="ic-unified-section" data-section="' + key + '"' +
        (expanded.has(key) ? " open" : "") + '><summary>' + html(label) +
        '</summary><div class="ic-unified-content">' + content + '</div></details>').join("") + '</div>';
    const comparisonActive = state.comparison.includes(id);
    const footer = '<footer class="ic-footer"><button type="button" data-action="' +
      (comparisonActive ? "removecompare" : "addcompare") + '" data-id="' + html(id) + '"' +
      (!comparisonActive && state.comparison.length >= 3 ? " disabled" : "") + '>' +
      (comparisonActive ? "Bỏ so sánh" : "＋ Thêm so sánh") + ' (' + state.comparison.length + '/3)</button>' +
      '<button type="button" data-action="legacy">Ghi chú / Chỉnh sửa</button></footer>';
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
    state.id = key(id);
    state.name = String(name || record(state.id) && record(state.id).name || state.id);
    render();
    const closeButton = panel.querySelector(".ic-close");
    if (closeButton) closeButton.focus({preventScroll:true});
    return true;
  }
  window.FurniverseCountry = {
    open,
    hasRole:(id,role) => rolesFor(id).includes(role),
    getRoles:id => rolesFor(id).slice(),
    close:() => {panel.hidden = true;}
  };
})();
