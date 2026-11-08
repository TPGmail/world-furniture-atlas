/* World Furniture Atlas v2.0: OpenStreetMap + Leaflet, only validated real address points.
 * No browser geocoding, no guessed coordinates, no legacy offsets, no Google APIs.
 * Geocoding is a one-time audited data-preparation step, not a production search API. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const entries = Array.isArray(window.ATLAS_CUSTOMER_ADDRESSES) ? window.ATLAS_CUSTOMER_ADDRESSES : [];
  const rawPoints = Array.isArray(window.ATLAS_VERIFIED_CUSTOMER_POINTS) ? window.ATLAS_VERIFIED_CUSTOMER_POINTS : [];
  const entryById = new Map(entries.map(row => [row.id, row]));
  const valid = point => point && entryById.has(point.id) &&
      Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
      Number.isFinite(point.lon) && Math.abs(point.lon) <= 180 &&
      point.verificationLevel === 'address' &&
      point.checkedAddress === entryById.get(point.id).address &&
      ['node','way','relation'].includes(point.osmType) &&
      Number.isSafeInteger(Number(point.osmId)) && Number(point.osmId) > 0;
  // Never silently coerce city/street-level matches into a pin.
  const pointById = new Map(rawPoints.filter(valid).map(p => [p.id, p]));
  const countriesBtn = $('map-mode-countries');
  const customersBtn = $('map-mode-customers');
  const pane = $('atlas-customer-pane');
  const countryMap = $('map-container');
  const fallback = $('map-fallback');
  const legend = document.querySelector('.map-legend');
  const statusCountry = $('map-status');
  const reset = $('reset-map-btn');
  const mapStatus = $('customer-osm-status');
  const mapCanvas = $('leaflet-map-canvas');
  const search = $('customer-address-search');
  const verifiedList = $('customer-verified-list');
  const unverifiedList = $('customer-unverified-list');
  const verifiedDetails = $('customer-verified-directory');
  const unverifiedDetails = $('customer-unverified-directory');
  const verifiedCount = $('customer-verified-count');
  const unverifiedCount = $('customer-unverified-count');
  const pinCount = $('customer-pin-count');
  const sizeNames = {large:'Chuỗi / lớn',medium:'Trading / vừa',small:'Nhỏ / cá nhân'};
  const radii = {large:2,medium:1.2,small:0.8};
  const osmLink = point => `https://www.openstreetmap.org/${point.osmType}/${point.osmId}`;
  const osmSearch = address => 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(address);
  const fmtCount = n => n.toLocaleString('vi-VN');
  let map = null;
  const markerById = new Map();
  let currentMode = 'customers';

  const el = (tag, value='', cls='') => {
    const node = document.createElement(tag);
    if (value) node.textContent = value;
    if (cls) node.className = cls;
    return node;
  };
  function makeLink(text, href) {
    const link = el('a',text);
    link.href=href;
    link.target='_blank';
    link.rel='noopener noreferrer';
    return link;
  }
  function popupFor(rows, point) {
    const container=el('div','','atlas-leaflet-popup');
    rows.forEach((r,index)=>{
      if(index)container.appendChild(document.createElement('hr'));
      container.appendChild(el('strong',r.name));
      container.appendChild(el('p',r.address));
      container.appendChild(el('small',sizeNames[r.sizeCategory] || 'Chưa rõ'));
      container.appendChild(el('small',r.addressSource==='user_excel' ? 'Nguồn địa chỉ: Excel khách hàng (chưa xác minh hiện trạng doanh nghiệp)' : 'Nguồn địa chỉ: website/đăng ký doanh nghiệp'));
    });
    const actions=el('div');
    actions.appendChild(makeLink('Xem vị trí OSM',osmLink(point)));
    if(rows[0].sourceUrl && /^https:\/\//.test(rows[0].sourceUrl))actions.appendChild(makeLink('Nguồn địa chỉ',rows[0].sourceUrl));
    container.appendChild(actions);
    return container;
  }
  function setupMap() {
    if(map) return;
    if(!window.L){
      mapStatus.textContent='Không tải được Leaflet. Danh bạ địa chỉ vẫn sử dụng được; thử tải lại trang.';
      return;
    }
    map=window.L.map(mapCanvas,{
      center:[15,12],zoom:2,minZoom:2,maxZoom:18,
      zoomControl:true,worldCopyJump:true,preferCanvas:false
    });
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(map);
    // The visible dot is intentionally tiny; an independent invisible hit area
    // preserves mouse and touch interactions without moving the true GPS coordinate.
    const groups=new Map();
    for(const [id,p] of pointById){
      const row=entryById.get(id);
      if(!row)continue;
      const key=`${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;
      const group=groups.get(key) || {point:p,rows:[]};
      group.rows.push(row);
      groups.set(key,group);
    }
    const bounds=[];
    for(const group of groups.values()){
      const pt=group.point;
      const coords=[pt.lat,pt.lon];
      const dotRadius=Math.max(...group.rows.map(row=>radii[row.sizeCategory]??0.8));
      const hit=window.L.circleMarker(coords,{
        radius:20,stroke:false,fillOpacity:0.001,fillColor:'#f43f5e',
        interactive:true,className:'atlas-leaflet-dot-target'
      }).addTo(map);
      window.L.circleMarker(coords,{
        radius:dotRadius,weight:0.25,color:'#ffffff',
        fillColor:'#ef4444',fillOpacity:1,interactive:false
      }).addTo(map);
      hit.bindPopup(popupFor(group.rows,pt),{maxWidth:280,closeButton:true});
      hit.bindTooltip(group.rows.map(r=>r.name).join(' · '),{direction:'top',offset:[0,-10]});
      for(const row of group.rows)markerById.set(row.id,hit);
      bounds.push(coords);
    }
    if(bounds.length===1){map.setView(bounds[0],14);}
    else if(bounds.length>1){map.fitBounds(bounds,{padding:[40,40],maxZoom:12});}
    mapStatus.textContent=pointById.size
      ? `${pointById.size}/${entries.length} địa chỉ có tọa độ OSM đã đối chiếu. ${entries.length-pointById.size} địa chỉ chưa đạt điều kiện, không hiện chấm.`
      : `Chưa có tọa độ nhà hoặc địa điểm kinh doanh xác minh trên OSM trong dữ liệu. Không hiển thị chấm ước lượng.`;
  }
  function setMode(mode){
    currentMode=mode;
    const customer=mode==='customers';
    pane.hidden=!customer;
    countryMap.classList.toggle('atlas-hidden',customer);
    if(fallback)fallback.classList.toggle('atlas-hidden',customer);
    countriesBtn.classList.toggle('active',!customer);
    customersBtn.classList.toggle('active',customer);
    countriesBtn.setAttribute('aria-pressed',String(!customer));
    customersBtn.setAttribute('aria-pressed',String(customer));
    if(legend)legend.classList.toggle('atlas-hidden',customer);
    if(statusCountry)statusCountry.classList.toggle('atlas-hidden',customer);
    if(reset)reset.classList.toggle('atlas-hidden',customer);
    if(customer){setupMap();if(map)requestAnimationFrame(()=>map.invalidateSize());}
  }
  function matches(row,q){return `${row.name} ${row.address} ${row.market}`.toLocaleLowerCase('vi').includes(q);}
  function appendItem(row,located,into){
    const item=el('li');
    item.appendChild(el('strong',row.name));
    item.appendChild(el('span',row.address));
    item.appendChild(el('small',`${sizeNames[row.sizeCategory]||'Chưa rõ'} · ${row.locationType||'Địa chỉ'}`));
    const actions=el('div','','customer-list-actions');
    if(located){
      const btn=el('button','Xem chấm đỏ');btn.type='button';
      btn.addEventListener('click',()=>{
        setMode('customers');setupMap();
        const point=pointById.get(row.id), marker=markerById.get(row.id);
        if(point && map && marker){map.setView([point.lat,point.lon],Math.max(map.getZoom(),15));marker.openPopup();}
      });
      actions.appendChild(btn);
      actions.appendChild(makeLink('Bản ghi OSM',osmLink(pointById.get(row.id))));
    } else {
      actions.appendChild(makeLink('Tra cứu OSM',osmSearch(row.address)));
    }
    item.appendChild(actions);into.appendChild(item);
  }
  function renderDirectory(){
    const needle=search.value.trim().toLocaleLowerCase('vi');
    const rows=entries.filter(row=>matches(row,needle));
    const verified=rows.filter(row=>pointById.has(row.id));
    const unverified=rows.filter(row=>!pointById.has(row.id));
    verifiedList.replaceChildren();unverifiedList.replaceChildren();
    const vf=document.createDocumentFragment(),uf=document.createDocumentFragment();
    verified.forEach(row=>appendItem(row,true,vf));
    unverified.forEach(row=>appendItem(row,false,uf));
    verifiedList.appendChild(vf);unverifiedList.appendChild(uf);
    verifiedCount.textContent=fmtCount(verified.length);
    unverifiedCount.textContent=fmtCount(unverified.length);
    pinCount.textContent=`${fmtCount(pointById.size)} / ${fmtCount(entries.length)} GPS`;
    if(needle){verifiedDetails.open=verified.length>0;unverifiedDetails.open=unverified.length>0;}
  }
  search.addEventListener('input',renderDirectory);
  countriesBtn.addEventListener('click',()=>setMode('countries'));
  customersBtn.addEventListener('click',()=>setMode('customers'));
  renderDirectory();
  setMode('customers');
})();