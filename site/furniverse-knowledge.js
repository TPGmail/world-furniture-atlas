/* Furniverse Knowledge Explorer: keeps the existing map, notes and cloud sync untouched. */
(function () {
  "use strict";
  const db = window.FURNIVERSE_KNOWLEDGE_V1;
  const mapArea = document.querySelector(".map-area");
  if (!db || !mapArea || !Array.isArray(db.topics)) return;
  const topicMap = Object.fromEntries(db.topics.map(t => [t.id,t]));
  const safe = v => String(v == null ? "" : v).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normalize = v => /^\d{1,3}$/.test(String(v)) ? String(v).padStart(3,"0") : String(v);
  const validUrl = value => {
    try {const x = new URL(String(value)); return /^https?:$/.test(x.protocol) ? x.href : "";}
    catch (_) {return "";}
  };
  const sources = ids => (ids || []).map(id => db.sources[id]).filter(x => x && validUrl(x.url))
    .map(s => '<a href="'+safe(validUrl(s.url))+'" target="_blank" rel="noopener noreferrer">'+safe(s.title)+'</a>').join(" · ");
  const countryItems = id => db.topics.flatMap(topic => topic.entries.filter(e =>
    Array.isArray(e.countries) && e.countries.includes(normalize(id)) &&
    (e.sources || []).some(s => db.sources[s] && validUrl(db.sources[s].url)))
    .map(e => ({topic,e})));
  const countryHTML = id => {
    const items = countryItems(id);
    if (!items.length) return "";
    return '<div class="fvk-country-articles">' + items.map(({topic,e}) =>
      '<article class="fvk-country-article"><strong>'+safe(topic.icon+' '+e.title)+'</strong>'+
      '<p>'+safe(e.body)+'</p><div class="fvk-small-sources">'+sources(e.sources)+'</div></article>').join("")+
      '<button type="button" class="fvk-country-open" data-knowledge-open="'+safe(normalize(id))+
      '">Khám phá 12 chuyên đề Furniverse</button></div>';
  };
  const trigger = document.createElement("button");
  trigger.id = "fvk-trigger";
  trigger.type = "button";
  trigger.className = "fvk-trigger";
  trigger.textContent = "✦ Khám phá";
  trigger.title = "Mở thư viện kiến thức nội thất Furniverse";
  trigger.setAttribute("aria-label","Mở 12 chuyên đề kiến thức nội thất");
  trigger.setAttribute("aria-expanded","false");
  trigger.setAttribute("aria-controls","fvk-drawer");
  mapArea.appendChild(trigger);

  const drawer = document.createElement("aside");
  drawer.id = "fvk-drawer";
  drawer.className = "fvk-drawer";
  drawer.hidden = true;
  drawer.setAttribute("aria-label","Thư viện kiến thức Furniverse");
  drawer.innerHTML = '<header class="fvk-head"><div><span class="fvk-kicker">FURNIVERSE · KNOWLEDGE EXPLORER</span>'+
    '<h2>Khám phá nội thất thế giới</h2><p>12 chuyên đề · nội dung gắn nguồn</p></div>'+
    '<button class="fvk-close" type="button" data-fvk="close" aria-label="Đóng thư viện">×</button></header>'+
    '<div class="fvk-scroll"><label class="fvk-search-label" for="fvk-search">Tìm trong thư viện</label>'+
    '<input id="fvk-search" type="search" placeholder="Gỗ, tiêu chuẩn, thiết kế, logistics...">'+
    '<nav class="fvk-nav" id="fvk-nav" aria-label="12 chuyên đề"></nav>'+
    '<div id="fvk-content" class="fvk-content" aria-live="polite"></div></div>'+
    '<footer class="fvk-foot">Nguồn tài liệu được dẫn ngay dưới từng mục. Số liệu không cập nhật tự động.</footer>';
  mapArea.appendChild(drawer);
  const contentEl = drawer.querySelector("#fvk-content");
  const nav = drawer.querySelector("#fvk-nav");
  const search = drawer.querySelector("#fvk-search");
  const state = {topic:"wood",q:"",species:"oak",time:2,step:0,country:"",check:new Set(),flow:{r:"704",p:"840",year:"2025",loading:false,result:""}};
  let previousFocus = null;
  const labelFor = id => {
    const brief = window.ATLAS_BRIEFS_V15?.records?.[id];
    const names = {"704":"Việt Nam","380":"Italy","458":"Malaysia","076":"Brazil"};
    return names[id] || brief?.tag || id;
  };
  const itemCard = e => '<article class="fvk-article"><h4>'+safe(e.title)+'</h4><p>'+safe(e.body)+
    '</p><div class="fvk-cites">'+sources(e.sources)+'</div></article>';
  function renderWood() {
    const species = db.wood.find(x => x.id === state.species) || db.wood[0];
    return '<div class="fvk-feature"><h4>🌳 Bộ sưu tập vật liệu</h4>'+
      '<div class="fvk-picks" role="group" aria-label="Chọn loài gỗ">'+db.wood.map(x =>
      '<button type="button" data-fvk="species" data-id="'+safe(x.id)+'" aria-pressed="'+(species.id===x.id)+'">'+
      safe(x.name)+'</button>').join("")+'</div>'+
      '<div class="fvk-specimen"><span class="fvk-grain" aria-hidden="true"></span><div>'+
      '<h4>'+safe(species.name)+'</h4><p><i>'+safe(species.scientific)+'</i></p>'+
      '<p>'+safe(species.traits)+'</p><p><b>Ứng dụng:</b> '+safe(species.use)+'</p>'+
      '<div class="fvk-cites">'+sources(species.sources)+'</div></div></div>'+
      '<p class="fvk-note">Minh họa vân gỗ mang tính biểu tượng, không phải ảnh nhận dạng loài.</p></div>';
  }
  function renderTimeline() {
    const moment = db.timeline[state.time] || db.timeline[0];
    return '<div class="fvk-feature"><h4>🎨 Du hành lịch sử thiết kế</h4>'+
      '<div class="fvk-timeline-head"><button type="button" data-fvk="time-prev" '+(state.time===0?"disabled":"")+
      '>← Trước</button><strong>'+safe(moment.year)+'</strong><button type="button" data-fvk="time-next" '+
      (state.time===db.timeline.length-1?"disabled":"")+'>Sau →</button></div>'+
      '<input class="fvk-range" id="fvk-time-range" aria-label="Chọn mốc lịch sử" type="range" min="0" max="'+
      (db.timeline.length-1)+'" step="1" value="'+state.time+'">'+
      '<div class="fvk-moment"><h4>'+safe(moment.title)+'</h4><p>'+safe(moment.description)+'</p>'+
      '<div class="fvk-cites">'+sources(moment.sources)+'</div></div></div>';
  }
  function renderAnatomy() {
    const part = db.anatomy[state.step] || db.anatomy[0];
    return '<div class="fvk-feature"><h4>📐 Giải phẫu một tủ gỗ</h4>'+
      '<div class="fvk-anatomy"><svg viewBox="0 0 210 175" role="img" aria-label="Sơ đồ cabinet với vách, ngăn và chân">'+
      '<rect x="42" y="15" width="128" height="128" rx="3" fill="none" stroke="currentColor" stroke-width="5"/>'+
      '<path d="M42 52H170 M42 96H170" stroke="currentColor" stroke-width="3"/>'+
      '<path d="M52 145v20 M160 145v20" stroke="currentColor" stroke-width="7"/>'+
      '<path d="M98 53v42" stroke="currentColor" stroke-width="3" stroke-dasharray="5 4"/>'+
      '<circle cx="149" cy="73" r="4" fill="currentColor"/>'+
      '<path d="M24 17H8 M186 17h16 M24 145H8 M186 145h16" stroke="currentColor" stroke-width="2"/>'+
      '</svg><div class="fvk-anatomy-text"><p class="fvk-step">Công đoạn '+(state.step+1)+' / '+db.anatomy.length+'</p>'+
      '<h4>'+safe(part.title)+'</h4><p>'+safe(part.body)+'</p><div class="fvk-cites">'+sources(part.sources)+'</div></div></div>'+
      '<div class="fvk-picks" role="group" aria-label="Chọn công đoạn">'+db.anatomy.map((x,i) =>
      '<button type="button" data-fvk="step" data-step="'+i+'" aria-pressed="'+(i===state.step)+'">'+(i+1)+'</button>').join("")+
      '</div></div>';
  }
  function renderTrade() {
    const list = Object.entries(window.FURNIVERSE_INDUSTRY?.profiles || {}).filter(([id,p]) =>
      p.trade && p.trade.some(t => t.year && t.value && window.ATLAS_BRIEFS_V15?.sources?.[t.source]?.url));
    if (!list.length) return "";
    const flowCountries = [["704","Việt Nam"],["840","Mỹ"],["276","Đức"],["826","Anh"],
      ["124","Canada"],["036","Australia"],["380","Italy"],["392","Nhật Bản"],
      ["458","Malaysia"],["076","Brazil"],["528","Hà Lan"],["752","Thụy Điển"]];
    const options = chosen => flowCountries.map(([id,name]) =>
      '<option value="'+id+'"'+(chosen===id?" selected":"")+'>'+safe(name)+'</option>').join("");
    const flow = '<div class="fvk-flow"><h4>Tra cứu luồng thương mại song phương · HS 9403</h4>'+
      '<div class="fvk-flow-controls"><label>Nước xuất khẩu<select id="fvk-flow-from">'+options(state.flow.r)+'</select></label>'+
      '<label>Nước nhập khẩu<select id="fvk-flow-to">'+options(state.flow.p)+'</select></label>'+
      '<label>Năm<select id="fvk-flow-year">'+["2025","2024","2023"].map(y =>
        '<option value="'+y+'"'+(state.flow.year===y?" selected":"")+'>'+y+'</option>').join("")+'</select></label></div>'+
      '<div class="fvk-flow-arrow"><b>'+safe(labelFor(state.flow.r))+'</b><span>→</span><b>'+safe(labelFor(state.flow.p))+'</b></div>'+
      '<button type="button" data-fvk="flow-run" '+(state.flow.loading?"disabled":"")+'>'+
      (state.flow.loading?"Đang tra dữ liệu...":"Tra UN Comtrade")+'</button>'+
      (state.flow.result?'<div class="fvk-flow-result" role="status">'+safe(state.flow.result)+'</div>':"")+
      '<p class="fvk-note">Truy vấn API preview công khai của UN Comtrade theo HS 9403, chiều xuất khẩu. '+
      'Kết quả chỉ hiển thị nếu tìm được bản ghi tổng hợp đúng quốc gia, năm và mã HS.</p></div>';
    return '<div class="fvk-feature"><h4>🌐 Dữ liệu thương mại được công bố</h4>'+flow+
      '<p class="fvk-note">Các chỉ tiêu có phạm vi khác nhau, không phải số liệu giao thương song phương. Chọn quốc gia để mở trên bản đồ.</p>'+
      '<div class="fvk-trade-list">'+list.map(([id,p]) =>
      '<article><strong>'+safe(labelFor(id))+'</strong>'+
      p.trade.filter(t => t.year && t.value && window.ATLAS_BRIEFS_V15?.sources?.[t.source]?.url)
      .map(t => '<p>'+safe(t.metric)+': <b>'+safe(t.value)+'</b> ('+safe(t.year)+')</p>'+
      '<div class="fvk-cites"><a href="'+safe(validUrl(window.ATLAS_BRIEFS_V15.sources[t.source].url))+
      '" target="_blank" rel="noopener noreferrer">'+safe(window.ATLAS_BRIEFS_V15.sources[t.source].title)+'</a></div>').join("")+
      '<button type="button" data-fvk="map" data-id="'+safe(id)+'">Xem quốc gia trên bản đồ</button></article>').join("")+'</div>'+
      '<p class="fvk-note">Phân tích luồng song phương và HS: <a href="https://comtradeplus.un.org/" target="_blank" rel="noopener noreferrer">UN Comtrade</a>.</p></div>';
  }
  async function loadTradeFlow() {
    if (state.flow.loading) return;
    if (state.flow.r === state.flow.p) {
      state.flow.result = "Hãy chọn hai quốc gia khác nhau.";
      renderContent();return;
    }
    state.flow.loading=true;state.flow.result="";renderContent();
    try {
      const q = new URL("https://comtradeapi.un.org/public/v1/preview/C/A/HS");
      for(const [k,v] of Object.entries({
        period:state.flow.year,reporterCode:state.flow.r,partnerCode:state.flow.p,
        cmdCode:"9403",flowCode:"X",maxRecords:"500"
      }))q.searchParams.set(k,v);
      const response=await fetch(q.toString(),{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const body=await response.json();
      const rows=Array.isArray(body.data)?body.data:[];
      const found=rows.find(row => String(row.cmdCode)==="9403" &&
        String(row.reporterCode)===state.flow.r && String(row.partnerCode)===state.flow.p &&
        String(row.flowCode)==="X" && Number.isFinite(Number(row.primaryValue)));
      if(found) {
        const number=Number(found.primaryValue);
        state.flow.result="UN Comtrade · "+state.flow.year+" · HS 9403: "+
          number.toLocaleString("vi-VN",{maximumFractionDigits:0})+
          " USD (giá trị xuất khẩu báo cáo; dữ liệu preview, không phải dự báo).";
      } else {
        state.flow.result="Không tìm thấy bản ghi tổng hợp trong API preview. Xem nguồn UN Comtrade để tra cứu chi tiết.";
      }
    } catch (_) {
      state.flow.result="Không truy cập được API preview từ trình duyệt. Có thể tra cứu trực tiếp tại UN Comtrade theo cùng bộ lọc.";
    } finally {state.flow.loading=false;renderContent();}
  }
  function renderOpportunity() {
    const labels=["Đã đối chiếu số liệu nhập khẩu theo HS và năm","Đã xem năng lực sản xuất phù hợp",
      "Đã kiểm tra pháp lý của sản phẩm","Đã xác định điều kiện giao hàng và logistics"];
    return '<div class="fvk-feature"><h4>🧭 Checklist nghiên cứu thị trường</h4>'+
      '<p class="fvk-note">Danh sách tự đánh giá trong phiên xem, không tạo điểm/xếp hạng thị trường.</p>'+
      labels.map((x,i) => '<label class="fvk-check"><input type="checkbox" data-fvk-check="'+i+'" '+
      (state.check.has(i)?"checked":"")+'><span>'+safe(x)+'</span></label>').join("")+'</div>';
  }
  const features = {
    wood:renderWood, history:renderTimeline, engineering:renderAnatomy,
    trade:renderTrade, opportunity:renderOpportunity
  };
  function renderNav() {
    nav.innerHTML = db.topics.map(t => '<button type="button" data-fvk="topic" data-id="'+safe(t.id)+
      '" aria-pressed="'+(state.topic===t.id)+'"><span>'+safe(t.icon)+'</span><span>'+safe(t.label)+'</span></button>').join("");
  }
  function renderContent() {
    const terms = state.q.trim().toLocaleLowerCase("vi");
    const selected = topicMap[state.topic] || db.topics[0];
    const entries = (terms ? db.topics.flatMap(t => t.entries.map(e => ({topic:t,e}))) :
      selected.entries.map(e => ({topic:selected,e}))).filter(({topic,e}) =>
      !terms || [topic.title,topic.label,e.title,e.body].join(" ").toLocaleLowerCase("vi").includes(terms));
    const header = terms ? '<h3>Kết quả tìm kiếm</h3>' : '<div class="fvk-topic-top"><span>'+safe(selected.icon)+'</span>'+
      '<div><h3>'+safe(selected.title)+'</h3><p>'+safe(selected.summary)+'</p></div></div>';
    const special = terms ? "" : (features[selected.id]?.() || "");
    const countryHint = state.country ? '<p class="fvk-note">Hồ sơ đang tham chiếu: '+safe(labelFor(state.country))+
      '. Các bài học chung không đại diện cho dữ liệu riêng của quốc gia.</p>' : "";
    contentEl.innerHTML = header + countryHint + special + (entries.length ?
      '<div class="fvk-articles">'+entries.map(({topic,e}) =>
        (terms ? '<small>'+safe(topic.icon+" "+topic.title)+'</small>' : "")+itemCard(e)).join("")+'</div>' :
      '<p class="fvk-note">Không tìm thấy bài học theo từ khóa này.</p>');
    renderNav();
  }
  function open(country) {
    previousFocus = document.activeElement;
    state.country = country ? normalize(country) : "";
    state.q = "";
    search.value = "";
    if(country) {
      const first = db.topics.find(t => t.entries.some(e => e.countries?.includes(state.country)));
      state.topic = first?.id || "wood";
    }
    drawer.hidden = false;
    trigger.setAttribute("aria-expanded","true");
    window.FurniverseCountry?.close?.();
    renderContent();
    drawer.querySelector(".fvk-close").focus({preventScroll:true});
  }
  function close() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    trigger.setAttribute("aria-expanded","false");
    if (previousFocus?.isConnected && typeof previousFocus.focus === "function")
      previousFocus.focus({preventScroll:true});
    else trigger.focus({preventScroll:true});
  }
  trigger.addEventListener("click", () => drawer.hidden ? open("") : close());
  drawer.addEventListener("click", e => {
    const btn = e.target.closest("button[data-fvk]");
    if (!btn) return;
    const action = btn.dataset.fvk;
    if (action === "close") {close();return;}
    if (action === "topic") {state.topic = btn.dataset.id;state.q="";search.value="";renderContent();return;}
    if (action === "species") {state.species=btn.dataset.id;renderContent();return;}
    if (action === "step") {state.step=Math.min(db.anatomy.length-1,Number(btn.dataset.step)||0);renderContent();return;}
    if (action === "time-prev") {state.time=Math.max(0,state.time-1);renderContent();return;}
    if (action === "time-next") {state.time=Math.min(db.timeline.length-1,state.time+1);renderContent();return;}
    if (action === "flow-run") {loadTradeFlow();return;}
    if (action === "map") {
      const id = btn.dataset.id;
      close();
      if (window.AtlasMapBridge?.chooseCountry) window.AtlasMapBridge.chooseCountry(id,labelFor(id));
    }
  });
  drawer.addEventListener("input", e => {
    if (e.target === search) {state.q = search.value;renderContent();}
    if (e.target.id === "fvk-time-range") {state.time=Math.min(db.timeline.length-1,Number(e.target.value)||0);}
    if (e.target.matches("[data-fvk-check]")) {
      const i=Number(e.target.getAttribute("data-fvk-check"));
      if(e.target.checked)state.check.add(i); else state.check.delete(i);
    }
  });
  drawer.addEventListener("change", e => {
    if (e.target.id === "fvk-time-range") {renderContent();return;}
    if (e.target.id === "fvk-flow-from") state.flow.r=e.target.value;
    if (e.target.id === "fvk-flow-to") state.flow.p=e.target.value;
    if (e.target.id === "fvk-flow-year") state.flow.year=e.target.value;
    if (/^fvk-flow-/.test(e.target.id)) state.flow.result="";
  });
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-knowledge-open]");
    if (btn) {e.preventDefault();open(btn.getAttribute("data-knowledge-open"));}
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !drawer.hidden) {e.stopPropagation();close();}
  });
  window.FurniverseKnowledge = Object.freeze({
    open,close,countryHTML,
    hasCountry: id => countryItems(id).length>0,
    topics:() => db.topics.map(t => t.id)
  });
  renderNav();
})();