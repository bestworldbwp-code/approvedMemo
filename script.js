// ================= 1. CONFIG (ตั้งค่าระบบ) =================
const CONFIG = {
    // Supabase
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    
    // EmailJS
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 

    // ใส่ลิงก์เว็บของคุณ (ถ้ามี)
    siteUrl: '', 

    // [1] อีเมลหัวหน้าแผนก
    departmentHeads: {
        'จัดซื้อ':           'jakkidmarat@gmail.com',
        'บัญชี':             'jakkidmarat@gmail.com',
        'ฝ่ายผลิต(เป่า)':    'jakkidmarat@gmail.com',
        'ฝ่ายผลิต(พิมพ์)':   'jakkidmarat@gmail.com',
        'ซ่อมบำรุง':         'jakkidmarat@gmail.com',
        'คลังสินค้า':        'jakkidmarat@gmail.com',
        'ขาย/การตลาด':       'jakkidmarat@gmail.com'
    },

    // [2] ผู้ช่วย กก.
    managerEmail: 'bestworld.bwp328@gmail.com', 

    // [3] จัดซื้อ (รับเฉพาะ PR)
    purchasingEmail: 'hr.bpp.2564@gmail.com',

    // รหัสผ่าน
    passwords: {
        '1001': 'จัดซื้อ',        
        '1002': 'บัญชี',          
        '1003': 'ฝ่ายผลิต(เป่า)',
        '1006': 'ฝ่ายผลิต(พิมพ์)',
        '1007': 'ซ่อมบำรุง',
        '1004': 'คลังสินค้า',     
        '1005': 'ขาย/การตลาด',    
        '9999': 'MANAGER_ROLE'    
    }
};

// ================= 2. SYSTEM START =================
const db = supabase.createClient(CONFIG.supaUrl, CONFIG.supaKey);
if(typeof emailjs !== 'undefined') emailjs.init(CONFIG.emailPublicKey);

let currentUserRole = sessionStorage.getItem('userRole') || ''; 
let currentUserDept = sessionStorage.getItem('userDept') || ''; 
let currentDocType = 'pr'; // 'pr' หรือ 'memo'
let currentMode = 'pending'; 
let allDocs = []; 
let currentDoc = {};

document.addEventListener("DOMContentLoaded", function() {
    if (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
        document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64);
    }
    if (window.location.href.includes('admin.html')) {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            if (currentUserRole && sessionStorage.getItem('isAdmin') === 'true') {
                overlay.style.display = 'none';
                updateAdminUI();
                loadData(); 
            } else {
                overlay.style.display = 'flex';
            }
        }
    }
});

// ================= 3. MEMO FORM =================
const memoForm = document.getElementById('memoForm');
if (memoForm) {
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnMemoSubmit');
        const originalText = btn.innerText;
        btn.disabled = true; 
        try {
            let publicUrl = null;
            const fileInput = document.getElementById('m_attachment');
            if (fileInput && fileInput.files.length > 0) {
                btn.innerText = '⏳ อัปโหลดไฟล์...';
                const file = fileInput.files[0];
                const fileName = `memo_${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (upErr) throw upErr;
                const { data: urlData } = db.storage.from('pr-files').getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
            }

            btn.innerText = '⏳ บันทึกข้อมูล...';
            const payload = {
                memo_no: document.getElementById('m_no').value,
                date: document.getElementById('m_date').value,
                from_dept: document.getElementById('m_from').value,
                to_dept: document.getElementById('m_to').value,
                subject: document.getElementById('m_subject').value,
                content: document.getElementById('m_content').value,
                attachment_url: publicUrl,
                status: 'pending_head' 
            };

            const { error } = await db.from('memos').insert([payload]);
            if (error) throw error;

            btn.innerText = '⏳ ส่งเมลหาหัวหน้า...';
            const headEmail = CONFIG.departmentHeads[payload.from_dept];
            const adminLink = window.location.origin + '/admin.html';

            if (headEmail) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: headEmail, 
                    subject: `[New Memo] ขออนุมัติ Memo: ${payload.memo_no}`, 
                    html_content: `<h3>เรียน หัวหน้าแผนก${payload.from_dept}</h3><p>มีการสร้างบันทึกข้อความ (Memo) ใหม่ รอการตรวจสอบจากท่าน</p><p><b>เลขที่:</b> ${payload.memo_no}</p><p><b>เรื่อง:</b> ${payload.subject}</p><br><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบอนุมัติ</a>` 
                });
            }
            alert('✅ ส่ง Memo ให้หัวหน้าตรวจสอบเรียบร้อย!');
            window.location.reload();
        } catch (err) { console.error(err); alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerText = originalText; }
    });
}

// ================= 4. ADMIN & APPROVAL LOGIC =================

window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput').value;
    const matchedDept = CONFIG.passwords[input];
    if (matchedDept) {
        sessionStorage.setItem('isAdmin', 'true');
        if (matchedDept === 'MANAGER_ROLE') { currentUserRole = 'manager'; currentUserDept = 'ALL'; } 
        else { currentUserRole = 'head'; currentUserDept = matchedDept; }
        sessionStorage.setItem('userRole', currentUserRole);
        sessionStorage.setItem('userDept', currentUserDept);
        document.getElementById('loginOverlay').style.display = 'none';
        updateAdminUI(); loadData();
    } else { alert("❌ รหัสผ่านไม่ถูกต้อง!"); }
}

function updateAdminUI() {
    const title = document.querySelector('#pageTitle');
    if (title) {
        const roleText = currentUserRole === 'head' ? `(หัวหน้า ${currentUserDept})` : `(ผู้ช่วย กก.)`;
        title.innerText = `👑 ตรวจสอบรายการ ${roleText}`;
    }
}

window.switchDocType = function(type) {
    currentDocType = type;
    document.getElementById('btnTypePR').className = type === 'pr' ? 'btn btn-primary' : 'btn btn-outline-primary';
    document.getElementById('btnTypeMemo').className = type === 'memo' ? 'btn btn-primary' : 'btn btn-outline-primary';
    loadData();
}

window.switchTab = function(mode) {
    currentMode = mode;
    document.getElementById('btnPending').className = mode === 'pending' ? 'btn btn-warning active' : 'btn btn-outline-secondary';
    document.getElementById('btnHistory').className = mode === 'history' ? 'btn btn-secondary active' : 'btn btn-outline-secondary';
    loadData();
}

async function loadData() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">⏳ กำลังโหลด...</td></tr>';
    
    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let query = db.from(tableName).select('*').order('created_at', { ascending: false });

        if (currentMode === 'pending') {
            if (currentUserRole === 'head') {
                query = query.eq('status', 'pending_head');
                if(currentDocType === 'pr') query = query.eq('department', currentUserDept);
                else query = query.eq('from_dept', currentUserDept);
            } else if (currentUserRole === 'manager') {
                query = query.eq('status', 'pending_manager');
            }
        } else {
            if (currentUserRole === 'head') {
                query = query.neq('status', 'pending_head');
                if(currentDocType === 'pr') query = query.eq('department', currentUserDept);
                else query = query.eq('from_dept', currentUserDept);
            } else {
                query = query.in('status', ['processed', 'approved', 'rejected']);
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        allDocs = data;
        tableBody.innerHTML = '';
        
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบรายการ</td></tr>`; return; }

        data.forEach(doc => {
            const date = new Date(doc.created_at || doc.date).toLocaleDateString('th-TH');
            let docNo = currentDocType === 'pr' ? doc.pr_number : doc.memo_no;
            let from = currentDocType === 'pr' ? `${doc.requester} (${doc.department})` : `${doc.from_dept} / ${doc.subject}`;
            let statusText = doc.status;
            if (doc.status === 'pending_head') statusText = 'รอหัวหน้าแผนก';
            if (doc.status === 'pending_manager') statusText = 'รอผู้ช่วย กก.';
            if (doc.status === 'processed') statusText = 'อนุมัติเรียบร้อย';

            const row = `<tr><td><span class="fw-bold text-primary">${docNo}</span></td><td>${date}</td><td><div class="small">${from}</div></td><td><span class="badge bg-secondary">${statusText}</span></td><td class="text-center"><button onclick="openDetailModal('${doc.id}')" class="btn btn-outline-info btn-sm rounded-pill px-3">ตรวจสอบ</button></td></tr>`;
            tableBody.innerHTML += row;
        });

    } catch (err) { console.error(err); tableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${err.message}</td></tr>`; }
}

window.openDetailModal = function(id) {
    currentDoc = allDocs.find(d => String(d.id) === String(id));
    if (!currentDoc) return;

    if (currentDocType === 'pr') {
        document.getElementById('pr_content_area').style.display = 'block';
        document.getElementById('memo_content_area').style.display = 'none';
        document.getElementById('m_doc_no').innerText = currentDoc.pr_number;
        document.getElementById('m_date').innerText = new Date(currentDoc.required_date).toLocaleDateString('th-TH');
        document.getElementById('m_from').innerText = currentDoc.requester + " (" + currentDoc.department + ")";
        document.getElementById('m_subject_remark').innerText = currentDoc.header_remark || '-';
        renderItemsTable();
    } else {
        document.getElementById('pr_content_area').style.display = 'none';
        document.getElementById('memo_content_area').style.display = 'block';
        document.getElementById('m_doc_no').innerText = currentDoc.memo_no;
        document.getElementById('m_date').innerText = new Date(currentDoc.date).toLocaleDateString('th-TH');
        document.getElementById('m_from').innerText = currentDoc.from_dept;
        document.getElementById('m_subject_remark').innerText = currentDoc.subject;
        document.getElementById('m_memo_text').innerText = currentDoc.content;
    }

    document.getElementById('m_attachment').innerHTML = currentDoc.attachment_url ? `<a href="${currentDoc.attachment_url}" target="_blank" class="btn btn-sm btn-outline-primary">📎 ดูไฟล์</a>` : '-';

    const saveBtn = document.querySelector('.modal-footer .btn-success');
    if (currentMode === 'history') {
        saveBtn.style.display = 'none';
    } else {
        saveBtn.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.innerText = (currentUserRole === 'head') ? '✅ ผ่านการตรวจสอบ ➡️ ส่งผู้ช่วย กก.' : '✅ อนุมัติ ➡️ จบงาน';
    }
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function renderItemsTable() {
    const itemsTable = document.getElementById('m_itemsTable');
    if (!itemsTable) return;
    const tableContainer = itemsTable.parentElement; 
    let thead = tableContainer.querySelector('thead');
    if(!thead) { thead = document.createElement('thead'); thead.className = 'table-secondary'; tableContainer.prepend(thead); }
    thead.innerHTML = `<tr><th class="text-center" width="5%"><input type="checkbox" id="selectAll" class="form-check-input" onclick="toggleSelectAll(this)" checked></th><th width="15%">รหัส</th><th>รายละเอียด</th><th class="text-center" width="10%">จำนวน</th><th class="text-center" width="10%">หน่วย</th><th width="25%">เหตุผล (ถ้าไม่อนุมัติ)</th></tr>`;
    let htmlRows = '';
    if (currentDoc.items) {
        currentDoc.items.forEach((item, index) => {
            if (currentUserRole === 'manager' && item.status === 'rejected') return;
            const isChecked = (item.status === 'approved' || item.status === 'pending');
            const reasonStyle = isChecked ? 'display:none;' : 'display:block;';
            const statusStyle = isChecked ? 'display:inline;' : 'display:none;';
            const rowClass = isChecked ? '' : 'table-danger';
            htmlRows += `<tr id="tr-item-${index}" class="${rowClass}"><td class="text-center"><input type="checkbox" class="form-check-input item-checkbox" data-index="${index}" onchange="toggleItem(this, ${index})" ${isChecked ? 'checked' : ''}></td><td>${item.code || '-'}</td><td>${item.description}</td><td class="text-center">${item.quantity} ${item.unit || ''}</td><td class="text-center">${item.unit}</td><td><input type="text" class="form-control form-control-sm item-reason" id="reason-${index}" placeholder="เหตุผล..." value="${item.remark||''}" style="${reasonStyle}"><span id="status-text-${index}" class="text-success small fw-bold" style="${statusStyle}">✅ อนุมัติ</span></td></tr>`;
        });
    }
    itemsTable.innerHTML = htmlRows;
}
window.toggleSelectAll = function(source) { document.querySelectorAll('.item-checkbox').forEach(cb => { cb.checked = source.checked; toggleItem(cb, cb.dataset.index); }); }
window.toggleItem = function(checkbox, index) { const reasonInput = document.getElementById(`reason-${index}`); const statusText = document.getElementById(`status-text-${index}`); const row = document.getElementById(`tr-item-${index}`); if (checkbox.checked) { reasonInput.style.display = 'none'; statusText.style.display = 'inline'; row.classList.remove('table-danger'); } else { reasonInput.style.display = 'block'; reasonInput.focus(); statusText.style.display = 'none'; row.classList.add('table-danger'); } }

// ฟังก์ชันจบงาน (Logic การอนุมัติ)
window.finalizeApproval = async function() {
    const btn = document.querySelector('.modal-footer .btn-success');
    btn.disabled = true; btn.innerText = '⏳ กำลังประมวลผล...';

    try {
        let nextStatus = '';
        const adminLink = window.location.origin + '/admin.html';
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        
        // --- CASE 1: หัวหน้าแผนกอนุมัติ ---
        if (currentUserRole === 'head') {
            nextStatus = 'pending_manager'; 
            
            if (currentDocType === 'pr') {
                document.querySelectorAll('.item-checkbox').forEach(cb => {
                    const idx = cb.dataset.index;
                    currentDoc.items[idx].status = cb.checked ? 'approved' : 'rejected';
                    if (!cb.checked) currentDoc.items[idx].remark = document.getElementById(`reason-${idx}`).value;
                });
                await db.from(tableName).update({ status: nextStatus, items: currentDoc.items }).eq('id', currentDoc.id);
            } else {
                await db.from(tableName).update({ status: nextStatus }).eq('id', currentDoc.id);
            }

            // ส่งเมลหา ผช.กก. (เหมือนเดิม)
            let docNo = currentDocType === 'pr' ? currentDoc.pr_number : currentDoc.memo_no;
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                to_email: CONFIG.managerEmail, 
                subject: `[Step 2] หัวหน้าตรวจสอบแล้ว: ${currentDocType.toUpperCase()} ${docNo}`, 
                html_content: `<h3>เรียน ผู้ช่วยกรรมการผู้จัดการ</h3><p>รายการ ${currentDocType.toUpperCase()} เลขที่ <b>${docNo}</b> ผ่านการตรวจสอบขั้นต้นแล้ว</p><p>กรุณาพิจารณาอนุมัติ</p><br><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบ</a>` 
            });
            alert('✅ ส่งต่อให้ผู้ช่วยกรรมการเรียบร้อย!');
        } 
        
        // --- CASE 2: ผู้ช่วยกรรมการอนุมัติ (Final) ---
        else if (currentUserRole === 'manager') {
            nextStatus = 'processed';
            
            if (currentDocType === 'pr') {
                // (Logic PR: ส่งไปจัดซื้อ เหมือนเดิม)
                document.querySelectorAll('.item-checkbox').forEach(cb => { const idx = cb.dataset.index; currentDoc.items[idx].status = cb.checked ? 'approved' : 'rejected'; });
                await db.from(tableName).update({ status: nextStatus, items: currentDoc.items }).eq('id', currentDoc.id);
                if (CONFIG.purchasingEmail) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: CONFIG.purchasingEmail, 
                        subject: `[Approved] สั่งซื้อสินค้า PR ${currentDoc.pr_number}`, 
                        html_content: `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>PR ${currentDoc.pr_number} อนุมัติแล้ว โปรดดำเนินการ</p>` 
                    });
                }
            } else {
                // [แก้ไข] Logic Memo: ส่งกลับหา "หัวหน้าแผนก" (เจ้าของเรื่อง)
                await db.from(tableName).update({ status: nextStatus }).eq('id', currentDoc.id);
                
                const viewLink = window.location.origin + `/view_memo.html?id=${currentDoc.id}`;
                const headEmail = CONFIG.departmentHeads[currentDoc.from_dept]; // หาอีเมลหัวหน้าแผนกต้นเรื่อง

                if (headEmail) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: headEmail, // ส่งกลับหัวหน้าแผนก
                        subject: `[Approved] อนุมัติ Memo: ${currentDoc.memo_no}`, 
                        html_content: `
                            <h3>เรียน หัวหน้าแผนก${currentDoc.from_dept}</h3>
                            <p>Memo เลขที่ <b>${currentDoc.memo_no}</b> ได้รับการอนุมัติจากผู้ช่วยกรรมการแล้ว</p>
                            <p><b>เรื่อง:</b> ${currentDoc.subject}</p>
                            <br>
                            <a href="${viewLink}" style="background:green;color:white;padding:10px;">📄 ดูรายละเอียด Memo</a>
                        ` 
                    });
                }
            }
            alert('✅ อนุมัติจบงานเรียบร้อย!');
        }

        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadData();
    } catch (err) { console.error(err); alert('Error: ' + err.message); if(btn) btn.disabled = false; }
}

// PR Form Logic
window.addItemRow = function() {
    const container = document.getElementById('itemsContainer');
    if (!container) return; 
    const rowId = Date.now(); 
    const html = `<div class="item-row border p-3 mb-3 rounded bg-light shadow-sm" id="row-${rowId}"><div class="row g-3"><div class="col-md-3"><label class="small text-muted">รหัสสินค้า</label><input type="text" class="form-control item-code"></div><div class="col-md-5"><label class="small text-muted">รายละเอียด</label><input type="text" class="form-control item-desc" required></div><div class="col-md-2"><label class="small text-muted">จำนวน</label><input type="number" class="form-control item-qty" required></div><div class="col-md-2"><label class="small text-muted">หน่วย</label><input type="text" class="form-control item-unit"></div></div><div class="text-end mt-2"><button type="button" class="btn btn-outline-danger btn-sm" onclick="removeRow('${rowId}')">🗑️ ลบรายการนี้</button></div></div>`;
    container.insertAdjacentHTML('beforeend', html);
}
window.removeRow = function(id) { document.getElementById(`row-${id}`)?.remove(); }
if (document.getElementById('itemsContainer')) window.addItemRow();

const prForm = document.getElementById('prForm');
if (prForm) {
    prForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit');
        const originalText = btn.innerText;
        btn.disabled = true; 
        try {
            const dept = document.getElementById('department').value;
            const headEmail = CONFIG.departmentHeads[dept];
            if (!headEmail) { alert("⚠️ ไม่พบอีเมลหัวหน้าของแผนกนี้"); throw new Error("Email not found"); }
            let publicUrl = null;
            const fileInput = document.getElementById('attachment');
            if (fileInput.files.length > 0) {
                btn.innerText = '⏳ อัปโหลดไฟล์...';
                const file = fileInput.files[0];
                const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (upErr) throw upErr;
                const { data: urlData } = db.storage.from('pr-files').getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
            }
            btn.innerText = '⏳ บันทึกข้อมูล...';
            const items = [];
            document.querySelectorAll('.item-row').forEach(row => { items.push({code: row.querySelector('.item-code').value, description: row.querySelector('.item-desc').value, quantity: row.querySelector('.item-qty').value, unit: row.querySelector('.item-unit').value, status: 'pending', remark: ''}); });
            const payload = { department: dept, pr_number: document.getElementById('pr_number').value, requester: document.getElementById('requester').value, email: document.getElementById('email').value, required_date: document.getElementById('required_date').value, header_remark: document.getElementById('header_remark').value, items: items, attachment_url: publicUrl, status: 'pending_head' };
            const { error } = await db.from('purchase_requests').insert([payload]);
            if (error) throw error;
            btn.innerText = '⏳ ส่งอีเมล...';
            const adminLink = window.location.origin + '/admin.html';
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: headEmail, subject: `[New Request] แผนก${dept} ขอตรวจสอบ PR ${payload.pr_number}`, html_content: `<h3>เรียน หัวหน้าแผนก${dept},</h3><p>มีรายการขอซื้อใหม่จาก <b>${payload.requester}</b> รอการตรวจสอบครับ</p><p>เลขที่ PR: ${payload.pr_number}</p><p><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบ</a></p>` });
            alert(`✅ ส่งเรื่องถึงหัวหน้าแผนก${dept} เรียบร้อยแล้ว!`); window.location.reload();
        } catch (err) { console.error(err); alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerText = originalText; }
    });
}

// Print Loaders
async function loadPRForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const filter = params.get('filter');
    if (!id) return;
    try {
        const { data: pr, error } = await db.from('purchase_requests').select('*').eq('id', id).single();
        if (error) throw error;
        document.getElementById('v_pr_number').innerText = pr.pr_number;
        document.getElementById('v_created_at').innerText = new Date(pr.created_at).toLocaleDateString('th-TH');
        document.getElementById('v_requester').innerText = pr.requester;
        document.getElementById('v_department').innerText = pr.department;
        document.getElementById('v_doc_status').innerText = pr.status === 'processed' ? 'อนุมัติเรียบร้อย' : 'รออนุมัติ';
        document.getElementById('v_remark').innerText = pr.header_remark || '-';
        document.getElementById('v_sign_requester').innerText = `${pr.requester}`;
        document.getElementById('v_required_date').innerText = new Date(pr.required_date).toLocaleDateString('th-TH');
        if (pr.status === 'pending_manager' || pr.status === 'processed') { document.getElementById('v_sign_head').innerHTML = `( หัวหน้าแผนก${pr.department} )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>`; }
        if (pr.status === 'processed') { document.getElementById('v_sign_manager').innerHTML = '( เบญจมาศ ถิ่นจันทร์ )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>'; }
        const tbody = document.getElementById('v_tableBody'); tbody.innerHTML = '';
        let displayItems = pr.items;
        if (filter === 'approved') displayItems = pr.items.filter(item => item.status === 'approved');
        if (displayItems) {
            displayItems.forEach((item, index) => {
                let statusText = '⏳ รอ';
                if (item.status === 'approved') statusText = '<span class="fw-bold" style="color:#000;">✅ อนุมัติ</span>';
                else if (item.status === 'rejected') statusText = `<span style="text-decoration:line-through;color:#000;">❌ ไม่อนุมัติ</span>`;
                tbody.innerHTML += `<tr><td class="text-center">${index + 1}</td><td>${item.code || '-'}</td><td>${item.description}</td><td class="text-center">${item.quantity}</td><td class="text-center">${item.unit}</td><td class="text-center">${statusText}</td></tr>`;
            });
        }
    } catch (err) { alert('Error: ' + err.message); }
}

async function loadMemoForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    try {
        const { data: m, error } = await db.from('memos').select('*').eq('id', id).single();
        if (error) throw error;
        document.getElementById('v_memo_no').innerText = m.memo_no;
        document.getElementById('v_date').innerText = new Date(m.date).toLocaleDateString('th-TH');
        document.getElementById('v_from').innerText = m.from_dept;
        document.getElementById('v_to').innerText = m.to_dept;
        document.getElementById('v_subject').innerText = m.subject;
        document.getElementById('v_content').innerText = m.content;
        if (m.attachment_url) {
            document.getElementById('v_attachment_area').style.display = 'block';
            document.getElementById('v_attachment_link').href = m.attachment_url;
        }
    } catch (err) { alert('Error: ' + err.message); }
}

if(document.getElementById('v_tableBody')) window.onload = loadPRForPrint;
if(document.getElementById('v_content')) window.onload = loadMemoForPrint;

document.addEventListener('keydown', function(event) { if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); return false; } });
