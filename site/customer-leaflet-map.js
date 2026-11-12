/* Furniverse customer map: exact addresses plus clearly identified approximate
 * street or administrative reference locations. No falsely precise office pins.
 * All points come from cached one-time OSM research, never client-side geocoding. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const entries = Array.isArray(window.ATLAS_CUSTOMER_ADDRESSES) ? window.ATLAS_CUSTOMER_ADDRESSES : [];
    const rawPoints = Array.isArray(window.ATLAS_VERIFIED_CUSTOMER_POINTS) ? window.ATLAS_VERIFIED_CUSTOMER_POINTS : [];
    const researchedPoints = Array.isArray(window.ATLAS_RESEARCHED_CUSTOMER_POINTS) ? window.ATLAS_RESEARCHED_CUSTOMER_POINTS : [];
    const corroboratedPoints = Array.isArray(window.ATLAS_CORROBORATED_CUSTOMER_POINTS) ? window.ATLAS_CORROBORATED_CUSTOMER_POINTS : [];
    const isoResolver = window.FURNIVERSE_COUNTRY_ISO;
    const entryById = new Map(entries.map(row => [row.id, row]));
    const valid = point => point && entryById.has(point.id) &&
        Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
        Number.isFinite(point.lon) && Math.abs(point.lon) <= 180 &&
        (point.verificationLevel === 'address' ||
            (['street','postal','administrative'].includes(point.verificationLevel) &&
             point.verificationSource === 'OpenStreetMap Nominatim (one-time research)') ||
            point.verificationSource === 'openstreetmap-regional-record-crosscheck' ||
            point.verificationSource === 'public-web-address-crosscheck' ||
            point.verificationSource === 'public-geonames-locality' ||
            point.verificationSource === 'public-regional-locality') &&
        point.checkedAddress === entryById.get(point.id).address &&
        ((['node','way','relation'].includes(point.osmType) &&
          Number.isSafeInteger(Number(point.osmId)) && Number(point.osmId) > 0) ||
         (['public-web-address-crosscheck','public-geonames-locality','public-regional-locality'].includes(point.verificationSource) &&
          typeof point.sourceUrl === 'string' && /^https:\/\//i.test(point.sourceUrl)));
    // Preserve originally verified exact addresses; curated corrections override
    // only newly generated research candidates for the same customer.
    const pointById = new Map([
        ...researchedPoints.filter(valid).map(point => [point.id,point]),
        ...corroboratedPoints.filter(valid).map(point => [point.id,point]),
        ...rawPoints.filter(valid).map(point => [point.id,point])
    ]);
    const preciseCount = [...pointById.values()].filter(p => p.verificationLevel === 'address').length;
    const areaCount = pointById.size - preciseCount;
    const mapCanvas = $('leaflet-map-canvas');
    const pane = $('atlas-customer-pane');
    const countryToggle = $('layer-countries');
    const customerToggle = $('layer-customers');
    const directory = document.querySelector('.customer-osm-controls');
    const toggleDirectory = $('customer-directory-toggle');
    const search = $('customer-address-search');
    const isoFilter = $('customer-country-filter');
    const statusFilter = $('customer-status-filter');
    const verifiedList = $('customer-verified-list');
    const unverifiedList = $('customer-unverified-list');
    const verifiedDetails = $('customer-verified-directory');
    const unverifiedDetails = $('customer-unverified-directory');
    const verifiedCount = $('customer-verified-count');
    const unverifiedCount = $('customer-unverified-count');
    const pinCount = $('customer-pin-count');
    const mapStatus = $('customer-osm-status');
    const sizeLabels = {large:'Chuỗi / lớn',medium:'Trading / vừa',small:'Nhỏ / cá nhân'};
    const sizeRadius = {large:5,medium:4,small:3};
    const osmLink = point => point.sourceUrl ||
        'https://www.openstreetmap.org/' + point.osmType + '/' + point.osmId;
    const osmSearch = address => 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(address);
    const fmt = n => n.toLocaleString('vi-VN');
    const markerById = new Map();
    const countryById = new Map();
    const initialCenter = [18,10];
    let map = null;
    let baseTiles = null;
    let customersLayer = null;
    let countriesLayer = null;
    let loadedFeatureCount = 0;
    let selectedCountryId = '';

    const el = (tag,value='',cls='') => {
        const node = document.createElement(tag);
        if(value) node.textContent = value;
        if(cls) node.className = cls;
        return node;
    };
    const link = (text,href) => {
        const node = el('a',text);
        node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
        return node;
    };
    function isoFor(row) { return isoResolver ? isoResolver.forCustomer(row) : null; }
    function isoLabel(code) {
        if(!code) return '';
        try {
            if(typeof Intl.DisplayNames === 'function') {
                return new Intl.DisplayNames(['vi'],{type:'region'}).of(code) || code;
            }
        } catch (_) {}
        return code;
    }
    function normalized(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
            .replace(/đ/gi,'d').toLocaleLowerCase('vi');
    }
    function updateMapStatus() {
        if(!mapStatus) return;
        mapStatus.textContent = fmt(preciseCount) + ' địa chỉ khớp · ' +
            fmt(areaCount) + ' khu vực gần đúng';
    }
    function popupFor(rows,point) {
        const container = el('div','','atlas-leaflet-popup');
        rows.forEach((row,index) => {
            if(index) container.appendChild(document.createElement('hr'));
            container.appendChild(el('strong',row.name));
            container.appendChild(el('p',row.address));
            const rowPoint = pointById.get(row.id);
            if (rowPoint) {
                const label = rowPoint.verificationLevel === 'address'
                    ? 'Khớp số nhà/tòa nhà' :
                    (rowPoint.precisionLabel || 'Khu vực tham chiếu');
                container.appendChild(el('small',label,'customer-popup-precision'));
                if (rowPoint.verificationLevel !== 'address') {
                    container.appendChild(el('small','Vị trí gần đúng, không xác nhận trụ sở doanh nghiệp.','customer-popup-precision-note'));
                }
            }
            const country = isoFor(row);
            const metadata = [isoLabel(country),sizeLabels[row.sizeCategory]].filter(Boolean).join(' · ');
            if(metadata) container.appendChild(el('small',metadata,'customer-popup-iso'));
        });
        const actions = el('div');
        actions.appendChild(link(point.verificationSource === 'public-web-address-crosscheck'
            ? 'Xem địa chỉ' : 'Nguồn bản đồ',osmLink(point)));
        if(rows[0].sourceUrl && /^https:\/\//i.test(rows[0].sourceUrl))
            actions.appendChild(link('Nguồn địa chỉ',rows[0].sourceUrl));
        container.appendChild(actions);
        return container;
    }
    function buildMarkers() {
        const groups = new Map();
        for(const [id,point] of pointById) {
            const row = entryById.get(id);
            const key = point.lat.toFixed(7) + ',' + point.lon.toFixed(7);
            const group = groups.get(key) || {point,rows:[]};
            group.rows.push(row); groups.set(key,group);
        }
        for(const group of groups.values()) {
            const point = group.point;
            const coords = [point.lat,point.lon];
            // The transparent touch target does NOT shift the verified point.
            const hit = window.L.circleMarker(coords,{
                pane:'atlasCustomerPane',radius:18,stroke:false,
                fillColor:'#ef4444',fillOpacity:0.001,interactive:true
            }).addTo(customersLayer);
            const radius = Math.max(...group.rows.map(row => sizeRadius[row.sizeCategory] || 3));
            const exact = point.verificationLevel === 'address';
            window.L.circleMarker(coords,{
                pane:'atlasCustomerPane',radius:exact ? radius : radius + 2,
                weight:exact ? 1 : 2,color:exact ? '#fff' : '#d97706',
                fillColor:exact ? '#ef4444' : '#fbbf24',
                fillOpacity:exact ? 1 : 0.25,interactive:false
            }).addTo(customersLayer);
            hit.bindPopup(popupFor(group.rows,point),{maxWidth:300,closeButton:true});
            const tooltip = el('span',group.rows.map(row => row.name).join(' · ') +
                (point.verificationLevel === 'address' ? '' : ' · gần đúng'));
            hit.bindTooltip(tooltip,{direction:'top',offset:[0,-12]});
            group.rows.forEach(row => markerById.set(row.id,hit));
        }
    }
    function colorState() {
        return window.AtlasMapBridge && window.AtlasMapBridge.getColorState ?
            window.AtlasMapBridge.getColorState() :
            {selected:[],noted:[],active:false,matched:[]};
    }
    function geoStyle(feature) {
        const id = String(feature.id);
        const state = colorState();
        const selected = selectedCountryId === id || state.selected.includes(id);
        const noted = state.noted.includes(id);
        const matched = state.matched.includes(id);
        const dark = document.documentElement.dataset.theme !== 'light';
        if(selected) return {pane:'atlasCountryPane',color:'#059669',weight:2,fillColor:'#10b981',fillOpacity:.34,opacity:.92};
        if(state.active) return matched
            ? {pane:'atlasCountryPane',color:'#2563eb',weight:1.8,fillColor:'#3b82f6',fillOpacity:.23,opacity:.85}
            : {pane:'atlasCountryPane',color:dark?'#64748b':'#94a3b8',weight:.5,fillOpacity:.012,opacity:.24};
        if(noted) return {pane:'atlasCountryPane',color:'#059669',weight:1.2,fillColor:'#10b981',fillOpacity:.18,opacity:.78};
        return {pane:'atlasCountryPane',color:dark?'#64748b':'#64748b',
            weight:.85,fillColor:dark?'#334155':'#cbd5e1',fillOpacity:.045,opacity:.72};
    }
    function refreshCountryStyles() {
        if(countriesLayer) countriesLayer.setStyle(geoStyle);
    }
    function loadCountries() {
        if(!map || countriesLayer || !window.AtlasMapBridge) return;
        const raw = window.AtlasMapBridge.getFeatures();
        if(!Array.isArray(raw) || !raw.length) return;
        // The old "International Styles" pseudo-island is a catalogue topic, not geography.
        const features = raw.filter(feature => feature && feature.type === 'Feature' &&
            feature.geometry && feature.id !== 'intl-island')
            .map(feature => window.FurniverseDateLine?.fix(feature,window.d3) || feature);
        if(!features.length) return;
        countriesLayer = window.L.geoJSON({type:'FeatureCollection',features},{
            pane:'atlasCountryPane',
            style:geoStyle,
            onEachFeature: (feature,layer) => {
                const id = String(feature.id);
                countryById.set(id,layer);
                const label = el('span',String(feature.properties && feature.properties.name || id));
                layer.bindTooltip(label,{sticky:true,direction:'auto'});
                layer.on('click', () => {
                    selectedCountryId = id;
                    if(window.AtlasMapBridge && window.AtlasMapBridge.chooseCountry)
                        window.AtlasMapBridge.chooseCountry(id,feature.properties.name);
                    else window.FurniverseCountry?.open(id,feature.properties.name);
                    refreshCountryStyles();
                });
            }
        });
        loadedFeatureCount = features.length;
        if(countryToggle.checked) countriesLayer.addTo(map);
        refreshCountryStyles();
        updateLayerStatus();
    }
    function updateLayerStatus() {
        const label = $('map-layer-status');
        if(!label) return;
        label.textContent = (countriesLayer ? 'Biên giới sẵn sàng' : 'Đang tải biên giới') +
            ' · ' + fmt(preciseCount) + ' địa chỉ · ' + fmt(areaCount) + ' khu vực';
    }
    function applyLayerVisibility() {
        if(!map) return;
        if(countriesLayer) {
            if(countryToggle.checked && !map.hasLayer(countriesLayer)) countriesLayer.addTo(map);
            else if(!countryToggle.checked && map.hasLayer(countriesLayer)) map.removeLayer(countriesLayer);
        }
        if(customersLayer) {
            if(customerToggle.checked && !map.hasLayer(customersLayer)) customersLayer.addTo(map);
            else if(!customerToggle.checked && map.hasLayer(customersLayer)) map.removeLayer(customersLayer);
        }
        if(directory) directory.classList.toggle('layer-disabled',!customerToggle.checked);
    }
    function resetView() {
        if(!map) return false;
        map.closePopup();
        map.setView(initialCenter,2);
        selectedCountryId = '';
        refreshCountryStyles();
        return true;
    }
    function focusCountry(id) {
        if(!map) return false;
        const layer = countryById.get(String(id));
        if(!layer) return false;
        const bounds = layer.getBounds();
        if(!bounds || !bounds.isValid()) return false;
        map.fitBounds(bounds,{padding:[42,42],maxZoom:7});
        selectedCountryId = String(id);
        refreshCountryStyles();
        return true;
    }
    function openCustomerPin(row) {
        const point = pointById.get(row.id), marker = markerById.get(row.id);
        if(!point || !map || !marker) return false;
        if(!customerToggle.checked) { customerToggle.checked = true; applyLayerVisibility(); }
        const maxDetail = point.verificationLevel === 'address' ? 15 :
            point.verificationLevel === 'street' ? 12 : 9;
        map.setView([point.lat,point.lon],maxDetail);
        marker.openPopup();
        if(window.matchMedia('(max-width: 900px)').matches && directory &&
            !directory.classList.contains('is-collapsed') && toggleDirectory) toggleDirectory.click();
        return true;
    }
    function populateIsoFilter() {
        const all = [...new Set(entries.map(isoFor).filter(Boolean))].sort((a,b)=>
            isoLabel(a).localeCompare(isoLabel(b),'vi'));
        isoFilter.replaceChildren(new Option('Tất cả quốc gia',''));
        all.forEach(code => isoFilter.add(new Option(isoLabel(code) + ' · ' + code,code)));
        // Only countries with a resolved ISO code are offered.
    }
    function makeItem(row,located) {
        const item = el('li','','customer-card');
        const head = el('div','','customer-card-head');
        head.appendChild(el('strong',row.name));
        const code = isoFor(row);
        if(code) head.appendChild(el('span',code,'customer-iso-tag'));
        item.appendChild(head);
        item.appendChild(el('span',row.address,'customer-address-text'));
        const location = row.locationType || 'Địa chỉ';
        const point = pointById.get(row.id);
        const precision = point ? point.verificationLevel === 'address' ?
            'Địa chỉ chính xác' : 'Khu vực tham chiếu' : '';
        const meta = [sizeLabels[row.sizeCategory],location,precision].filter(Boolean).join(' · ');
        if(meta) item.appendChild(el('small',meta,'customer-card-meta'));
        const actions = el('div','','customer-list-actions');
        if(located) {
            const button = el('button','Xem trên bản đồ');
            button.type='button';
            button.addEventListener('click',()=>openCustomerPin(row));
            actions.appendChild(button);
            actions.appendChild(link('Nguồn vị trí',osmLink(pointById.get(row.id))));
        } else {
            actions.appendChild(link('Tìm trên bản đồ',osmSearch(row.address)));
        }
        item.appendChild(actions);
        return item;
    }
    function renderDirectory() {
        if(!verifiedList || !unverifiedList) return;
        const needle = normalized(search.value.trim());
        const selectedISO = isoFilter.value;
        const selectedStatus = statusFilter.value;
        const matching = entries.filter(row => {
            const code = isoFor(row);
            if(selectedISO && (selectedISO === '__unknown' ? !!code : code !== selectedISO)) return false;
            const gps = pointById.has(row.id);
            if(selectedStatus === 'gps' && !gps) return false;
            if(selectedStatus === 'missing' && gps) return false;
            return !needle || normalized([row.name,row.address,row.market,code].join(' ')).includes(needle);
        });
        const located = matching.filter(row => pointById.has(row.id));
        const missing = matching.filter(row => !pointById.has(row.id));
        verifiedList.replaceChildren(...located.map(row=>makeItem(row,true)));
        unverifiedList.replaceChildren(...missing.map(row=>makeItem(row,false)));
        verifiedCount.textContent = fmt(located.length);
        unverifiedCount.textContent = fmt(missing.length);
        pinCount.textContent = fmt(pointById.size) + ' / ' + fmt(entries.length) + ' có vị trí';
        verifiedDetails.hidden = selectedStatus === 'missing' || !located.length;
        unverifiedDetails.hidden = selectedStatus === 'gps' || !missing.length;
        if(needle || selectedISO || selectedStatus !== 'all') {
            if(located.length) verifiedDetails.open = true;
            if(missing.length) unverifiedDetails.open = true;
        }
        const count = $('customer-filter-count');
        if(count) count.textContent = fmt(matching.length) + ' địa chỉ phù hợp';
    }
    function showCustomersForCountry(id) {
        if(!isoResolver) return false;
        const code = isoResolver.forAtlasId(id);
        if(!code || ![...isoFilter.options].some(option => option.value === code)) return false;
        search.value = ''; isoFilter.value = code; statusFilter.value = 'all';
        renderDirectory();
        if(directory && directory.classList.contains('is-collapsed') && toggleDirectory) toggleDirectory.click();
        return true;
    }
    // OpenFreeMap vector labels prefer Vietnamese OSM names, with a local-name fallback.
    // Never infer or translate a place name when the underlying map has no name:vi.
    function localizeMapLabels(glMap) {
        if (!glMap || !glMap.isStyleLoaded()) return;
        const layers = glMap.getStyle()?.layers || [];
        const vietnameseName = ['coalesce',
            ['get','name:vi'],['get','name:latin'],['get','name']];
        layers.forEach(layer => {
            if (layer.type !== 'symbol' || !layer.layout?.['text-field']) return;
            const sourceLayer = String(layer['source-layer'] || '');
            // Leave house numbers, road shields, transport refs and icons intact.
            if (!['place','poi','transportation_name','water_name','waterway'].includes(sourceLayer)) return;
            try {
                glMap.setLayoutProperty(layer.id,'text-field',vietnameseName);
            } catch (error) {
                console.warn('Unable to localize map label',layer.id,error);
            }
        });
    }
    function rasterBasemap(dark) {
        const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
        const layer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {maxZoom:19,attribution});
        layer.addTo(map);
        const container = layer.getContainer();
        if (container) container.style.filter = dark
            ? 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9)' : '';
        return layer;
    }
    function setBasemapTheme() {
        if (!map || !window.L) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        let next;
        if (typeof window.L.maplibreGL === 'function' && window.maplibregl?.supported?.()) {
            try {
                const style = 'https://tiles.openfreemap.org/styles/' + (dark ? 'dark' : 'bright');
                next = window.L.maplibreGL({style,attribution:'© OpenFreeMap · © OpenStreetMap contributors'});
                next.addTo(map);
                const glMap = next.getMaplibreMap();
                let styleReady = false;
                glMap.on('style.load',() => {
                    styleReady = true;
                    if (baseTiles === next) localizeMapLabels(glMap);
                });
                glMap.on('error',event => {
                    if (baseTiles !== next) return;
                    console.warn('Vector basemap error:',event.error);
                    if (!styleReady) {
                        window.requestAnimationFrame(() => {
                            if (!map || baseTiles !== next || styleReady) return;
                            const fallback = rasterBasemap(dark);
                            map.removeLayer(next);
                            baseTiles = fallback;
                            refreshCountryStyles();
                        });
                    }
                });
                if (glMap.isStyleLoaded()) {
                    styleReady = true;
                    localizeMapLabels(glMap);
                }
            } catch (error) {
                console.warn('Falling back to OpenStreetMap raster basemap:',error);
                if (next && map.hasLayer(next)) map.removeLayer(next);
                next = null;
            }
        }
        if (!next) next = rasterBasemap(dark);
        if (baseTiles) map.removeLayer(baseTiles);
        baseTiles = next;
        refreshCountryStyles();
    }
    function setupMap() {
        if(!window.L || !mapCanvas || !pane) {
            pane.hidden = true;
            if(mapStatus) mapStatus.textContent = 'Không tải được Leaflet; dùng bản đồ dự phòng.';
            return;
        }
        try {
            pane.hidden = false;
            map = window.L.map(mapCanvas,{
                center:initialCenter,zoom:2,minZoom:2,maxZoom:18,
                zoomControl:true,worldCopyJump:true,preferCanvas:false
            });
            setBasemapTheme();
            map.createPane('atlasCountryPane');
            map.getPane('atlasCountryPane').style.zIndex = '410';
            map.createPane('atlasCustomerPane');
            map.getPane('atlasCustomerPane').style.zIndex = '450';
            customersLayer = window.L.layerGroup();
            buildMarkers();
            applyLayerVisibility();
            document.documentElement.classList.add('atlas-unified-ready');
            updateLayerStatus();
            loadCountries();
            document.addEventListener('atlas:geography-ready',loadCountries);
            document.addEventListener('furniverse:theme-change',setBasemapTheme);
            if(typeof ResizeObserver === 'function') {
                let raf = 0;
                new ResizeObserver(() => {
                    cancelAnimationFrame(raf);
                    raf = requestAnimationFrame(()=>map.invalidateSize({pan:false}));
                }).observe(mapCanvas.parentElement);
            }
            window.addEventListener('orientationchange',()=>map.invalidateSize({pan:false}));
        } catch(error) {
            console.error('Furniverse unified map setup:',error);
            document.documentElement.classList.remove('atlas-unified-ready');
            pane.hidden = true;
            map = null;
            if(mapStatus) mapStatus.textContent = 'Bản đồ hợp nhất không tải được; sử dụng bản đồ dự phòng.';
        }
    }
    if(!search || !isoFilter || !statusFilter || !countryToggle || !customerToggle) return;
    populateIsoFilter();
    search.addEventListener('input',renderDirectory);
    isoFilter.addEventListener('change',renderDirectory);
    statusFilter.addEventListener('change',renderDirectory);
    countryToggle.addEventListener('change',applyLayerVisibility);
    customerToggle.addEventListener('change',applyLayerVisibility);
    renderDirectory();
    updateMapStatus();
    setupMap();
    window.FurniverseMap = Object.freeze({
        focusCountry,resetView,refreshCountryStyles,showCustomersForCountry,
        getStats:()=>({total:entries.length,verified:preciseCount,located:pointById.size,approximate:areaCount,countryFeatures:loadedFeatureCount}),
        hasMap:()=>!!map
    });
})();
