/* World Furniture Atlas v1.9: Exact customer geocoding ONLY with a Google Map.
   Legacy city centers and artificial x/y offsets are deliberately unused.
   Geocoded coordinates are cached in this browser for at most 28 days. */
(() => {
    'use strict';
    const entries = Array.isArray(window.ATLAS_CUSTOMER_ADDRESSES) ? window.ATLAS_CUSTOMER_ADDRESSES : [];
    const $ = id => document.getElementById(id);
    const countriesBtn = $('map-mode-countries');
    const customersBtn = $('map-mode-customers');
    const panel = $('atlas-customer-pane');
    const countryMap = $('map-container');
    const fallback = $('map-fallback');
    const keyInput = $('google-maps-api-key');
    const connect = $('google-map-connect');
    const geocodeBtn = $('google-map-geocode');
    const status = $('google-map-status');
    const list = $('google-customer-list');
    const searchInput = $('customer-address-search');
    const googleCanvas = $('google-map-canvas');
    const apiSetup = $('google-maps-setup');
    const countryLegend = document.querySelector('.map-legend');
    const countryStatus = $('map-status');
    let mode = 'countries';
    let map = null;
    let geocoder = null;
    let info = null;
    let pins = [];
    let sdkPromise = null;
    let busy = false;
    let abort = false;
    let lastSelected = null;
    const MAPS_KEY_STORE = 'atlas_google_maps_browser_key_v1';
    const GPS_CACHE_STORE = 'atlas_google_rooftop_geocodes_v1';
    const GPS_CACHE_TTL = 28 * 24 * 3600 * 1000;
    const sizeName = {large:'Chuỗi / lớn',medium:'Trading / vừa',small:'Nhỏ / cá nhân'};
    const radius = {large:2,medium:1.2,small:0.8};
    const googleLink = entry => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(entry.name + ', ' + entry.address);
    const setStatus = message => { status.textContent = message; };
    const getCache = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(GPS_CACHE_STORE) || '{}');
            const valid = {};
            for(const [id,record] of Object.entries(raw)) {
                if(record && Number.isFinite(record.t) && Date.now() - record.t < GPS_CACHE_TTL && Number.isFinite(record.lat) && Number.isFinite(record.lng)) valid[id]=record;
            }
            return valid;
        } catch(e) { return {}; }
    };
    const setCache = data => { try { localStorage.setItem(GPS_CACHE_STORE,JSON.stringify(data)); } catch(e) {} };
    const storedKey = (() => {try{return localStorage.getItem(MAPS_KEY_STORE)||'';}catch(e){return'';}})();
    if(storedKey) keyInput.value = storedKey;

    function buildAddressList(filter='') {
        const needle = String(filter).trim().toLocaleLowerCase('vi');
        const shown = entries.filter(e => `${e.name} ${e.address} ${e.market}`.toLocaleLowerCase('vi').includes(needle));
        const frag = document.createDocumentFragment();
        for(const e of shown.slice(0,120)) {
            const item = document.createElement('li');
            item.className='google-customer-item';
            const heading=document.createElement('strong');heading.textContent=e.name;
            const address=document.createElement('span');address.textContent=e.address;
            const tags=document.createElement('small');tags.textContent=`${sizeName[e.sizeCategory]||'Chưa rõ'} · ${e.locationType}`;
            const link=document.createElement('a');link.href=googleLink(e);link.rel='noopener noreferrer';link.target='_blank';link.textContent='Xem trên Google Maps';
            item.append(heading,address,tags,link);frag.appendChild(item);
        }
        list.replaceChildren(frag);
        $('customer-directory-count').textContent = `${shown.length}/${entries.length} khách hàng có địa chỉ để tra cứu`;
    }
    buildAddressList();
    searchInput.addEventListener('input',()=>buildAddressList(searchInput.value));

    function setMode(next) {
        mode=next;
        const isGoogle=next==='customers';
        panel.hidden=!isGoogle;
        countryMap.classList.toggle('atlas-hidden',isGoogle);
        if(fallback)fallback.classList.toggle('atlas-hidden',isGoogle);
        countriesBtn.classList.toggle('active',!isGoogle);
        customersBtn.classList.toggle('active',isGoogle);
        countriesBtn.setAttribute('aria-pressed',String(!isGoogle));
        customersBtn.setAttribute('aria-pressed',String(isGoogle));
        if(countryLegend) countryLegend.classList.toggle('atlas-hidden',isGoogle);
        if(countryStatus) countryStatus.classList.toggle('atlas-hidden',isGoogle);
        const reset=$('reset-map-btn');if(reset)reset.classList.toggle('atlas-hidden',isGoogle);
        if(map && isGoogle) {google.maps.event.trigger(map,'resize');}
    }
    countriesBtn.addEventListener('click',()=>setMode('countries'));
    customersBtn.addEventListener('click',()=>setMode('customers'));

    function loadSDK(key) {
        if(window.google?.maps?.Map) return Promise.resolve();
        if(sdkPromise) return sdkPromise;
        sdkPromise = new Promise((resolve,reject)=>{
            const name = '__atlasGoogleMapReadyV19';
            const script=document.createElement('script');
            let settled=false;
            window[name]=()=>{if(!settled){settled=true;resolve();}};
            script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=${name}&loading=async`;
            script.async=true;
            script.onerror=()=>{if(!settled){settled=true;reject(new Error('Không tải được Google Maps JavaScript API.'));}};
            document.head.appendChild(script);
        });
        return sdkPromise;
    }

    const validRooftop = result => result && !result.partial_match && result.geometry && result.geometry.location_type === 'ROOFTOP' &&
        result.geometry.location && Number.isFinite(result.geometry.location.lat()) && Number.isFinite(result.geometry.location.lng());

    function createSymbol(r) {
        // The 26x26 SVG hitbox is centered on the true GPS coordinate.
        // Visible red-dot radii remain 0.8 / 1.2 / 2 px, with no geographic offsets.
        const img = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="${r}" fill="#e53935" stroke="#ffffff" stroke-width="0.35" /></svg>`;
        return {url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(img), size:new google.maps.Size(26,26), scaledSize:new google.maps.Size(26,26), anchor:new google.maps.Point(13,13)};
    }
    function makeInfoContent(group) {
        const div=document.createElement('div');div.className='atlas-google-info';
        for(const e of group) {
            const h=document.createElement('strong');h.textContent=e.name;
            const address=document.createElement('p');address.textContent=e.address;
            const s=document.createElement('small');s.textContent=(sizeName[e.sizeCategory]||'Chưa rõ')+' · '+e.locationType;
            const a=document.createElement('a');a.href=googleLink(e);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Mở địa chỉ trên Google Maps';
            div.append(h,address,s,a);
        }
        return div;
    }
    function plotVerified(entriesWithCoordinates) {
        for(const p of pins) p.setMap(null);
        pins=[];
        if(!map) return;
        // Same true address => one marker whose popup lists every associated customer.
        const groups=new Map();
        for (const x of entriesWithCoordinates) {
            const groupKey=x.point.lat.toFixed(6)+','+x.point.lng.toFixed(6);
            const group=groups.get(groupKey) || {point:x.point,items:[]};
            group.items.push(x.record);groups.set(groupKey,group);
        }
        const bounds=new google.maps.LatLngBounds();
        for(const group of groups.values()) {
            const maxRadius=Math.max(...group.items.map(e=>radius[e.sizeCategory]||0.8));
            const marker=new google.maps.Marker({position:group.point,map,icon:createSymbol(maxRadius),title:group.items.map(e=>e.name).join(', '),optimized:false});
            marker.addListener('click',()=>{info.setContent(makeInfoContent(group.items));info.open({anchor:marker,map});});
            pins.push(marker);bounds.extend(group.point);
        }
        if(pins.length) {
            map.fitBounds(bounds,45);
            if(pins.length===1)map.setZoom(15);
        }
    }

    async function loadMap() {
        const key=keyInput.value.trim();
        if(!/^[A-Za-z0-9_-]{30,}$/.test(key)) {setStatus('Chưa có Google Maps API key hợp lệ. Bản đồ chưa hiển thị chấm để tránh định vị sai.');keyInput.focus();return;}
        connect.disabled=true;
        setStatus('Đang kết nối Google Maps...');
        try {
            await loadSDK(key);
            if(!window.google?.maps?.Map || !window.google?.maps?.Geocoder)throw new Error('Google Maps API chưa sẵn sàng.');
            map=new google.maps.Map(googleCanvas,{center:{lat:18,lng:20},zoom:2,streetViewControl:false,fullscreenControl:true,mapTypeControl:false,gestureHandling:'greedy'});
            geocoder=new google.maps.Geocoder();
            info=new google.maps.InfoWindow();
            try{localStorage.setItem(MAPS_KEY_STORE,key);}catch(e){}
            apiSetup.open=false;
            googleCanvas.hidden=false;
            geocodeBtn.disabled=false;
            const cache=getCache();
            const prior=entries.filter(e => cache[e.id] && cache[e.id].address === e.address).map(record=>({record,point:{lat:cache[record.id].lat,lng:cache[record.id].lng}}));
            plotVerified(prior);
            setStatus(`Đã kết nối Google Maps. ${prior.length} địa chỉ ROOFTOP còn hiệu lực trong bộ nhớ tạm. Chọn “Xác minh vị trí” để cập nhật những địa chỉ còn lại.`);
        } catch(err) {
            setStatus('Lỗi Google Maps: '+String(err.message||err));
            apiSetup.open=true;
        } finally {connect.disabled=false;}
    }
    connect.addEventListener('click',loadMap);

    async function geocodeAll() {
        if(!geocoder || busy)return;
        busy=true; abort=false;
        geocodeBtn.disabled=true;
        $('google-map-cancel').hidden=false;
        const cache=getCache();
        const ok=[]; let notExact=0,failed=0,cached=0,requests=0;
        for(const record of entries) {
            if(abort)break;
            const existing=cache[record.id];
            if(existing && existing.address===record.address) {
                ok.push({record,point:{lat:existing.lat,lng:existing.lng}});cached++;
            } else {
                let result=null;
                try {
                    const response=await geocoder.geocode({address:record.address});
                    requests++;
                    result=response.results?.find(validRooftop)||null;
                    if(result) {
                        const point={lat:result.geometry.location.lat(),lng:result.geometry.location.lng()};
                        ok.push({record,point});
                        cache[record.id]={address:record.address,lat:point.lat,lng:point.lng,placeId:result.place_id,t:Date.now()};
                    } else notExact++;
                } catch(error) {
                    failed++;
                    if(/OVER_QUERY_LIMIT|REQUEST_DENIED|BILLING_NOT_ENABLED/.test(String(error.message||error))) {
                        setStatus('Google từ chối/giới hạn yêu cầu. Kiểm tra billing, quota và quyền Geocoding API. Dừng để tránh phát sinh yêu cầu lỗi.');
                        break;
                    }
                }
            }
            if((ok.length+notExact+failed)%6===0){plotVerified(ok);setStatus(`${ok.length} đúng mức địa chỉ · ${notExact} chưa đủ chính xác · ${failed} lỗi · ${cached} lấy từ bộ nhớ tạm.`);}
            if(requests>0 && requests%20===0)await new Promise(resolve=>setTimeout(resolve,400));
        }
        setCache(cache);
        plotVerified(ok);
        busy=false;geocodeBtn.disabled=false;$('google-map-cancel').hidden=true;
        setStatus(`${ok.length}/${entries.length} vị trí đạt ROOFTOP${abort?' (đã dừng)':''}; ${notExact} kết quả chưa đủ chính xác không hiện chấm; ${failed} lỗi. ${cached} từ bộ nhớ tạm (tối đa 28 ngày).`);
    }
    geocodeBtn.addEventListener('click',geocodeAll);
    $('google-map-cancel').addEventListener('click',()=>{abort=true;});
    // Default to customer addresses so incomplete coordinates cannot masquerade as real pins.
    setMode('customers');
    setStatus(`Đã xóa dữ liệu tọa độ xấp xỉ cũ. Có ${entries.length} khách hàng có địa chỉ để định vị lại bằng Google Maps. Chưa xác minh GPS, chưa hiện chấm đỏ.`);
})();