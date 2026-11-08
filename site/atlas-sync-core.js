/* World Furniture Atlas v1.4: deterministic 3-way merge; no network or browser dependencies. */
(function (root) {
    'use strict';

    const SCHEMA_VERSION = 1;
    const MAX_NOTES = 500;
    const MAX_TEXT_LENGTH = 100000;

    function validateNotes(source) {
        if (!source || typeof source !== 'object' || Array.isArray(source))
            throw new Error('Dữ liệu ghi chú không phải đối tượng JSON hợp lệ.');
        const notes = Object.create(null);
        const entries = Object.entries(source);
        if (entries.length > MAX_NOTES) throw new Error('Quá 500 ghi chú.');
        for (const [id, value] of entries) {
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
                ['__proto__', 'prototype', 'constructor'].includes(id) ||
                !value || typeof value !== 'object' || Array.isArray(value) ||
                typeof value.name !== 'string' || !value.name.trim() || value.name.length > 400 ||
                typeof value.text !== 'string' || !value.text.trim() || value.text.length > MAX_TEXT_LENGTH ||
                !Number.isFinite(value.timestamp) || value.timestamp < 0) {
                throw new Error(`Ghi chú không hợp lệ tại ID: ${id}`);
            }
            notes[id] = { name: value.name, text: value.text, timestamp: value.timestamp };
        }
        return notes;
    }

    function sameNote(left, right) {
        if (!left && !right) return true;
        if (!left || !right) return false;
        // A read-only display should not count as a user edit just because its timestamp changed.
        return left.name === right.name && left.text === right.text;
    }

    function sameNotes(left, right) {
        const ids = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
        for (const id of ids) if (!sameNote(left && left[id], right && right[id])) return false;
        return true;
    }

    // Deletions are represented as absent records. Changed on both sides => explicit conflict.
    function mergeThreeWay(baseline, localNotes, remoteNotes) {
        const base = validateNotes(baseline);
        const local = validateNotes(localNotes);
        const remote = validateNotes(remoteNotes);
        const result = Object.create(null);
        const conflicts = [];
        const ids = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
        for (const id of ids) {
            const b = base[id], l = local[id], r = remote[id];
            let winner;
            if (sameNote(l, r)) winner = l || r;
            else if (sameNote(l, b)) winner = r;
            else if (sameNote(r, b)) winner = l;
            else {
                conflicts.push({ id, base: b || null, local: l || null, remote: r || null });
                continue;
            }
            if (winner) result[id] = { ...winner };
        }
        return { notes: result, conflicts };
    }

    function makeDocument(notes, revision, metadata = {}) {
        if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Revision phải >= 1');
        return {
            schemaVersion: SCHEMA_VERSION,
            type: 'atlas-notes',
            revision,
            updatedAt: new Date().toISOString(),
            notes: validateNotes(notes),
            ...metadata
        };
    }
    function validateDocument(data) {
        if (!data || typeof data !== 'object' || data.schemaVersion !== SCHEMA_VERSION ||
            data.type !== 'atlas-notes' || !Number.isSafeInteger(data.revision) ||
            data.revision < 1 || typeof data.updatedAt !== 'string') {
            throw new Error('Phiên bản dữ liệu trên Drive không tương thích.');
        }
        return { ...data, notes: validateNotes(data.notes) };
    }
    root.ATLAS_SYNC_CORE = Object.freeze({
        SCHEMA_VERSION, validateNotes, sameNote, sameNotes, mergeThreeWay, makeDocument, validateDocument
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = root.ATLAS_SYNC_CORE;
})(typeof window === 'undefined' ? globalThis : window);