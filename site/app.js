const countrySelect = document.getElementById('country-select');
const selectedChips = document.getElementById('selected-chips');
const noteInput = document.getElementById('note-input');
const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const notesList = document.getElementById('notes-list');
const mapContainer = document.getElementById('map-container');
const tooltip = document.getElementById('tooltip');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipContent = document.getElementById('tooltip-content');
const togglePanelBtn = document.getElementById('toggle-panel-btn');
const controlPanel = document.getElementById('control-panel');
const countrySearch = document.getElementById('country-search');
const searchResults = document.getElementById('search-results');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

// Modal Elements
const noteModal = document.getElementById('note-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalTextarea = document.getElementById('modal-textarea');
const modalEditBtn = document.getElementById('modal-edit-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');

let currentModalCountryId = null;

// Only render a small, safe subset of Markdown. Raw HTML from notes is always escaped.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function safeExternalUrl(raw) {
    try {
        const url = new URL(String(raw).trim());
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch (error) {
        return null;
    }
}

function renderMarkdownInline(input) {
    const str = String(input);
    const linkOrImage = /(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g;
    const renderText = chunk => escapeHtml(chunk)
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    let output = '';
    let previousEnd = 0;
    for (const match of str.matchAll(linkOrImage)) {
        output += renderText(str.slice(previousEnd, match.index));
        const safeUrl = safeExternalUrl(match[3]);
        if (!safeUrl) {
            output += renderText(match[0]);
        } else if (match[1] === '!') {
            output += `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(match[2])}" loading="lazy">`;
        } else {
            output += `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${renderText(match[2])}</a>`;
        }
        previousEnd = match.index + match[0].length;
    }
    return output + renderText(str.slice(previousEnd));
}

function parseMarkdown(text) {
    if (!text) return '';
    const output = [];
    let inList = false;
    const endList = () => {
        if (inList) {
            output.push('</ul>');
            inList = false;
        }
    };
    String(text).split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        const item = trimmed.match(/^[-*]\s+(.+)$/);
        if (item) {
            if (!inList) {
                output.push('<ul>');
                inList = true;
            }
            output.push(`<li>${renderMarkdownInline(item[1])}</li>`);
            return;
        }
        endList();
        const heading = trimmed.match(/^(#{2,3})\s+(.+)$/);
        if (heading) {
            const tag = heading[1].length === 2 ? 'h2' : 'h3';
            output.push(`<${tag}>${renderMarkdownInline(heading[2])}</${tag}>`);
        } else if (trimmed) {
            output.push(`<div class="md-line">${renderMarkdownInline(line)}</div>`);
        } else {
            output.push('<div class="md-gap" aria-hidden="true"></div>');
        }
    });
    endList();
    return output.join('');
}

const atlasMetaSummary = document.getElementById('atlas-meta-summary');
const atlasMetaTags = document.getElementById('atlas-meta-tags');
const atlasVariants = document.getElementById('atlas-variants');
const atlasVariantText = document.getElementById('atlas-variant-text');
const knowledgeSummary = document.getElementById('knowledge-summary');
const mergeCatalogBtn = document.getElementById('merge-catalog-btn');
// Step 3: Faceted search and mobile-first map controls.
const atlasFilters = window.ATLAS_FILTERS_V3;
if (!atlasFilters) throw new Error('Không tải được atlas-filters.js.');
const facetType = document.getElementById('facet-type');
const facetValue = document.getElementById('facet-value');
const onlyNoted = document.getElementById('only-noted');
const clearFiltersBtn = document.getElementById('clear-filters');
const resultsCount = document.getElementById('results-count');
const mapStatus = document.getElementById('map-status');
const resetMapBtn = document.getElementById('reset-map-btn');
const retryMapBtn = document.getElementById('retry-map-btn');
const customerMapData = Array.isArray(window.customerMapData) ? window.customerMapData : [];
let pinnedCustomerId = null;
const mapFallback = document.getElementById('map-fallback');
const panelBackdrop = document.getElementById('panel-backdrop');
const atlasBriefs = window.ATLAS_BRIEFS_V15;
if (!atlasBriefs || atlasBriefs.schemaVersion !== 1) throw new Error('Thiếu atlas-briefs.js.');
const editorTools = document.getElementById('editor-tools');
const priorityView = document.getElementById('view-priority');
const allView = document.getElementById('view-all');
const verifiedBrief = document.getElementById('verified-brief');
const rawNotePanel = document.getElementById('raw-note-panel');
let showAllCatalogue = false;
priorityView.addEventListener('click', () => setCatalogueScope(false));
allView.addEventListener('click', () => setCatalogueScope(true));
function setCatalogueScope(all) {
    showAllCatalogue = Boolean(all);
    priorityView.classList.toggle('active', !all);
    allView.classList.toggle('active', all);
    priorityView.setAttribute('aria-pressed', String(!all));
    allView.setAttribute('aria-pressed', String(all));
    refreshDiscovery();
}
function appendBrief(id) {
    verifiedBrief.replaceChildren();
    const item = atlasBriefs.records[id];
    if (!item) {
        verifiedBrief.hidden = true;
        rawNotePanel.open = true;
        return;
    }
    verifiedBrief.hidden = false;
    rawNotePanel.open = false;
    const label = document.createElement('p');
    label.className = 'brief-eyebrow';
    label.textContent = item.category + ' · Đối chiếu ' + atlasBriefs.reviewedOn;
    const summary = document.createElement('p');
    summary.className = 'brief-summary';
    summary.textContent = item.summary;
    const list = document.createElement('ul');
    list.className = 'brief-points';
    for (const fact of item.facts) {
        const li = document.createElement('li');
        li.appendChild(document.createTextNode(fact.text + ' '));
        const src = atlasBriefs.sources[fact.source];
        if (src) {
            const a = document.createElement('a');
            a.href = src.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = 'Nguồn chính thức'; a.title = src.title;
            li.appendChild(a);
        }
        list.appendChild(li);
    }
    verifiedBrief.append(label, summary, list);
}


function renderAtlasMetadata(id, displayedText) {
    const record = atlasKnowledgeV2.records[id];
    atlasMetaTags.replaceChildren();
    atlasVariants.classList.add('hidden');
    atlasVariantText.textContent = '';
    if (!record) {
        atlasMetaSummary.textContent = 'Ghi chú riêng; chưa có trong danh mục chuẩn v1.2.';
        return;
    }
    const origin = record.provenance.primary === 'user_export'
        ? 'Bản JSON người dùng đã xuất' : 'Ghi chú mặc định của dự án';
    const edited = record.text !== displayedText;
    const warning = record.provenance.comparison === 'conflict' ? ' • 2 phiên bản nguồn' : '';
    atlasMetaSummary.textContent = `Nguồn ưu tiên: ${origin}${warning}` +
        (edited ? ' • Nội dung trên trình duyệt khác bản tham chiếu' : '') +
        ' • Chưa kiểm chứng thông tin';
    const categories = {
        materials: 'Vật liệu', products: 'Sản phẩm', design_styles: 'Phong cách',
        standards_and_certifications: 'Tiêu chuẩn', geographies_mentioned: 'Địa danh nhắc đến'
    };
    for (const [field, label] of Object.entries(categories)) {
        const values = record.taxonomy[field] || [];
        if (!values.length) continue;
        const item = document.createElement('div');
        item.className = 'atlas-taxonomy-row';
        const title = document.createElement('strong');
        title.textContent = label + ': ';
        item.append(title, document.createTextNode(values.join(' · ')));
        atlasMetaTags.appendChild(item);
    }
    if (record.review.flags && record.review.flags.length) {
        const flag = document.createElement('p');
        flag.className = 'atlas-review-warning';
        flag.textContent = 'Cần rà soát: ' + record.review.flags.join(' | ');
        atlasMetaTags.appendChild(flag);
    }
    const conflict = atlasKnowledgeV2.conflicts[id];
    if (conflict) {
        atlasVariants.classList.remove('hidden');
        atlasVariantText.textContent =
            'BẢN MẶC ĐỊNH (lưu riêng, không ghi đè):\n' + conflict.default.text +
            '\n\nBẢN JSON XUẤT (nguồn ưu tiên khi cài mới):\n' + conflict.export.text;
    }
}

function openModal(id, title, text) {
    currentModalCountryId = id;
    modalTitle.textContent = title;
    modalText.innerHTML = parseMarkdown(text);
    modalTextarea.value = text;
    renderAtlasMetadata(id, text);
    appendBrief(id);
    
    modalText.classList.remove('hidden');
    modalTextarea.classList.add('hidden');
    modalEditBtn.classList.remove('hidden');
    modalSaveBtn.classList.add('hidden');
    
    noteModal.classList.remove('hidden');
}

modalEditBtn.addEventListener('click', () => {
    rawNotePanel.open = true;
    modalText.classList.add('hidden');
    modalTextarea.classList.remove('hidden');
    modalEditBtn.classList.add('hidden');
    modalSaveBtn.classList.remove('hidden');
    modalTextarea.focus();
});

modalSaveBtn.addEventListener('click', () => {
    if (currentModalCountryId) {
        const newText = modalTextarea.value.trim();
        if (newText) {
            const nextNotes = { ...savedNotes,
                [currentModalCountryId]: {
                    ...savedNotes[currentModalCountryId],
                    name: savedNotes[currentModalCountryId]?.name || atlasKnowledgeV2.records[currentModalCountryId]?.name || modalTitle.textContent,
                    text: newText,
                    timestamp: Date.now()
                }
            };
            if (!persistNotes(nextNotes)) return;
            modalText.innerHTML = parseMarkdown(newText);
            renderAtlasMetadata(currentModalCountryId, newText);
            
            if (currentSelection.length === 1 && currentSelection[0].id === currentModalCountryId) {
                noteInput.value = newText;
            }
            
            renderNotesList();
            updateMapColors();
            
            modalText.classList.remove('hidden');
            modalTextarea.classList.add('hidden');
            modalEditBtn.classList.remove('hidden');
            modalSaveBtn.classList.add('hidden');
        }
    }
});

function closeModal() {
    noteModal.classList.add('hidden');
}

closeModalBtn.addEventListener('click', closeModal);
noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) {
        closeModal();
    }
});

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const iconSun = themeToggleBtn.querySelector('.icon-sun');
const iconMoon = themeToggleBtn.querySelector('.icon-moon');

const savedTheme = localStorage.getItem('worldFurnitureTheme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('worldFurnitureTheme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    if (theme === 'light') {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
    } else {
        iconSun.style.display = 'block';
        iconMoon.style.display = 'none';
    }
}

const mobilePanelQuery = window.matchMedia('(max-width: 900px)');
function setPanelOpen(isOpen) {
    controlPanel.classList.toggle('hidden', !isOpen);
    togglePanelBtn.setAttribute('aria-expanded', String(isOpen));
    panelBackdrop.classList.toggle('is-open', isOpen && mobilePanelQuery.matches);
    // On desktop the map region changes width. ResizeObserver recalculates the geometry.
}
function alignPanelWithViewport() { setPanelOpen(!mobilePanelQuery.matches); }
mobilePanelQuery.addEventListener?.('change', alignPanelWithViewport);
alignPanelWithViewport();
togglePanelBtn.addEventListener('click', () => setPanelOpen(controlPanel.classList.contains('hidden')));
panelBackdrop.addEventListener('click', () => setPanelOpen(false));
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!noteModal.classList.contains('hidden')) closeModal();
    else if (mobilePanelQuery.matches) setPanelOpen(false);
});

// Import / Export Logic
function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportBtn.addEventListener('click', () => {
    if (notesStorageReadOnly && corruptedNotesRaw !== null) {
        downloadTextFile(corruptedNotesRaw, 'world_furniture_notes_RECOVERY.txt', 'text/plain;charset=utf-8');
        return;
    }
    downloadTextFile(JSON.stringify(savedNotes, null, 2),
        'world_furniture_notes_' + new Date().toISOString().slice(0, 10) + '.json',
        'application/json;charset=utf-8');
});

importBtn.addEventListener('click', () => {
    importFile.click();
});

const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_ENTRIES = 500;
const MAX_NOTE_LENGTH = 100000;

function normalizeImportedNotes(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('File phải chứa đối tượng JSON gồm các ghi chú.');
    }
    const entries = Object.entries(data);
    if (entries.length > MAX_IMPORT_ENTRIES) {
        throw new Error('File vượt giới hạn 500 ghi chú.');
    }
    const normalized = Object.create(null);
    for (const [id, item] of entries) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
            ['__proto__', 'constructor', 'prototype'].includes(id) ||
            !item || typeof item !== 'object' || Array.isArray(item) ||
            typeof item.name !== 'string' || !item.name.trim() || item.name.length > 400 ||
            typeof item.text !== 'string' || !item.text.trim() || item.text.length > MAX_NOTE_LENGTH) {
            throw new Error(`Dữ liệu ghi chú không hợp lệ tại ID: ${id}`);
        }
        normalized[id] = {
            name: item.name,
            text: item.text,
            timestamp: Number.isFinite(item.timestamp) && item.timestamp >= 0
                ? item.timestamp : Date.now()
        };
    }
    return normalized;
}

importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (notesStorageReadOnly) {
        alert('Dữ liệu lưu trong trình duyệt đang lỗi. Vui lòng xuất file khôi phục trước khi nhập.');
        importFile.value = '';
        return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
        alert('File vượt quá 5 MB, đã hủy nhập.');
        importFile.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = normalizeImportedNotes(JSON.parse(reader.result));
            const ids = Object.keys(imported);
            const conflicts = ids.filter(id => Object.hasOwn(savedNotes, id) &&
                (savedNotes[id].name !== imported[id].name || savedNotes[id].text !== imported[id].text));
            // Conservative default: cancel means keep current notes and only add new IDs.
            const replaceConflicts = conflicts.length > 0 && confirm(
                `Có ${conflicts.length} ghi chú trùng ID nhưng khác nội dung.\n` +
                'OK: thay thế bằng nội dung file nhập.\n' +
                'Cancel: giữ ghi chú hiện có, chỉ nhập ID mới.');
            const nextNotes = { ...savedNotes };
            let added = 0;
            let replaced = 0;
            for (const [id, note] of Object.entries(imported)) {
                if (!Object.hasOwn(nextNotes, id)) {
                    nextNotes[id] = note;
                    added++;
                } else if (replaceConflicts && conflicts.includes(id)) {
                    nextNotes[id] = note;
                    replaced++;
                }
            }
            if ((added || replaced) && !persistNotes(nextNotes)) return;
            updateMapColors();
            renderNotesList();
            if (currentSelection.length === 1 && savedNotes[currentSelection[0].id]) {
                noteInput.value = savedNotes[currentSelection[0].id].text;
            }
            alert(`Nhập hoàn tất: ${added} ghi chú mới, ${replaced} ghi chú thay thế, ` +
                `${ids.length - added - replaced} ghi chú được giữ nguyên.`);
        } catch (error) {
            console.error('Import rejected:', error);
            alert(`Không thể nhập dữ liệu: ${error.message}`);
        } finally {
            importFile.value = '';
        }
    };
    reader.onerror = () => {
        alert('Không thể đọc file.');
        importFile.value = '';
    };
    reader.readAsText(file);
});

// State
let countriesData = [];

// Bước 2: one reviewed, versioned dataset. Do NOT auto-overwrite browser edits.
const atlasKnowledgeV2 = window.ATLAS_KNOWLEDGE_V2;
if (!atlasKnowledgeV2 || atlasKnowledgeV2.schemaVersion !== 2 || !atlasKnowledgeV2.records) {
    throw new Error('Không tải được atlas-data.js (dữ liệu Atlas v1.2).');
}
const defaultNotes = Object.fromEntries(Object.entries(atlasKnowledgeV2.records).map(([id, item]) => [id, {
    name: item.name, text: item.text, timestamp: item.timestamp
}]));

// Legacy users' browser notes are authoritative. Defaults are seeded ONLY on first use.
// In particular, never delete country 156 or overwrite existing records during upgrades.
const CURRENT_NOTES_VERSION = 4;
const NOTES_STORAGE_KEY = 'worldFurnitureNotes';
let notesStorageReadOnly = false;
let corruptedNotesRaw = null;
let savedNotes = Object.create(null);

function loadNotes() {
    let raw;
    try {
        raw = localStorage.getItem(NOTES_STORAGE_KEY);
    } catch (error) {
        notesStorageReadOnly = true;
        alert('Trình duyệt không cho truy cập localStorage. Bạn chỉ có thể xem dữ liệu mặc định.');
        return { ...defaultNotes };
    }
    if (raw === null) {
        const initial = { ...defaultNotes };
        if (!persistNotes(initial)) {
            // Keep default content available for read even if storage is unavailable.
            return initial;
        }
        try {
            localStorage.setItem('worldFurnitureNotesVersion', String(CURRENT_NOTES_VERSION));
        } catch (error) {
            console.warn('Unable to record data version:', error);
        }
        return initial;
    }
    try {
        const notes = normalizeImportedNotes(JSON.parse(raw));
        // Back up the exact original browser value once before an upgrade.
        if (localStorage.getItem('worldFurnitureNotesVersion') !== String(CURRENT_NOTES_VERSION)) {
            try {
                if (localStorage.getItem('worldFurnitureNotesBackupBeforeV4') === null) {
                    localStorage.setItem('worldFurnitureNotesBackupBeforeV4', raw);
                }
                localStorage.setItem('worldFurnitureNotesVersion', String(CURRENT_NOTES_VERSION));
            } catch (error) {
                console.warn('Unable to create version backup (original untouched):', error);
            }
        }
        return notes;
    } catch (error) {
        notesStorageReadOnly = true;
        corruptedNotesRaw = raw;
        alert('Dữ liệu ghi chú lưu trong trình duyệt không hợp lệ. Ứng dụng đã khóa ghi để tránh mất dữ liệu. Hãy bấm Export để tải file khôi phục.');
        console.error('Unreadable notes. Original localStorage value is preserved:', error);
        return Object.create(null);
    }
}

function persistNotes(nextNotes) {
    if (notesStorageReadOnly) {
        alert('Bộ nhớ đang ở chế độ chỉ đọc để bảo vệ dữ liệu gốc.');
        return false;
    }
    try {
        const nextRaw = JSON.stringify(nextNotes);
        const previousRaw = localStorage.getItem(NOTES_STORAGE_KEY);
        // Keep a rollback snapshot before every actual change.
        if (previousRaw !== null && previousRaw !== nextRaw) {
            localStorage.setItem('worldFurnitureNotesLastBackup', previousRaw);
        }
        localStorage.setItem(NOTES_STORAGE_KEY, nextRaw);
        savedNotes = nextNotes;
        if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('atlas:notes-changed'));
        }
        return true;
    } catch (error) {
        console.error('Notes could not be saved:', error);
        alert('Không thể lưu ghi chú (có thể do đầy bộ nhớ hoặc trình duyệt chặn lưu trữ). Nội dung cũ chưa bị thay đổi. Hãy Export để sao lưu.');
        return false;
    }
}

savedNotes = loadNotes();

// Optional opt-in for existing installations. No automatic merge after an upgrade.
function refreshKnowledgeSummary() {
    const knownIds = Object.keys(atlasKnowledgeV2.records);
    const missingCount = knownIds.filter(id => !Object.hasOwn(savedNotes, id)).length;
    knowledgeSummary.textContent =
        `${knownIds.length} hồ sơ chuẩn, ${atlasKnowledgeV2.summary.conflictCount} cặp nguồn khác nhau. ` +
        (missingCount ? `${missingCount} hồ sơ chưa có trên trình duyệt.` : 'Đã có đủ ID chuẩn.');
    mergeCatalogBtn.disabled = notesStorageReadOnly || missingCount === 0;
}

mergeCatalogBtn.addEventListener('click', () => {
    const missingIds = Object.keys(defaultNotes).filter(id => !Object.hasOwn(savedNotes,id));
    if (!missingIds.length) return;
    const confirmText =
        `Bổ sung ${missingIds.length} hồ sơ còn thiếu từ danh mục v1.2?\n` +
        'Ghi chú đã tồn tại sẽ KHÔNG bị thay thế.\n' +
        'LƯU Ý: thao tác này cũng có thể khôi phục ghi chú bạn từng chủ động xóa.\n' +
        'Hệ thống sẽ lưu bản sao dự phòng trước khi ghi.';
    if (!confirm(confirmText)) return;
    const nextNotes = { ...savedNotes };
    for (const id of missingIds) nextNotes[id] = { ...defaultNotes[id] };
    if (!persistNotes(nextNotes)) return;
    renderNotesList();
    updateMapColors();
    alert(`Đã bổ sung ${missingIds.length} hồ sơ. Không ghi đè các ghi chú hiện có.`);
});

let currentSelection = []; // Array to store multiple selections {id, name}
let viewedCountry = null;
let mapFeatures = [];
let mapReady = false;
let mapLoadInProgress = false;
let mapError = null;
function currentFilterOptions() {
    return { query: countrySearch.value.trim(), facet: facetType.value,
        value: facetValue.value, onlyNoted: onlyNoted.checked };
}
function isDiscoveryActive() {
    return Boolean(countrySearch.value.trim() || facetType.value || onlyNoted.checked);
}
function getDiscoveryMatches() {
    const entries = atlasFilters.buildEntries(atlasKnowledgeV2.records, savedNotes);
    return atlasFilters.filterEntries(entries, currentFilterOptions());
}
function updateFacetValueOptions() {
    const prior = facetValue.value;
    const options = atlasFilters.facetValues(atlasFilters.buildEntries(atlasKnowledgeV2.records, savedNotes), facetType.value);
    facetValue.replaceChildren(new Option('Tất cả từ khóa', ''));
    for (const item of options) facetValue.add(new Option(`${item.value} (${item.count})`, item.value));
    facetValue.value = options.some(item => item.value === prior) ? prior : '';
    facetValue.disabled = !facetType.value || options.length === 0;
}
function updateMapStatus() {
    if (mapError) { mapStatus.textContent = 'Bản đồ chưa tải được. Vẫn có thể tìm kiếm, xem và chỉnh sửa hồ sơ.'; return; }
    const matches = getDiscoveryMatches();
    const count = isDiscoveryActive() || showAllCatalogue ? matches.length : atlasBriefs.priorityIds.length;
    const noun = isDiscoveryActive() ? 'hồ sơ khớp' : (showAllCatalogue ? 'hồ sơ trong danh mục' : 'thị trường ưu tiên');
    const customerSuffix = customerMapData.length ? ` · ${customerMapData.length} khách hàng` : '';
    mapStatus.textContent = `${count} ${noun}` + customerSuffix + (mapReady ? '' : ' · Đang tải bản đồ...');
}
function refreshDiscovery() {
    renderNotesList();
    updateMapColors();
    updateMapStatus();
}
facetType.addEventListener('change', () => { updateFacetValueOptions(); refreshDiscovery(); });
facetValue.addEventListener('change', refreshDiscovery);
onlyNoted.addEventListener('change', refreshDiscovery);
clearFiltersBtn.addEventListener('click', () => {
    countrySearch.value = '';
    facetType.value = '';
    facetValue.value = '';
    onlyNoted.checked = false;
    updateFacetValueOptions();
    searchResults.replaceChildren();
    searchResults.classList.add('hidden');
    refreshDiscovery();
});
updateFacetValueOptions();

// Map setup
let width = mapContainer.clientWidth || window.innerWidth;
let height = mapContainer.clientHeight || window.innerHeight;

const mapDependenciesReady = Boolean(window.d3 && window.topojson);
// The catalogue still works when external D3/TopoJSON libraries cannot be loaded.
const emptyMapSelection = {
    selectAll() { return this; }, attr() { return this; }, raise() { return this; }
};
const svg = mapDependenciesReady ? d3.select('#map-container')
    .append('svg').attr('width', '100%').attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`) : emptyMapSelection;
const g = mapDependenciesReady ? svg.append('g') : emptyMapSelection;
const gCountries = mapDependenciesReady ? g.append('g').attr('class', 'map-countries') : emptyMapSelection;
const gLabels = mapDependenciesReady ? g.append('g').attr('class', 'map-labels') : emptyMapSelection;
const gCustomers = mapDependenciesReady ? g.append('g').attr('class', 'map-customers') : emptyMapSelection;
const zoom = mapDependenciesReady ? d3.zoom().scaleExtent([1,8]).on('zoom', event => {
    g.attr('transform', event.transform);
    const k = event.transform.k;
    gLabels.selectAll('.country-label')
        .style('display', d => (d.properties.baseArea || 0) * k * k > 1500 ? 'block' : 'none')
        .style('font-size', `${Math.max(3,10/k)}px`);
}) : null;
if (mapDependenciesReady) svg.call(zoom);
const projection = mapDependenciesReady ? d3.geoMercator() : null;
const path = mapDependenciesReady ? d3.geoPath().projection(projection) : null;

// Load Map Data
async function initMap() {
    if (!mapDependenciesReady) {
        mapError = new Error('D3.js / TopoJSON không tải được.');
        mapFallback.classList.remove('hidden');
        retryMapBtn.classList.add('hidden');
        renderNotesList();
        updateMapStatus();
        return;
    }
    if (mapLoadInProgress) return;
    mapLoadInProgress = true;
    mapError = null;
    retryMapBtn.classList.add('hidden');
    mapFallback.classList.add('hidden');
    updateMapStatus();
    try {
        // Abort a stalled CDN request; catalogue search remains available offline.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        let response;
        try {
            response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json', { signal: controller.signal });
            if (!response.ok) throw new Error('HTTP ' + response.status);
        } finally { clearTimeout(timeout); }
        const world = await response.json();
        
        // Use global chinaGeoJSON loaded from china.js
        // (No need to fetch locally to avoid CORS)
        
        // Convert world to GeoJSON
        const countries = topojson.feature(world, world.objects.countries).features;
        
        // Filter out Antarctica and China (we'll replace China with its provinces)
        let filteredCountries = countries.filter(d => d.properties.name !== 'Antarctica' && d.properties.name !== 'China');

        const provinceTranslations = {
            "新疆维吾尔自治区": "Tân Cương",
            "西藏自治区": "Tây Tạng",
            "内蒙古自治区": "Nội Mông",
            "青海省": "Thanh Hải",
            "四川省": "Tứ Xuyên",
            "黑龙江省": "Hắc Long Giang",
            "甘肃省": "Cam Túc",
            "云南省": "Vân Nam",
            "广西壮族自治区": "Quảng Tây",
            "湖南省": "Hồ Nam",
            "陕西省": "Thiểm Tây",
            "广东省": "Quảng Đông",
            "吉林省": "Cát Lâm",
            "河北省": "Hà Bắc",
            "湖北省": "Hồ Bắc",
            "贵州省": "Quý Châu",
            "山东省": "Sơn Đông",
            "江西省": "Giang Tây",
            "河南省": "Hà Nam",
            "辽宁省": "Liêu Ninh",
            "山西省": "Sơn Tây",
            "安徽省": "An Huy",
            "福建省": "Phúc Kiến",
            "浙江省": "Chiết Giang",
            "江苏省": "Giang Tô",
            "重庆市": "Trùng Khánh",
            "宁夏回族自治区": "Ninh Hạ",
            "海南省": "Hải Nam",
            "台湾省": "Đài Loan",
            "北京市": "Bắc Kinh",
            "天津市": "Thiên Tân",
            "上海市": "Thượng Hải",
            "香港特别行政区": "Hồng Kông",
            "澳门特别行政区": "Ma Cao"
        };
        
        // Prepare China provinces
        const chinaProvinces = chinaGeoJSON.features.map(feature => {
            feature.id = 'cn-' + feature.properties.id;
            const originalName = feature.properties.name;
            const viName = provinceTranslations[originalName];
            if (viName) {
                feature.properties.name = `${viName} - ${originalName} (CN)`;
            } else {
                feature.properties.name = `${originalName} (CN)`;
            }
            return feature;
        });
        
        // Combine them
        filteredCountries = filteredCountries.concat(chinaProvinces);

        // Add International Island (Dummy GeoJSON Polygon in the Pacific Ocean)
        const islandGeoJSON = d3.geoCircle().center([-140, -10]).radius(3)();
        islandGeoJSON.id = "intl-island";
        islandGeoJSON.properties = { name: "International Styles" };
        filteredCountries.push(islandGeoJSON);

        const countryTranslations = {
            "United States of America": "Hoa Kỳ (USA)",
            "Germany": "Đức (Germany)",
            "Italy": "Ý (Italy)",
            "Poland": "Ba Lan (Poland)",
            "Sweden": "Thụy Điển (Sweden)",
            "Denmark": "Đan Mạch (Denmark)",
            "Finland": "Phần Lan (Finland)",
            "Austria": "Áo (Austria)",
            "Vietnam": "Việt Nam",
            "Thailand": "Thái Lan (Thailand)",
            "India": "Ấn Độ (India)",
            "Japan": "Nhật Bản (Japan)",
            "South Korea": "Hàn Quốc (South Korea)",
            "South Africa": "Nam Phi (South Africa)",
            "United Arab Emirates": "UAE (Các Tiểu vương quốc Ả Rập Thống nhất)",
            "Philippines": "Philippines",
            "Singapore": "Singapore"
        };

        filteredCountries.forEach(f => {
            if (countryTranslations[f.properties.name]) {
                f.properties.name = countryTranslations[f.properties.name];
            }
        });

        // Step 3: one semantic colour for saved notes; avoid O(N²) adjacency search
        // during every map load. Filter matches use a second, explicit colour.
        mapFeatures = filteredCountries;

        // Automatically scale and center map to fit the container
        const featureCollection = { type: "FeatureCollection", features: filteredCountries };
        projection.fitExtent([[20, 20], [width - 20, height - 20]], featureCollection);

        // Pre-calculate path areas for performance (after projection is set)
        filteredCountries.forEach(f => {
            f.properties.baseArea = path.area(f);
        });

        // Extract country names for select dropdown
        countriesData = filteredCountries.map(d => ({
            id: d.id,
            name: d.properties.name
        })).sort((a, b) => a.name.localeCompare(b.name));

        populateSelect();

        // Draw Map
        gCountries.selectAll('.country')
            .data(filteredCountries)
            .enter().append('path')
            .attr('class', 'country')
            .attr('d', path)
            .attr('id', d => `country-${d.id}`)
            .on('mouseover', handleMouseOver)
            .on('mousemove', handleMouseMove)
            .on('mouseout', handleMouseOut)
            .on('click', handleCountryClick);

        // Draw Labels
        gLabels.selectAll('.country-label')
            .data(filteredCountries)
            .enter().append('text')
            .attr('class', 'country-label')
            .attr('transform', function(d) {
                let centroid;
                const name = d.properties.name;
                
                // Căn chỉnh thủ công cho một số quốc gia có nhiều lãnh thổ rời rạc
                if (name === "United States of America" || name === "United States") {
                    centroid = projection([-98.5, 39.8]); // Trung tâm lục địa Mỹ
                } else if (name === "France") {
                    centroid = projection([2.2, 46.2]); // Trung tâm nước Pháp (Châu Âu)
                } else {
                    centroid = path.centroid(d);
                }
                
                if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
                    return `translate(${centroid[0]}, ${centroid[1]})`;
                }
                return 'translate(-9999, -9999)';
            })
            .text(d => {
                let name = d.properties.name;
                if (name.includes(' - ')) {
                    name = name.split(' - ')[0]; 
                }
                return name;
            })
            .style('display', function(d) {
                const visibleAreaThreshold = 1500;
                const area = d.properties.baseArea || 0;
                return area > visibleAreaThreshold ? 'block' : 'none';
            });

        mapReady = true;
        mapError = null;
        mapFallback.classList.add('hidden');
        renderCustomerPoints();
        fitMapToViewport();
        updateMapColors();
        renderNotesList();
        updateMapStatus();
        
        // Enable select and button
        countrySelect.disabled = false;
        
    } catch (error) {
        console.error('Error loading map data:', error);
        mapReady = false;
        mapError = error;
        mapFallback.classList.remove('hidden');
        retryMapBtn.classList.remove('hidden');
        countrySelect.innerHTML = '<option value="" disabled>Lỗi tải dữ liệu bản đồ</option>';
        renderNotesList();
        updateMapStatus();
    } finally {
        mapLoadInProgress = false;
    }
}

// Populate Select Dropdown
function populateSelect() {
    countrySelect.innerHTML = '<option value="" disabled selected>-- Chọn quốc gia --</option>';
    countriesData.forEach(country => {
        const option = document.createElement('option');
        option.value = country.id;
        option.textContent = country.name;
        countrySelect.appendChild(option);
    });
}


const customerPlotData = customerMapData.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

function positionTooltip(x, y) {
    const rect = mapContainer.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    let tooltipX = x - (tooltipWidth / 2);
    let tooltipY = y - tooltipHeight - 15;
    if (tooltipX < 10) tooltipX = 10;
    else if (tooltipX + tooltipWidth > rect.width - 10) tooltipX = rect.width - tooltipWidth - 10;
    if (tooltipY < 10) tooltipY = y + 25;
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
}

function showPlainTooltip(title, body, x, y) {
    tooltipTitle.textContent = title;
    tooltipContent.textContent = body;
    tooltipContent.style.display = 'block';
    tooltipContent.classList.remove('clamp');
    const existingRm = tooltip.querySelector('.read-more-text');
    if (existingRm) existingRm.remove();
    tooltip.classList.remove('hidden');
    positionTooltip(x, y);
}

function getCustomerScreenPoint(customer) {
    if (!projection) return [-9999, -9999];
    const point = projection([customer.longitude, customer.latitude]);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return [-9999, -9999];
    return [point[0] + (customer.offsetX || 0), point[1] + (customer.offsetY || 0)];
}

function customerTooltipText(customer) {
    const parts = [customer.address];
    if (customer.sizeLabel) parts.push(`Quy mô: ${customer.sizeLabel}`);
    parts.push('Vị trí chấm: xấp xỉ theo thành phố');
    return parts.filter(Boolean).join(' · ');
}

function showCustomerTooltip(customer, event) {
    const rect = mapContainer.getBoundingClientRect();
    const target = event?.currentTarget;
    const bounds = target?.getBoundingClientRect?.();
    const x = Number.isFinite(event?.clientX) ? event.clientX - rect.left
        : bounds ? bounds.left + bounds.width / 2 - rect.left : rect.width / 2;
    const y = Number.isFinite(event?.clientY) ? event.clientY - rect.top
        : bounds ? bounds.top + bounds.height / 2 - rect.top : rect.height / 2;
    showPlainTooltip(customer.name, customerTooltipText(customer), x, y);
    // The dot is a city-level overview; use the full street address for precise navigation.
    const link = document.createElement('a');
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Mở địa chỉ trên Google Maps';
    link.className = 'customer-map-link';
    tooltipContent.appendChild(document.createTextNode(' '));
    tooltipContent.appendChild(link);
    positionTooltip(x, y);
}

function renderCustomerPoints() {
    if (!mapDependenciesReady || !customerPlotData.length) return;
    const points = gCustomers.selectAll('.customer-dot').data(customerPlotData, d => d.id);
    const entered = points.enter().append('circle')
        .attr('class', 'customer-dot')
        .attr('r', d => d.dotRadius)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', d => `${d.name} - ${d.sizeLabel}`)
        .on('mouseover', function(event, d) {
            if (pinnedCustomerId && pinnedCustomerId !== d.id) return;
            showCustomerTooltip(d, event);
            d3.select(this).raise();
        })
        .on('mousemove', function(event, d) {
            if (pinnedCustomerId && pinnedCustomerId !== d.id) return;
            const rect = mapContainer.getBoundingClientRect();
            positionTooltip(event.clientX - rect.left, event.clientY - rect.top);
        })
        .on('mouseout', function(event, d) {
            if (pinnedCustomerId === d.id) return;
            tooltip.classList.add('hidden');
        })
        .on('click', function(event, d) {
            event.stopPropagation();
            pinnedCustomerId = d.id;
            showCustomerTooltip(d, event);
            d3.select(this).raise();
        })
        .on('keydown', function(event, d) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                pinnedCustomerId = d.id;
                showCustomerTooltip(d, event);
            }
        });
    entered.append('title').text(d => `${d.name} · ${d.sizeLabel}`);
    points.merge(entered)
        .attr('r', d => d.dotRadius)
        .attr('cx', d => getCustomerScreenPoint(d)[0])
        .attr('cy', d => getCustomerScreenPoint(d)[1]);
    points.exit().remove();
}

document.addEventListener('click', event => {
    if (event.target.closest('.customer-dot')) return;
    pinnedCustomerId = null;
    if (!event.target.closest('#tooltip')) tooltip.classList.add('hidden');
});

// Map Interactions
function handleMouseOver(event, d) {
    pinnedCustomerId = null;
    const countryId = d.id;
    const countryName = d.properties.name;
    const note = savedNotes[countryId];

    tooltipTitle.textContent = countryName;
    
    // Remove old read more
    const existingRm = tooltip.querySelector('.read-more-text');
    if (existingRm) existingRm.remove();
    
    if (note) {
        let plainText = note.text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[Image $1]');
        plainText = plainText.replace(/(\*\*|__)(.*?)\1/g, '$2');
        plainText = plainText.replace(/(\*|_)(.*?)\1/g, '$2');
        plainText = plainText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
        plainText = plainText.replace(/#/g, '');
        tooltipContent.textContent = plainText;
        tooltipContent.style.display = '-webkit-box';
        tooltipContent.classList.add('clamp');
    } else {
        tooltipContent.style.display = 'none';
    }

    tooltip.classList.remove('hidden');
    
    // Measure if clamped after showing
    if (note && tooltipContent.scrollHeight > tooltipContent.clientHeight) {
        const rm = document.createElement('span');
        rm.className = 'read-more-text';
        rm.textContent = '... readmore at left panel';
        tooltip.appendChild(rm);
    }
    
    // Highlight effect handled by CSS hover, but we can bring element to front
    d3.select(this).raise();
}

function handleMouseMove(event) {
    const rect = mapContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    positionTooltip(x, y);
}

function handleMouseOut(event, d) {
    if (!pinnedCustomerId) tooltip.classList.add('hidden');
    // Ensure selected items stay on top
    gCountries.selectAll('.selected').raise();
}

function handleCountryClick(event, d) {
    const id = d.id;
    const name = d.properties.name;
    
    viewedCountry = { id, name };
    
    currentSelection = [{ id, name }];
    renderChips();
    if (!mobilePanelQuery.matches) editorTools.open = true;
    
    if (savedNotes[id]) {
        const noteText = savedNotes[id].text;
        noteInput.value = noteText;
        if (mobilePanelQuery.matches || noteText.length > 150 || noteText.split('\n').length > 4) {
            openModal(id, name, noteText);
        }
        setEditMode(false);
    } else {
        noteInput.value = '';
        setEditMode(true);
        if (mobilePanelQuery.matches) openModal(id, name, atlasKnowledgeV2.records[id]?.text || '');
    }
}

// Render selected chips
function renderChips() {
    selectedChips.innerHTML = '';
    currentSelection.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        const label = document.createElement('span');
        label.textContent = item.name;
        const remove = document.createElement('button');
        remove.className = 'chip-remove';
        remove.type = 'button';
        remove.title = 'Bỏ lựa chọn';
        remove.setAttribute('aria-label', `Bỏ lựa chọn ${item.name}`);
        remove.setAttribute('data-id', item.id);
        remove.textContent = '×';
        chip.append(label, remove);

        chip.querySelector('.chip-remove').addEventListener('click', (e) => {
            const removeId = e.target.getAttribute('data-id');
            currentSelection = currentSelection.filter(c => c.id !== removeId);
            renderChips();
            if (currentSelection.length === 0) {
                noteInput.value = '';
                setEditMode(true);
            } else {
                checkInputs();
            }
            updateMapColors(); // To remove highlighting from map if needed
        });
        
        selectedChips.appendChild(chip);
    });
    
    // Reset select
    countrySelect.value = "";
    updateMapColors(); // Show highlighting for current selection
}

// Form logic
function setEditMode(isEditable) {
    if (isEditable) {
        noteInput.readOnly = false;
        editBtn.style.display = 'none';
        noteInput.style.opacity = '1';
    } else {
        noteInput.readOnly = true;
        editBtn.style.display = 'block';
        noteInput.style.opacity = '0.7';
    }
    checkInputs();
}

function checkInputs() {
    if (currentSelection.length > 0 && noteInput.value.trim() !== '' && !noteInput.readOnly) {
        saveBtn.disabled = false;
    } else {
        saveBtn.disabled = true;
    }
}

countrySelect.addEventListener('change', () => {
    const selectedId = countrySelect.value;
    if (selectedId) {
        const name = countrySelect.options[countrySelect.selectedIndex].text;
        if (!currentSelection.find(c => c.id === selectedId)) {
            currentSelection.push({ id: selectedId, name });
            renderChips();
        }
    }
    
    if (currentSelection.length === 1 && savedNotes[selectedId]) {
        noteInput.value = savedNotes[selectedId].text;
    } else {
        noteInput.value = '';
    }
    setEditMode(currentSelection.length > 1 || !savedNotes[selectedId]);
});

noteInput.addEventListener('input', checkInputs);

editBtn.addEventListener('click', () => {
    if (viewedCountry && !currentSelection.find(c => c.id === viewedCountry.id)) {
        currentSelection.push(viewedCountry);
        renderChips();
    }
    setEditMode(true);
    noteInput.focus();
});

saveBtn.addEventListener('click', () => {
    const noteText = noteInput.value.trim();
    if (currentSelection.length === 0 || !noteText) return;

    // Applying one note to many countries is destructive if they have distinct notes.
    if (currentSelection.length > 1 && !confirm(
        `Áp dụng cùng một nội dung cho ${currentSelection.length} quốc gia/vùng? ` +
        'Ghi chú có sẵn của những nơi này sẽ bị thay thế.')) return;

    const nextNotes = { ...savedNotes };
    currentSelection.forEach(country => {
        nextNotes[country.id] = {
            ...(savedNotes[country.id] || {}),
            name: country.name,
            text: noteText,
            timestamp: Date.now()
        };
    });
    if (!persistNotes(nextNotes)) return;

    noteInput.value = '';
    currentSelection = [];
    renderChips();
    setEditMode(true);
    updateMapColors();
    renderNotesList();
});

// Semantic map colouring: noted (green), matching active filters (blue), dimmed (not matched).
function updateMapColors() {
    const active = isDiscoveryActive();
    const matched = new Set(active ? getDiscoveryMatches().map(entry => entry.id) : []);
    const selected = new Set(currentSelection.map(entry => entry.id));
    gCountries.selectAll('.country').attr('class', d => {
        let cls = 'country';
        if (savedNotes[d.id]) cls += ' noted';
        if (active) cls += matched.has(d.id) ? ' filtered-match' : ' filtered-dim';
        if (selected.has(d.id)) cls += ' selecting';
        return cls;
    });
    gCountries.selectAll('.selecting').raise();
}

// Step 3: unified list of catalogue records and browser-only notes.
function renderNotesList() {
    notesList.replaceChildren();
    const allEntries = atlasFilters.buildEntries(atlasKnowledgeV2.records, savedNotes);
    const entries = getDiscoveryMatches().filter(entry =>
        showAllCatalogue || isDiscoveryActive() || atlasBriefs.priorityIds.includes(entry.id))
        .sort((a,b) => {
            const priorityA = atlasBriefs.priorityIds.indexOf(a.id);
            const priorityB = atlasBriefs.priorityIds.indexOf(b.id);
            if (!showAllCatalogue && !isDiscoveryActive()) return priorityA - priorityB;
            return Number(b.hasNote) - Number(a.hasNote) || b.timestamp - a.timestamp || a.name.localeCompare(b.name,'vi');
        });
    resultsCount.textContent = `${entries.length}/${allEntries.length} hồ sơ`;
    if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'note-empty';
        empty.textContent = 'Không tìm thấy hồ sơ. Hãy đổi bộ lọc hoặc bấm Tất cả.';
        notesList.appendChild(empty);
        refreshKnowledgeSummary();
        return;
    }
    for (const entry of entries) {
        const brief = atlasBriefs.records[entry.id] || null;
        const card = document.createElement('article');
        card.className = 'note-item' + (brief ? ' verified-card' : ' archive-card');
        card.setAttribute('data-id', entry.id);
        const head = document.createElement('div');
        head.className = 'note-header';
        const title = document.createElement('strong');
        title.className = 'note-country';
        title.textContent = entry.name;
        const flag = document.createElement('span');
        flag.className = 'source-flag';
        flag.textContent = brief ? 'Có nguồn' : 'Chưa rà soát';
        head.append(title, flag);
        const summary = document.createElement('p');
        summary.className = 'note-text';
        summary.textContent = brief ? brief.summary : 'Dữ liệu gốc lưu trong kho; chưa kiểm chứng toàn bộ nội dung.';
        const controls = document.createElement('div');
        controls.className = 'brief-card-actions';
        const detail = document.createElement('button');
        detail.type = 'button';
        detail.className = 'note-detail';
        detail.textContent = brief ? 'Xem tóm tắt & nguồn' : 'Xem dữ liệu gốc';
        detail.addEventListener('click', () => openModal(entry.id, entry.name, entry.text));
        controls.appendChild(detail);
        if (entry.hasNote && !brief) {
            const personal = document.createElement('span');
            personal.className = 'personal-tag';
            personal.textContent = 'Có ghi chú trên thiết bị';
            controls.appendChild(personal);
        }
        card.append(head, summary, controls);
        card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            openModal(entry.id, entry.name, entry.text);
        });
        notesList.appendChild(card);
    }
    refreshKnowledgeSummary();
}
function chooseEntry(entry) {
    viewedCountry = {id:entry.id,name:entry.name};
    currentSelection = [{id:entry.id,name:entry.name}];
    renderChips();
    editorTools.open = true;
    noteInput.value = entry.hasNote ? entry.text : '';
    setEditMode(!entry.hasNote);
    if (mapReady) zoomToCountry(entry.id);
    if (mobilePanelQuery.matches) setPanelOpen(false);
    if (!mapReady && entry.text) openModal(entry.id,entry.name,entry.text);
}

// Accent-insensitive search across names, notes, materials, products and standards.
let currentFocus = -1;
countrySearch.addEventListener('input', () => {
    currentFocus = -1;
    searchResults.replaceChildren();
    const query = countrySearch.value.trim();
    refreshDiscovery();
    if (!query) { searchResults.classList.add('hidden'); return; }
    const matches = getDiscoveryMatches().slice(0, 12);
    for (const entry of matches) {
        const li = document.createElement('li');
        li.textContent = entry.name;
        li.setAttribute('role','option');
        li.addEventListener('click', () => {
            chooseEntry(entry);
            countrySearch.value = '';
            searchResults.classList.add('hidden');
            refreshDiscovery();
        });
        searchResults.appendChild(li);
    }
    if (!matches.length) {
        const li = document.createElement('li');
        li.textContent = 'Không tìm thấy kết quả';
        li.className = 'empty-result';
        searchResults.appendChild(li);
    }
    searchResults.classList.remove('hidden');
});
countrySearch.addEventListener('keydown', e => {
    const items = Array.from(searchResults.querySelectorAll('li:not(.empty-result)'));
    if (e.key === 'Escape') { searchResults.classList.add('hidden'); e.stopPropagation(); return; }
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        currentFocus += e.key === 'ArrowDown' ? 1 : -1;
        addActive(items);
        e.preventDefault();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[currentFocus > -1 ? currentFocus : 0] || items[0]).click();
    }
});

function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (items.length - 1);
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
}

function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('active');
    }
}

document.addEventListener('click', (e) => {
    if (!countrySearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

function fitMapToViewport() {
    const nextWidth = Math.max(300, mapContainer.clientWidth || window.innerWidth);
    const nextHeight = Math.max(260, mapContainer.clientHeight || window.innerHeight);
    if (width === nextWidth && height === nextHeight && !mapReady) return;
    width = nextWidth;
    height = nextHeight;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    if (!mapReady || !mapFeatures.length) return;
    projection.fitExtent([[12, 12], [width - 12, height - 12]],
        {type:'FeatureCollection',features:mapFeatures});
    for (const item of mapFeatures) item.properties.baseArea = path.area(item);
    gCountries.selectAll('.country').attr('d',path);
    gLabels.selectAll('.country-label').attr('transform', d => {
        let centroid;
        if (d.properties.name.includes('Hoa Kỳ') || d.properties.name === 'United States') {
            centroid = projection([-98.5,39.8]);
        } else if (d.properties.name === 'France') centroid = projection([2.2,46.2]);
        else centroid = path.centroid(d);
        return centroid && centroid.every(Number.isFinite)
            ? `translate(${centroid[0]},${centroid[1]})` : 'translate(-9999,-9999)';
    });
    renderCustomerPoints();
    // Reset transform after reprojecting to prevent drifting/incorrect bounding boxes.
    svg.call(zoom.transform, d3.zoomIdentity);
}
function zoomToCountry(id) {
    if (!mapReady) return;
    const pathEl = d3.select(`#country-${CSS.escape(String(id))}`);
    if (pathEl.empty()) return;
    const bounds = path.bounds(pathEl.datum());
    const dx = bounds[1][0]-bounds[0][0];
    const dy = bounds[1][1]-bounds[0][1];
    if (dx <= 0 || dy <= 0 || !Number.isFinite(dx + dy)) return;
    const x = (bounds[0][0]+bounds[1][0])/2;
    const y = (bounds[0][1]+bounds[1][1])/2;
    const scale = Math.max(1,Math.min(8,.83/Math.max(dx/width,dy/height)));
    const transform = d3.zoomIdentity.translate(width/2-scale*x,height/2-scale*y).scale(scale);
    svg.transition().duration(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550)
        .call(zoom.transform, transform);
}
function selectCountryFromSearch(id, name) {
    const matching = atlasFilters.buildEntries(atlasKnowledgeV2.records,savedNotes).find(entry=>entry.id===id);
    if (matching) chooseEntry(matching);
    else chooseEntry({id,name,text:'',hasNote:false});
}
resetMapBtn.addEventListener('click', () => {
    if (!mapReady) return;
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
    currentSelection = [];
    renderChips();
});
retryMapBtn.addEventListener('click', initMap);
// Delay the first fit until data exists; ResizeObserver responds to sidebar and orientation changes.
initMap();
if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
        if (mapReady) fitMapToViewport();
    });
    observer.observe(mapContainer);
} else window.addEventListener('resize',fitMapToViewport);
window.addEventListener('orientationchange', () => { if (mapReady) fitMapToViewport(); });
updateMapStatus();

// Step 4: narrow bridge for sync module; all writes still pass the v1.1 backup and validation path.
window.AtlasSyncBridge = Object.freeze({
    getNotes: () => savedNotes,
    defaults: defaultNotes,
    isReadOnly: () => notesStorageReadOnly,
    hasUnsavedDraft: () => currentSelection.length === 1 &&
        document.activeElement === noteInput &&
        noteInput.value.trim() !== (savedNotes[currentSelection[0].id]?.text || '').trim(),
    replace: nextNotes => {
        if (!persistNotes(normalizeImportedNotes(nextNotes))) return false;
        // Do not overwrite a partially typed note while refreshing a cloud snapshot.
        if (currentSelection.length === 1 && !noteInput.matches(':focus')) {
            noteInput.value = savedNotes[currentSelection[0].id]?.text || '';
        }
        refreshDiscovery();
        updateMapColors();
        renderNotesList();
        return true;
    }
});