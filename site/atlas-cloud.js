/* World Furniture Atlas v1.4 - personal Google Drive appDataFolder sync.
 * OAuth tokens live in memory only. Never treat client-side OAuth as a team access-control backend.
 * Remote updates are guarded by preflight re-read, with immutable backups before every write.
 * Simultaneous writes are not atomic: a later merge/restore may be required. */
(function (root) {
    'use strict';
    const core = root.ATLAS_SYNC_CORE;
    const bridge = root.AtlasSyncBridge;
    if (!core || !bridge) { console.error('Atlas Cloud requires atlas-sync-core.js and app.js'); return; }

    const MAIN_FILE_NAME = 'atlas-notes-v1.json';
    const BACKUP_PREFIX = 'atlas-backup-v1-';
    const EXPECTED_EMAIL = 'tien.manhnguyen@yahoo.com'; // Configured for the personal T.MN project.
    const APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
    const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
    const SETTINGS_KEY = 'atlasSyncSettingsV1';
    const BASE_KEY = 'atlasSyncBaselineV1:' + EXPECTED_EMAIL;
    const ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
    const $ = id => document.getElementById(id);
    const els = {
        client: $('cloud-client-id'), connect: $('cloud-connect'), sync: $('cloud-sync'),
        disconnect: $('cloud-disconnect'), status: $('cloud-status'), details: $('cloud-details'),
        auto: $('cloud-auto'), history: $('cloud-history'), refresh: $('cloud-history-refresh'),
        conflict: $('cloud-conflicts'),
    };
    if (Object.values(els).some(v => !v)) { console.error('Cloud UI elements are missing.'); return; }

    let tokenClient = null;
    let token = null;
    let expiresAt = 0;
    let signedInEmail = '';
    let busy = false;
    let applyingRemote = false;
    let pendingConflict = null;
    let staleTab = false;
    let autosyncTimeout = null;

    function safeLocalGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function safeLocalSet(key, value) { try { localStorage.setItem(key,value); return true; } catch { return false; } }
    function uuid() { return root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2); }
    function status(label, detail = '', isError = false) {
        els.status.textContent = label;
        els.status.dataset.state = isError ? 'error' : (token ? 'online' : 'offline');
        els.details.textContent = detail;
    }
    function enabled() { return !!token && Date.now() < expiresAt - 30000; }
    function buttons() {
        els.connect.disabled = busy;
        els.sync.disabled = busy || !enabled();
        els.disconnect.disabled = busy || !token;
        els.refresh.disabled = busy || !enabled();
        els.client.disabled = busy || !!token;
    }
    function saveSettings() {
        safeLocalSet(SETTINGS_KEY, JSON.stringify({clientId:els.client.value.trim(), auto:els.auto.checked}));
    }
    try {
        const settings = JSON.parse(safeLocalGet(SETTINGS_KEY) || '{}');
        if (settings.clientId) els.client.value = settings.clientId;
        els.auto.checked = settings.auto !== false;
    } catch { els.auto.checked = true; }
    status('Chưa kết nối', 'Ghi chú vẫn lưu trên thiết bị cho đến khi bạn kết nối Google Drive.');
    buttons();

    function readBaseline() {
        const raw = safeLocalGet(BASE_KEY);
        if (!raw) return core.validateNotes(bridge.defaults);
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.schemaVersion === 1) return core.validateNotes(parsed.notes);
        } catch(e) { console.warn('Cloud baseline is invalid; using catalogue defaults.', e); }
        return core.validateNotes(bridge.defaults);
    }
    function writeBaseline(notes) {
        const payload = JSON.stringify({schemaVersion:1, savedAt:new Date().toISOString(), notes:core.validateNotes(notes)});
        if (!safeLocalSet(BASE_KEY,payload)) throw new Error('Không thể lưu mốc đồng bộ trên thiết bị. Không ghi đè dữ liệu Drive.');
    }
    function ensureLocalWritable() {
        if (bridge.isReadOnly()) throw new Error('Dữ liệu trình duyệt đang chỉ đọc. Hãy Export và xử lý lỗi trước.');
        if (staleTab) throw new Error('Ghi chú được sửa trong tab khác. Hãy tải lại trang trước khi đồng bộ để tránh ghi đè dữ liệu.');
        if (bridge.hasUnsavedDraft()) throw new Error('Có nội dung đang nhập chưa lưu. Hãy lưu hoặc hủy bản nháp trước khi đồng bộ.');
    }
    function jsonSize(data) {
        return new Blob([JSON.stringify(data)]).size;
    }
    async function request(url, options = {}) {
        if (!enabled()) {
            token = null;
            status('Phiên đăng nhập hết hạn', 'Bấm Kết nối lại để tiếp tục. Ghi chú trên máy vẫn được giữ.');
            buttons();
            throw new Error('Phiên Google hết hạn. Bấm Kết nối lại.');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),30000);
        try {
            const res = await fetch(url, {
                ...options,
                headers: {Authorization:'Bearer ' + token, ...(options.headers || {})},
                signal:controller.signal,
            });
            if (res.status === 401) { token = null; buttons(); throw new Error('Google đã hết phiên đăng nhập. Hãy kết nối lại.'); }
            const raw = await res.text();
            let data;
            try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
            if (!res.ok) {
                const reason = data.error && data.error.message ? data.error.message : 'Lỗi Google Drive';
                throw new Error(`Google Drive (${res.status}): ${String(reason).slice(0,180)}`);
            }
            return data;
        } finally { clearTimeout(timeout); }
    }
    async function listFiles(nameCondition, limit=100) {
        const params = new URLSearchParams({
            spaces:'appDataFolder',
            q:nameCondition + ' and trashed = false',
            pageSize:String(limit),
            fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
            orderBy:'modifiedTime desc'
        });
        const all=[];
        do {
            const page=await request(ENDPOINT+'?'+params.toString());
            all.push(...(page.files || []));
            if (!page.nextPageToken || all.length >= 500) break;
            params.set('pageToken',page.nextPageToken);
        } while (true);
        return all;
    }
    async function download(id) {
        const item=await request(ENDPOINT+'/'+encodeURIComponent(id)+'?alt=media');
        return item;
    }
    async function readRemote() {
        const files=await listFiles("name = '"+MAIN_FILE_NAME+"'");
        if (files.length > 1) throw new Error('Phát hiện nhiều file dữ liệu chính trên Drive. Đã khóa ghi để tránh ghi đè. Liên hệ người quản trị để hợp nhất thủ công.');
        if (!files.length) return null;
        return { file:files[0], doc:core.validateDocument(await download(files[0].id)) };
    }
    function verifySnapshot(snapshot) {
        if (jsonSize(snapshot) > 5 * 1024 * 1024) throw new Error('Gói ghi chú vượt quá giới hạn 5 MB. Hãy Export để xử lý.');
    }
    async function createFile(name, snapshot) {
        verifySnapshot(snapshot);
        const boundary='atlas_'+uuid().replace(/[^A-Za-z0-9_-]/g,'');
        const head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+
            JSON.stringify({name,parents:['appDataFolder'],mimeType:'application/json'})+'\r\n'+
            '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n';
        const body=head+JSON.stringify(snapshot)+'\r\n--'+boundary+'--\r\n';
        return request(UPLOAD_ENDPOINT+'?uploadType=multipart&fields=id,name,modifiedTime',{
            method:'POST', headers:{'Content-Type':'multipart/related; boundary='+boundary}, body
        });
    }
    async function updateFile(id, snapshot) {
        verifySnapshot(snapshot);
        return request(UPLOAD_ENDPOINT+'/'+encodeURIComponent(id)+'?uploadType=media&fields=id,name,modifiedTime', {
            method:'PATCH', headers:{'Content-Type':'application/json; charset=UTF-8'}, body:JSON.stringify(snapshot)
        });
    }
    async function backup(remote) {
        if (!remote) return;
        const now=new Date().toISOString().replace(/[:.]/g,'-');
        const snapshot={...remote.doc, type:'atlas-backup', backedUpAt:new Date().toISOString()};
        await createFile(BACKUP_PREFIX+now+'-'+uuid()+'.json',snapshot);
    }
    function refreshScreen(notes) {
        applyingRemote=true;
        try {
            if (!bridge.replace(notes)) throw new Error('Không thể cập nhật dữ liệu cục bộ. Drive chưa được ghi đè.');
        } finally { applyingRemote=false; }
    }
    function conflictMessage(count) {
        return `${count} hồ sơ được chỉnh trên cả hai thiết bị hoặc có phiên bản khác nhau. Hãy chọn phiên bản cho từng hồ sơ.`;
    }
    function showConflicts(state) {
        pendingConflict=state;
        els.conflict.replaceChildren();
        const intro=document.createElement('p'); intro.textContent=conflictMessage(state.merge.conflicts.length);
        els.conflict.appendChild(intro);
        const group=document.createElement('div'); group.className='cloud-conflict-list';
        state.merge.conflicts.forEach((item,index)=> {
            const card=document.createElement('div'); card.className='cloud-conflict-card';
            const title=document.createElement('strong'); title.textContent=(item.local && item.local.name) || (item.remote && item.remote.name) || item.id;
            const explanation=document.createElement('small'); explanation.textContent=`ID: ${item.id} · Trên máy: ${item.local ? 'có ghi chú' : 'đã xóa'} · Drive: ${item.remote ? 'có ghi chú' : 'đã xóa'}`;
            const select=document.createElement('select'); select.id='cloud-choice-'+index; select.setAttribute('aria-label','Chọn dữ liệu cho '+item.id);
            [["",'Chưa chọn'],['local','Giữ phiên bản trên máy'],['remote','Giữ phiên bản trên Drive']].forEach(([value,label])=> {
                const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.appendChild(opt);
            });
            const preview=document.createElement('details'); preview.className='cloud-conflict-preview';
            const previewTitle=document.createElement('summary');previewTitle.textContent='Xem nội dung hai phiên bản';
            const comparison=document.createElement('div');comparison.className='cloud-conflict-comparison';
            for (const [side,note] of [['Trên máy',item.local],['Trên Drive',item.remote]]) {
                const block=document.createElement('div');
                const header=document.createElement('b');header.textContent=side;
                const text=document.createElement('pre');
                text.textContent=note ? note.text.slice(0,12000)+(note.text.length>12000?'\n[Chỉ hiện 12.000 ký tự đầu; hãy Export để xem đầy đủ]':'') : '[Đã xóa ghi chú]';
                block.append(header,text);comparison.appendChild(block);
            }
            preview.append(previewTitle,comparison);
            card.append(title,explanation,preview,select); group.appendChild(card);
        });
        const actions=document.createElement('div');actions.className='cloud-conflict-actions';
        const confirmBtn=document.createElement('button'); confirmBtn.type='button';confirmBtn.className='btn-primary';confirmBtn.textContent='Hợp nhất theo lựa chọn';
        confirmBtn.addEventListener('click', () => resolveConflicts());
        const cancelBtn=document.createElement('button');cancelBtn.type='button';cancelBtn.className='btn-secondary';cancelBtn.textContent='Để sau';
        cancelBtn.addEventListener('click',()=>{pendingConflict=null;els.conflict.replaceChildren();status('Có dữ liệu chưa đồng bộ','Giữ nguyên nội dung của cả máy và Drive cho đến khi xử lý.');});
        actions.append(confirmBtn,cancelBtn);els.conflict.append(group,actions);
        status('Cần xử lý xung đột',conflictMessage(state.merge.conflicts.length),true);
    }
    function hideConflicts(){pendingConflict=null;els.conflict.replaceChildren();}

    async function commit(remote, nextNotes, localBefore) {
        // Recheck immediately before writing to avoid overwriting an already-observed change.
        const latest=await readRemote();
        const remoteWasThere=!!remote;
        if (!!latest !== remoteWasThere || (remote && (!latest ||
            latest.file.id !== remote.file.id || latest.doc.revision !== remote.doc.revision ||
            !core.sameNotes(latest.doc.notes,remote.doc.notes)))) {
            throw new Error('Dữ liệu Drive vừa thay đổi ở thiết bị khác. Không ghi đè; bấm Đồng bộ ngay để hợp nhất lại.');
        }
        // For a new cloud document, verify no other device created it since the last read.
        await backup(remote); // If backup fails, write must not continue.
        const doc=core.makeDocument(nextNotes,(remote ? remote.doc.revision : 0)+1,{
            baseRevision:remote ? remote.doc.revision : 0,
            catalogueVersion:'v1.2',
            lastWriter:signedInEmail
        });
        const result=remote ? await updateFile(remote.file.id,doc) : await createFile(MAIN_FILE_NAME,doc);
        // Persist local notes only after cloud upload completes successfully.
        if (!core.sameNotes(bridge.getNotes(),localBefore)) {
            // The latest browser changes remain local and will merge on next sync.
            writeBaseline(nextNotes);
            status('Đã lưu Drive, còn thay đổi mới trên máy','Bấm Đồng bộ ngay để gửi tiếp các chỉnh sửa mới.');
            return result;
        }
        if (!core.sameNotes(localBefore,nextNotes)) refreshScreen(nextNotes);
        writeBaseline(nextNotes);
        status('Đồng bộ thành công',`Revision ${doc.revision} · ${Object.keys(nextNotes).length} ghi chú · ${new Date().toLocaleString('vi-VN')}`);
        return result;
    }

    async function sync(options={}) {
        if (busy || !enabled()) return;
        if (pendingConflict && !options.force) {status('Còn xung đột chưa xử lý','Chọn phiên bản trong danh sách trước khi đồng bộ tiếp.');return;}
        busy=true;buttons();
        status('Đang đồng bộ','Đang đọc và đối chiếu dữ liệu giữa thiết bị và Drive.');
        try {
            ensureLocalWritable();
            const local=core.validateNotes(bridge.getNotes());
            const base=options.base || readBaseline();
            const remote=await readRemote();
            if (!remote) {
                // First-time cloud registration. No overwrite of other Drive user files.
                await commit(null,local,local);
                hideConflicts();
            } else {
                const merge=core.mergeThreeWay(base,local,remote.doc.notes);
                if (merge.conflicts.length) {
                    showConflicts({base,local,remote,merge});
                } else if (core.sameNotes(merge.notes,remote.doc.notes)) {
                    // Drive already has all changes; update local only after a safe local backup.
                    if (!core.sameNotes(bridge.getNotes(),local)) throw new Error('Bạn vừa sửa ghi chú trong lúc đồng bộ. Hãy đồng bộ lại.');
                    if (!core.sameNotes(local,merge.notes)) refreshScreen(merge.notes);
                    writeBaseline(remote.doc.notes);
                    hideConflicts();
                    status('Đã cập nhật từ Drive',`${Object.keys(merge.notes).length} ghi chú · revision ${remote.doc.revision}`);
                } else {
                    await commit(remote,merge.notes,local);
                    hideConflicts();
                }
            }
            if (!pendingConflict) {
                try { await loadHistory(); }
                catch(e) { console.warn('History could not be loaded after sync:',e); }
            }
        } catch(error) {
            console.error('Atlas cloud synchronization:',error);
            status('Đồng bộ chưa hoàn tất',error.message,true);
        } finally {busy=false;buttons();}
    }
    async function resolveConflicts() {
        if (busy || !pendingConflict) return;
        const state=pendingConflict;
        const notes={...state.merge.notes};
        for(let i=0;i<state.merge.conflicts.length;i++) {
            const choice=$('cloud-choice-'+i).value;
            if (!choice) {status('Chưa chọn đủ phiên bản','Hãy chọn phiên bản cho tất cả hồ sơ xung đột.',true);return;}
            const conflict=state.merge.conflicts[i];
            const chosen=choice==='local' ? conflict.local : conflict.remote;
            if (chosen) notes[conflict.id]={...chosen};
            else delete notes[conflict.id];
        }
        if (!confirm('Đồng bộ dữ liệu đã hợp nhất? Bản hiện tại trên Drive sẽ được sao lưu trước khi thay đổi.')) return;
        busy=true;buttons();status('Đang áp dụng quyết định','Kiểm tra lại hai phiên bản trước khi lưu.');
        try {
            if (!core.sameNotes(bridge.getNotes(),state.local)) throw new Error('Dữ liệu trên máy vừa thay đổi. Hãy đồng bộ lại trước khi quyết định.');
            await commit(state.remote,core.validateNotes(notes),state.local);
            hideConflicts();await loadHistory();
        } catch(error){status('Chưa xử lý xong xung đột',error.message,true);}
        finally{busy=false;buttons();}
    }

    async function loadHistory() {
        if (!enabled()) return;
        const backups=await listFiles("name contains '"+BACKUP_PREFIX+"'",100);
        els.history.replaceChildren();
        if (!backups.length) {els.history.textContent='Chưa có bản sao lưu trên Drive.';return;}
        const label=document.createElement('small');label.textContent=`${backups.length} phiên bản tìm thấy (hiện tối đa 20).`;els.history.appendChild(label);
        for(const file of backups.slice(0,20)) {
            const line=document.createElement('div');line.className='cloud-history-row';
            const title=document.createElement('span');
            title.textContent=new Date(file.modifiedTime).toLocaleString('vi-VN');
            const downloadBtn=document.createElement('button');downloadBtn.type='button';downloadBtn.textContent='Tải JSON';
            downloadBtn.addEventListener('click',async()=> {
                try {const doc=await download(file.id);const validated=core.validateNotes(doc.notes);
                    const blob=new Blob([JSON.stringify(validated,null,2)],{type:'application/json'});
                    const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;
                    a.download='atlas_backup_'+file.id+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);
                } catch(error){status('Không tải được bản sao lưu',error.message,true);}
            });
            const restoreBtn=document.createElement('button');restoreBtn.type='button';restoreBtn.textContent='Khôi phục';
            restoreBtn.addEventListener('click',()=>restore(file));
            line.append(title,downloadBtn,restoreBtn);els.history.appendChild(line);
        }
    }
    async function restore(file) {
        if (!enabled() || busy) return;
        busy=true;buttons();status('Đang kiểm tra phiên bản','Đọc bản sao lưu và dữ liệu hiện tại.');
        try {
            ensureLocalWritable();
            const backupDoc=await download(file.id);
            const restored=core.validateNotes(backupDoc.notes);
            const remote=await readRemote();
            if (!remote) throw new Error('Không tồn tại dữ liệu chính trên Drive; hãy kết nối và đồng bộ trước.');
            const date=new Date(file.modifiedTime).toLocaleString('vi-VN');
            if (!confirm(`Khôi phục ${Object.keys(restored).length} ghi chú từ ${date}?\n\n`+
                'Thao tác này thay thế trạng thái hiện tại, nhưng sẽ tạo bản sao lưu Drive trước khi ghi.')) return;
            const localBefore=core.validateNotes(bridge.getNotes());
            await commit(remote,restored,localBefore);
            hideConflicts();await loadHistory();
            status('Khôi phục hoàn tất',`Đã khôi phục ${Object.keys(restored).length} ghi chú từ ${date}.`);
        } catch(error){status('Không thể khôi phục',error.message,true);}
        finally{busy=false;buttons();}
    }

    async function authComplete(response) {
        try {
            if (!response || !response.access_token || response.error) throw new Error('Google không cấp quyền truy cập.');
            token=response.access_token;
            expiresAt=Date.now()+Math.max(60,Number(response.expires_in)||3500)*1000;
            const profile=await request('https://www.googleapis.com/oauth2/v3/userinfo');
            signedInEmail=(profile.email||'').toLowerCase();
            if (signedInEmail !== EXPECTED_EMAIL || profile.email_verified === false) {
                token=null;expiresAt=0;signedInEmail='';
                throw new Error('Tài khoản đăng nhập không phải T.MN. Hãy đăng nhập đúng '+EXPECTED_EMAIL+'.');
            }
            saveSettings();buttons();
            status('Đã kết nối T.MN','Đang đối chiếu dữ liệu với Google Drive riêng của ứng dụng.');
            await sync();
        } catch(error) {token=null;expiresAt=0;signedInEmail='';buttons();status('Chưa kết nối',error.message,true);}
    }
    function connect() {
        const clientId=els.client.value.trim();
        if (!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
            status('Thiếu cấu hình OAuth','Nhập OAuth Client ID của ứng dụng web trong Google Cloud.',true);return;
        }
        if (!root.google || !google.accounts || !google.accounts.oauth2) {
            status('Không tải được Google Identity','Cần Internet và không chặn accounts.google.com.',true);return;
        }
        try {
            tokenClient=google.accounts.oauth2.initTokenClient({
                client_id:clientId,scope:APPDATA_SCOPE+' '+EMAIL_SCOPE,
                callback:authComplete,
                error_callback:(error)=>status('Đăng nhập không thành công',error.type || 'Đã đóng cửa sổ Google.',true)
            });
            saveSettings();tokenClient.requestAccessToken({prompt:'select_account'});
        } catch(error){status('Không mở được cửa sổ Google',error.message,true);}
    }
    function disconnect() {
        if (busy) return;
        if (token && root.google && google.accounts && google.accounts.oauth2) {
            google.accounts.oauth2.revoke(token,()=>{});
        }
        token=null;expiresAt=0;signedInEmail='';pendingConflict=null;
        els.conflict.replaceChildren();els.history.replaceChildren();buttons();
        status('Đã ngắt kết nối','Dữ liệu và mốc đồng bộ trên máy vẫn được giữ để kết nối lần sau.');
    }
    function scheduleAutoSync() {
        if (applyingRemote || !els.auto.checked || !enabled()) return;
        clearTimeout(autosyncTimeout);
        autosyncTimeout=setTimeout(()=>{
            if (busy) {scheduleAutoSync();return;}
            sync();
        },4000);
    }
    els.connect.addEventListener('click',connect);
    els.sync.addEventListener('click',()=>{clearTimeout(autosyncTimeout);sync();});
    els.disconnect.addEventListener('click',disconnect);
    els.refresh.addEventListener('click',async()=>{
        if (busy || !enabled()) return;
        busy=true;buttons();
        try {await loadHistory();status('Đã tải lịch sử','Chọn bản sao lưu để tải hoặc khôi phục.');}
        catch(e){status('Không tải được lịch sử',e.message,true);}
        finally{busy=false;buttons();}
    });
    els.auto.addEventListener('change',saveSettings);
    window.addEventListener('atlas:notes-changed',scheduleAutoSync);
    window.addEventListener('storage',event=>{
        if (event.key==='worldFurnitureNotes') {
            staleTab=true;
            status('Dữ liệu đổi ở tab khác','Đã khóa đồng bộ tại tab này. Hãy sao lưu bản nháp và tải lại trang.',true);
        }
    });
    document.addEventListener('visibilitychange',()=>{
        if (document.visibilityState==='visible' && enabled() && els.auto.checked && !pendingConflict) scheduleAutoSync();
    });
    setInterval(()=>{if(enabled() && els.auto.checked && !busy && !pendingConflict && document.visibilityState==='visible') sync();},240000);
    root.ATLAS_CLOUD_V4={ sync, disconnect, readBaseline };
})(window);