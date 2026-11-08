/* Step 3: deterministic, read-only search over the v1.2 catalogue and browser notes.
 * The generated taxonomy represents unverified term mentions, not validated facts. */
(function (root) {
    'use strict';
    const FACETS = Object.freeze({
        materials: 'Vật liệu',
        products: 'Sản phẩm',
        design_styles: 'Phong cách',
        standards_and_certifications: 'Tiêu chuẩn'
    });
    function normalize(value) {
        return String(value == null ? '' : value)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
    }
    function buildEntries(records, notes) {
        const ids = new Set([...Object.keys(records || {}), ...Object.keys(notes || {})]);
        return Array.from(ids, id => {
            const record = records[id] || null;
            const note = notes[id] || null;
            const taxonomy = record && record.taxonomy ? record.taxonomy : {};
            const text = note ? note.text : (record ? record.text : '');
            const name = note ? note.name : (record ? record.name : id);
            const mentions = Object.values(taxonomy).flatMap(value => Array.isArray(value) ? value : []);
            return { id, name, text, taxonomy, hasNote: !!note,
                timestamp: note && Number.isFinite(note.timestamp) ? note.timestamp : 0,
                searchable: normalize([id, name, text, ...mentions].join(' ')) };
        });
    }
    function filterEntries(entries, options = {}) {
        const query = normalize(options.query || '');
        const facet = FACETS[options.facet] ? options.facet : '';
        const value = normalize(options.value || '');
        const onlyNoted = options.onlyNoted === true;
        return entries.filter(entry => {
            if (onlyNoted && !entry.hasNote) return false;
            if (query && !entry.searchable.includes(query)) return false;
            if (facet) {
                const mentions = entry.taxonomy[facet] || [];
                if (!mentions.length) return false;
                if (value && !mentions.some(term => normalize(term) === value)) return false;
            }
            return true;
        });
    }
    function facetValues(entries, facet) {
        if (!FACETS[facet]) return [];
        const counts = new Map();
        for (const entry of entries) {
            for (const term of entry.taxonomy[facet] || []) {
                counts.set(term, (counts.get(term) || 0) + 1);
            }
        }
        return Array.from(counts, ([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'vi'));
    }
    root.ATLAS_FILTERS_V3 = Object.freeze({ FACETS, normalize, buildEntries, filterEntries, facetValues });
})(typeof window === 'undefined' ? globalThis : window);