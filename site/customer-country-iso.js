/* Furniverse v2.2: country/territory ISO-3166-1 association.
 * Assign only from an explicit country label in the published address.
 * "market" is a sales territory, NOT evidence of the physical address location.
 * Ambiguous addresses deliberately remain unmatched. */
(function (root) {
    'use strict';
    const rules = [
        ['US','840', /(?:\bUSA\b|\bUnited States\b|(?:,\s*|\b)Mỹ(?:\s*[.,ꞏ]|$))/i],
        ['VN','704', /(?:\bVietnam\b|Việt Nam)/i],
        ['GB','826', /(?:\bUnited Kingdom\b|\bNorthern Ireland\b|(?:,\s*|\b)UK\b)/i],
        ['CA','124', /\bCanada\b/i],
        ['AU','036', /\bAustralia\b/i],
        ['DK','208', /(?:\bDenmark\b|,\s*DK\s*$)/i],
        ['DE','276', /\bGermany\b/i],
        ['FI','246', /\bFinland\b/i],
        ['CH','756', /\bSwitzerland\b/i],
        ['CN','156', /(?:\bChina\b|Trung Quốc)/i],
        ['HK','344', /\bHong Kong\b/i],
        ['SG','702', /(?:,\s*Singapore\s*(?:\d{5,6}\b|\(Reg\b|$)|Headquarters\s*\(Singapore\))/i],
        ['NL','528', /\bNetherlands\b/i],
        ['NZ','554', /\bNew Zealand\b/i],
        ['TH','764', /\bThailand\b/i],
        ['ES','724', /\bSpain\b/i],
        ['SE','752', /\bSweden\b/i],
        ['JP','392', /\bJapan\b/i],
        ['MY','458', /\bMalaysia\b/i],
        ['IT','380', /\bItaly\b/i],
        ['PL','616', /\bPoland\b/i],
        ['FR','250', /\bFrance\b/i],
        ['AT','040', /\bAustria\b/i],
        ['BE','056', /\bBelgium\b/i],
        ['IN','356', /\bIndia\b/i],
        ['ID','360', /\bIndonesia\b/i],
        ['TW','158', /\bTaiwan\b/i],
        ['KR','410', /\bSouth Korea\b|\bRepublic of Korea\b/i],
        ['PT','620', /\bPortugal\b/i],
        ['NO','578', /\bNorway\b/i],
        ['BR','076', /\bBrazil\b/i]
    ];
    const numeric = Object.freeze(Object.fromEntries(rules.map(([iso2,id]) => [iso2,id])));
    const byNumeric = Object.freeze(Object.fromEntries(rules.map(([iso2,id]) => [id,iso2])));
    function forAddress(address) {
        const value = String(address || '').trim();
        if (!value) return null;
        const candidates = rules.filter(([, , pattern]) => pattern.test(value));
        return candidates.length === 1 ? candidates[0][0] : null;
    }
    function forCustomer(row) {
        return row && typeof row.address === 'string' ? forAddress(row.address) : null;
    }
    function forAtlasId(id) {
        const key = String(id || '');
        if (key === 'cn-81') return 'HK';
        if (key === 'cn-82') return 'MO';
        if (key === 'cn-71') return 'TW';
        if (/^cn-\d+$/.test(key)) return 'CN';
        const normalized = /^\d{1,3}$/.test(key) ? key.padStart(3, '0') : key;
        const catalogue = root.ATLAS_KNOWLEDGE_V2 && root.ATLAS_KNOWLEDGE_V2.records;
        const code = catalogue && catalogue[normalized] && catalogue[normalized].geography &&
            catalogue[normalized].geography.isoAlpha2;
        return typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code :
            (byNumeric[normalized] || null);
    }
    function atlasIdFor(iso2) {
        if (iso2 === 'MO') return '446';
        return numeric[iso2] || null;
    }
    root.FURNIVERSE_COUNTRY_ISO = Object.freeze({
        forAddress, forCustomer, forAtlasId, atlasIdFor,
        isoCodes: Object.freeze([...numeric ? Object.keys(numeric) : []])
    });
})(window);
