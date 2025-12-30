const CONFIG = {
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 
    siteUrl: '', 
    departmentHeads: { 'จัดซื้อ': 'jakkidmarat@gmail.com', 'QC': 'jakkidmarat@gmail.com', 'ซ่อมบำรุง': 'jakkidmarat@gmail.com', 'ฝ่ายผลิต': 'jakkidmarat@gmail.com', 'HR': 'jakkidmarat@gmail.com' },
    managerEmail: 'bestworld.bwp328@gmail.com', purchasingEmail: 'hr.bpp.2564@gmail.com',
    passwords: { '1001': 'จัดซื้อ', '1002': 'QC', '1003': 'ซ่อมบำรุง', '1004': 'ฝ่ายผลิต', '1005': 'HR', '9999': 'MANAGER_ROLE' }
};

const db = supabase.createClient(CONFIG.supaUrl, CONFIG.supaKey);
if(typeof emailjs !== 'undefined') emailjs.init(CONFIG.emailPublicKey);

let currentUserRole = sessionStorage.getItem('userRole') || ''; 
let currentUserDept = sessionStorage.getItem('userDept') || ''; 
let currentDocType = 'pr';
let currentMode = 'pending'; 
let allDocs = []; 
let currentDoc = {};

document.addEventListener("DOMContentLoaded", function() {
    if (typeof LOGO_BASE64 !== 'undefined') { document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64); }
    if (window.location.href.includes('admin.html')) {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            if (currentUserRole && sessionStorage.getItem('isAdmin') === 'true') { overlay.style.display = 'none'; updateAdminUI(); loadData(); } 
            else { overlay.style.display = 'flex'; }
        }
    }
});

// MEMO FORM
const memoForm = document.getElementById('memoForm');
if (memoForm) {
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnMemoSubmit'); btn.disabled = true; btn.innerText = '⏳ กำลังบันทึก...';
        try {
            let publicUrl = null;
            const fileInput = document.getElementById('m_attachment');
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0]; const fileName = `memo_${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (!upErr) { const { data } = db.storage.from('pr-files').getPublicUrl(fileName); publicUrl = data.publicUrl; }
            }
            const payload = {
                memo_no: document.getElementById('m_no').value, date: document.getElementById('m_date').value,
                from_dept: document.getElementById('m_from').value, to_dept: document.getElementById('m_to').value,
                subject: document.getElementById('m_subject').value, content: document.getElementById('m_content').value,
                attachment_url: publicUrl, status: 'pending_head'
            };
            await db.from('memos').insert([payload]);
            if (CONFIG.departmentHeads[payload.from_dept]) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.departmentHeads[payload.from_dept], subject: `[New Memo] ${payload.memo_no}`, html_content: `<h3>Memo ใหม่รออนุมัติ</h3><p>เลขที่: ${payload.memo_no}</p><a href="${window.location.origin}/admin.html">เข้าสู่ระบบ</a>` });
            }
            alert('✅ ส่ง Memo เรียบร้อย!'); window.location.reload();
        } catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
}

// PR FORM
window.addItemRow = function() { const c = document.getElementById('itemsContainer'); if(c) c.insertAdjacentHTML('beforeend', `<div class="item-row border p-3 mb-3 rounded bg-light shadow-sm"><div class="row g-3"><div class="col-md-3"><input class="form-control item-code" placeholder="รหัส"></div><div class="col-md-5"><input class="form-control item-desc" required placeholder="รายละเอียด"></div><div class="col-md-2"><input type="number" class="form-control item-qty" required placeholder="จำนวน"></div><div class="col-md-2"><input class="form-control item-unit" placeholder="หน่วย"></div></div><div class="text-end mt-2"><button type="button" class="btn btn-outline-danger btn-sm" onclick="this.closest('.item-row').remove()">🗑️ ลบรายการนี้</button></div></div>`); }
if (document.getElementById('itemsContainer')) window.addItemRow();
const prForm = document.getElementById('prForm');
if (prForm) {
    prForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSubmit'); btn.disabled = true; btn.innerText = '⏳ กำลังบันทึก...';
        try {
            const dept = document.getElementById('department').value;
            const items = [];
            document.querySelectorAll('.item-row').forEach(row => { items.push({code: row.querySelector('.item-code').value, description: row.querySelector('.item-desc').value, quantity: row.querySelector('.item-qty').value, unit: row.querySelector('.item-unit').value, status: 'pending', remark: ''}); });
            let publicUrl = null;
            const fileInput = document.getElementById('attachment');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0]; const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await db.storage.from('pr-files').upload(fileName, file);
                if (!upErr) { const { data } = db.storage.from('pr-files').getPublicUrl(fileName); publicUrl = data.publicUrl; }
            }
            const payload = { department: dept, pr_number: document.getElementById('pr_number').value, requester: document.getElementById('requester').value, email: document.getElementById('email').value, required_date: document.getElementById('required_date').value, header_remark: document.getElementById('header_remark').value, items: items, attachment_url: publicUrl, status: 'pending_head' };
            await db.from('purchase_requests').insert([payload]);
            if (CONFIG.departmentHeads[dept]) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.departmentHeads[dept], subject: `[New PR] ${payload.pr_number}`, html_content: `<h3>PR ใหม่รออนุมัติ</h3><p>เลขที่: ${payload.pr_number}</p><a href="${window.location.origin}/admin.html">เข้าสู่ระบบ</a>` });
            }
            alert('✅ บันทึก PR เรียบร้อย!'); window.location.reload();
        } catch (err) { alert('Error: ' + err.message); btn.disabled = false; }
    });
}

// ADMIN LOGIC
window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput').value;
    const matchedDept = CONFIG.passwords[input];
    if (matchedDept) {
        sessionStorage.setItem('isAdmin', 'true');
        if (matchedDept === 'MANAGER_ROLE') { currentUserRole = 'manager'; currentUserDept = 'ALL'; } 
        else { currentUserRole = 'head'; currentUserDept = matchedDept; }
        sessionStorage.setItem('userRole', currentUserRole); sessionStorage.setItem('userDept', currentUserDept);
        document.getElementById('loginOverlay').style.display = 'none'; updateAdminUI(); loadData();
    } else { alert("❌ รหัสผ่านไม่ถูกต้อง!"); }
}

function updateAdminUI() {
    const title = document.querySelector('#pageTitle');
    if (title) title.innerText = currentUserRole === 'head' ? `สถานะ: ผู้อนุมัติเบื้องต้น (${currentUserDept})` : 'สถานะ: ผู้อนุมัติ (ผู้บริหาร)';
}

window.switchDocType = function(type) { currentDocType = type; loadData(); }
window.switchTab = function(mode) { currentMode = mode; loadData(); }

async function loadData() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">⏳ กำลังโหลด...</td></tr>';
    updateBadges();
    
    let query = db.from(currentDocType === 'pr' ? 'purchase_requests' : 'memos').select('*').order('created_at', { ascending: false });
    if (currentMode === 'pending') {
        if (currentUserRole === 'head') {
            query = query.eq('status', 'pending_head');
            if(currentDocType === 'pr') query = query.eq('department', currentUserDept); else query = query.eq('from_dept', currentUserDept);
        } else { query = query.eq('status', 'pending_manager'); }
    } else {
        if (currentUserRole === 'head') {
            query = query.neq('status', 'pending_head');
            if(currentDocType === 'pr') query = query.eq('department', currentUserDept); else query = query.eq('from_dept', currentUserDept);
        } else { query = query.in('status', ['processed', 'rejected']); }
    }
    const { data } = await query;
    allDocs = data || [];
    tableBody.innerHTML = '';
    if (allDocs.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบรายการ</td></tr>`; return; }
    
    allDocs.forEach(doc => {
        const docNo = currentDocType === 'pr' ? doc.pr_number : doc.memo_no;
        const from = currentDocType === 'pr' ? `${doc.requester} (${doc.department})` : `${doc.from_dept} : ${doc.subject}`;
        let statusText = doc.status;
        if(statusText === 'pending_head') statusText = 'รอผู้อนุมัติเบื้องต้น';
        else if(statusText === 'pending_manager') statusText = 'รอผู้บริหาร';
        else if(statusText === 'processed') statusText = 'อนุมัติแล้ว';
        else if(statusText === 'rejected') statusText = 'ไม่อนุมัติ/ตีกลับ';
        
        let badgeClass = 'bg-secondary';
        if (doc.status === 'pending_head') badgeClass = 'bg-warning text-dark';
        if (doc.status === 'pending_manager') badgeClass = 'bg-info text-dark';
        if (doc.status === 'processed') badgeClass = 'bg-success';
        if (doc.status === 'rejected') badgeClass = 'bg-danger';

        tableBody.innerHTML += `<tr><td class="ps-4 fw-bold text-primary">${docNo}</td><td>${new Date(doc.created_at).toLocaleDateString('th-TH')}</td><td>${from}</td><td><span class="badge ${badgeClass}">${statusText}</span></td><td class="text-center"><button onclick="openDetailModal('${doc.id}')" class="btn btn-outline-primary btn-sm rounded-pill px-3">ตรวจสอบ</button></td></tr>`;
    });
}

async function updateBadges() { /* ... (Logic Badge) ... */ }

window.openDetailModal = function(id) {
    currentDoc = allDocs.find(d => String(d.id) === String(id));
    if (!currentDoc) return;
    
    if (currentDocType === 'pr') {
        document.getElementById('doc_type_title').innerText = "ใบขอซื้อ (Purchase Request)";
        document.getElementById('pr_form_layout').style.display = 'block';
        document.getElementById('memo_form_layout').style.display = 'none';
        document.getElementById('pr_no').innerText = currentDoc.pr_number;
        document.getElementById('pr_req_date').innerText = new Date(currentDoc.required_date).toLocaleDateString('th-TH');
        document.getElementById('pr_requester').innerText = currentDoc.requester;
        document.getElementById('pr_dept').innerText = currentDoc.department;
        document.getElementById('pr_remark').innerText = currentDoc.header_remark || '-';
        document.getElementById('sign_requester_name').innerText = currentDoc.requester;

        // [สร้างตารางสินค้า พร้อมช่องเหตุผล]
        const tbody = document.getElementById('pr_items_body');
        tbody.innerHTML = '';
        currentDoc.items.forEach((item, index) => {
            let actionHtml = '';
            if (currentMode === 'history') {
                actionHtml = item.status === 'approved' ? '<span class="text-success">✅ อนุมัติ</span>' : `<span class="text-danger">❌ ไม่อนุมัติ</span>`;
            } else {
                actionHtml = `
                    <div class="form-check form-switch d-inline-block">
                        <input class="form-check-input item-check" type="checkbox" checked onchange="toggleReason(${index})" data-index="${index}">
                        <label class="form-check-label text-success fw-bold" id="label-${index}">อนุมัติ</label>
                    </div>
                `;
            }
            let reasonHtml = '';
            if (currentMode === 'history') {
                reasonHtml = item.remark ? `<span class="text-danger small">${item.remark}</span>` : '-';
            } else {
                reasonHtml = `<input type="text" id="reason-${index}" class="form-control form-control-sm" placeholder="ระบุเหตุผล..." style="display:none;">`;
            }
            tbody.innerHTML += `<tr><td class="text-center">${item.code||'-'}</td><td>${item.description}</td><td class="text-center">${item.quantity}</td><td class="text-center">${item.unit}</td><td class="text-center">${actionHtml}</td><td>${reasonHtml}</td></tr>`;
        });

    } else {
        document.getElementById('doc_type_title').innerText = "บันทึกข้อความ (Memo)";
        document.getElementById('pr_form_layout').style.display = 'none';
        document.getElementById('memo_form_layout').style.display = 'block';
        document.getElementById('memo_from').innerText = currentDoc.from_dept;
        document.getElementById('memo_no').innerText = currentDoc.memo_no;
        document.getElementById('memo_date').innerText = new Date(currentDoc.date).toLocaleDateString('th-TH');
        document.getElementById('memo_subject').innerText = currentDoc.subject;
        document.getElementById('memo_to').innerText = currentDoc.to_dept;
        document.getElementById('memo_content').innerText = currentDoc.content;
        document.getElementById('sign_requester_name').innerText = "เจ้าหน้าที่แผนก" + currentDoc.from_dept;
    }
    
    // ลายเซ็น
    const signHead = document.getElementById('sign_head_status');
    const signManager = document.getElementById('sign_manager_status');
    if(signHead) signHead.innerHTML = (currentDoc.status === 'pending_manager' || currentDoc.status === 'processed') ? 'อนุมัติแล้ว' : (currentDoc.status === 'rejected' ? '<span class="text-danger">ไม่อนุมัติ</span>' : '<span class="text-muted">...</span>');
    if(signManager) signManager.innerHTML = (currentDoc.status === 'processed') ? 'อนุมัติแล้ว' : (currentDoc.status === 'rejected' ? '<span class="text-danger">ไม่อนุมัติ</span>' : '<span class="text-muted">...</span>');

    const attArea = document.getElementById('attachment_area');
    if (currentDoc.attachment_url) { attArea.style.display = 'block'; document.getElementById('attachment_link').href = currentDoc.attachment_url; } else { attArea.style.display = 'none'; }
    
    const footerButtons = document.querySelector('.modal-footer');
    if (currentMode === 'history') footerButtons.style.display = 'none'; else footerButtons.style.display = 'flex';
    
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

window.toggleReason = function(index) {
    const checkbox = document.querySelector(`.item-check[data-index="${index}"]`);
    const reasonInput = document.getElementById(`reason-${index}`);
    const label = document.getElementById(`label-${index}`);
    if (checkbox.checked) {
        reasonInput.style.display = 'none'; reasonInput.value = '';
        label.innerText = 'อนุมัติ'; label.className = 'form-check-label text-success fw-bold';
    } else {
        reasonInput.style.display = 'block'; reasonInput.focus();
        label.innerText = 'ไม่อนุมัติ'; label.className = 'form-check-label text-danger fw-bold';
    }
}

window.finalizeApproval = async function() {
    const btn = document.querySelector('.btn-success'); btn.disabled = true; btn.innerText = '⏳ กำลังประมวลผล...';
    try {
        let nextStatus = (currentUserRole === 'head') ? 'pending_manager' : 'processed';
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        
        if (currentDocType === 'pr') {
            const checkboxes = document.querySelectorAll('.item-check');
            checkboxes.forEach(cb => {
                const idx = cb.getAttribute('data-index');
                currentDoc.items[idx].status = cb.checked ? 'approved' : 'rejected';
                currentDoc.items[idx].remark = cb.checked ? '' : document.getElementById(`reason-${idx}`).value;
            });
            await db.from(tableName).update({ status: nextStatus, items: currentDoc.items }).eq('id', currentDoc.id);
        } else {
            await db.from(tableName).update({ status: nextStatus }).eq('id', currentDoc.id);
        }

        const docNo = currentDocType === 'pr' ? currentDoc.pr_number : currentDoc.memo_no;
        const adminLink = window.location.origin + '/admin.html';
        
        if (currentUserRole === 'head') {
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.managerEmail, subject: `[Step 2] รออนุมัติ: ${docNo}`, html_content: `<h3>เรียน ผู้ช่วยกรรมการ</h3><p>รายการ ${docNo} ผ่านการตรวจสอบแล้ว</p><a href="${adminLink}">เข้าสู่ระบบ</a>` });
        } else {
            if (currentDocType === 'pr' && CONFIG.purchasingEmail) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.purchasingEmail, subject: `[Approved] สั่งซื้อ PR ${docNo}`, html_content: `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>PR ${docNo} อนุมัติแล้ว ดำเนินการได้เลย</p>` });
            }
        }
        alert('✅ บันทึกผลการพิจารณาเรียบร้อย!'); bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide(); loadData();
    } catch (err) { console.error(err); alert('Error: ' + err.message); } finally { btn.disabled = false; }
}

window.rejectDocument = async function() {
    const comment = document.getElementById('approval_comment').value.trim();
    if (!comment) { alert("⚠️ กรุณาระบุเหตุผลที่ตีกลับเอกสารด้วยครับ"); return; }
    const btn = document.querySelector('.btn-outline-danger'); btn.disabled = true; btn.innerText = '⏳ กำลังบันทึก...';

    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let updatePayload = { status: 'rejected' };
        if(currentDocType === 'pr') {
            currentDoc.items.forEach(item => { item.status = 'rejected'; item.remark = 'ตีกลับทั้งใบ: ' + comment; });
            updatePayload.items = currentDoc.items;
        }
        await db.from(tableName).update(updatePayload).eq('id', currentDoc.id);
        
        const headEmail = CONFIG.departmentHeads[currentDoc.from_dept || currentDoc.department];
        if (headEmail) {
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: headEmail, subject: `[Rejected] แจ้งผลไม่อนุมัติ`, html_content: `<h3 style="color:red;">รายการไม่ได้รับการอนุมัติ</h3><p><b>เหตุผล:</b> ${comment}</p>` });
        }
        alert('❌ ตีกลับเอกสารเรียบร้อย'); bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide(); loadData();
    } catch(err) { alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerText = 'ตีกลับเอกสาร'; }
}

async function loadPRForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    const { data: pr } = await db.from('purchase_requests').select('*').eq('id', id).single();
    document.getElementById('v_pr_number').innerText = pr.pr_number;
    document.getElementById('v_created_at').innerText = new Date(pr.created_at).toLocaleDateString('th-TH');
    document.getElementById('v_requester').innerText = pr.requester;
    document.getElementById('v_department').innerText = pr.department;
    document.getElementById('v_doc_status').innerText = pr.status === 'processed' ? 'อนุมัติเรียบร้อย' : 'รออนุมัติ';
    document.getElementById('v_remark').innerText = pr.header_remark || '-';
    document.getElementById('v_sign_requester').innerText = `${pr.requester}`;
    document.getElementById('v_required_date').innerText = new Date(pr.required_date).toLocaleDateString('th-TH');
    if (pr.status === 'pending_manager' || pr.status === 'processed') { document.getElementById('v_sign_head').innerHTML = `( ผู้อนุมัติเบื้องต้น ${pr.department} )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>`; }
    if (pr.status === 'processed') { document.getElementById('v_sign_manager').innerHTML = '( เบญจมาศ ถิ่นจันทร์ )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>'; }
    
    const tbody = document.getElementById('v_tableBody'); tbody.innerHTML = '';
    pr.items.forEach((item, index) => {
        let statusText = item.status === 'approved' ? '<span class="fw-bold">✅ อนุมัติ</span>' : (item.status === 'rejected' ? `<span style="text-decoration:line-through;">❌ ${item.remark || 'ไม่อนุมัติ'}</span>` : '⏳ รอ');
        tbody.innerHTML += `<tr><td class="text-center">${index + 1}</td><td>${item.code || '-'}</td><td>${item.description}</td><td class="text-center">${item.quantity}</td><td class="text-center">${item.unit}</td><td class="text-center">${statusText}</td></tr>`;
    });
}

async function loadMemoForPrint() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    const { data: m, error } = await db.from('memos').select('*').eq('id', id).single();
    document.getElementById('v_memo_no').innerText = m.memo_no;
    document.getElementById('v_date').innerText = new Date(m.date).toLocaleDateString('th-TH');
    document.getElementById('v_from').innerText = m.from_dept;
    document.getElementById('v_to').innerText = m.to_dept;
    document.getElementById('v_subject').innerText = m.subject;
    document.getElementById('v_content').innerText = m.content;
    if (m.attachment_url) { document.getElementById('v_attachment_area').style.display = 'block'; document.getElementById('v_attachment_link').href = m.attachment_url; }

    document.getElementById('v_sign_requester').innerText = "เจ้าหน้าที่แผนก" + m.from_dept;
    if (m.status === 'pending_manager' || m.status === 'processed') { document.getElementById('v_sign_head').innerHTML = `( ผู้อนุมัติเบื้องต้น ${m.from_dept} )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>`; }
    if (m.status === 'processed') { document.getElementById('v_sign_manager').innerHTML = '( เบญจมาศ ถิ่นจันทร์ )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>'; }
}

if(document.getElementById('v_tableBody')) window.onload = loadPRForPrint;
if(document.getElementById('v_content')) window.onload = loadMemoForPrint;

document.addEventListener('keydown', function(event) { if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); return false; } });
