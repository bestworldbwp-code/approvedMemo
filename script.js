// ================= 1. CONFIG =================
const CONFIG = {
    // Supabase
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    
    // EmailJS
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 

    // ------------------------------------------------------------------
    // [สำคัญ] ใส่ลิงก์เว็บของคุณ (ถ้าคุณอัปโหลดแล้ว)
    // ถ้าเทสในเครื่อง ก็ปล่อยไว้ได้
    // ------------------------------------------------------------------
    siteUrl: '', 

    // [1] อีเมลหัวหน้าแผนก
    // ** เนื่องจากคุณแจ้งแค่ jakkidmarat@gmail.com ผมเลยใส่ให้เหมือนกันหมดก่อน **
    // ** ถ้ามีหัวหน้าคนอื่นจริง ให้มาแก้ตรงนี้ได้เลยครับ **
    departmentHeads: {
        'จัดซื้อ': 'jakkidmarat@gmail.com',      
        'บัญชี': 'jakkidmarat@gmail.com',  
        'ฝ่ายผลิต': 'jakkidmarat@gmail.com',    
        'คลังสินค้า': 'jakkidmarat@gmail.com',   
        'ขาย/การตลาด': 'jakkidmarat@gmail.com'       
    },

    // [2] ผู้ช่วย กก.
    managerEmail: 'bestworld.bwp328@gmail.com', 

    // [3] จัดซื้อ
    purchasingEmail: 'hr.bpp.2564@gmail.com',

    passwords: {
        '1001': 'จัดซื้อ',        
        '1002': 'บัญชี',          
        '1003': 'ฝ่ายผลิต',        
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

document.addEventListener("DOMContentLoaded", function() {
    // 1. โหลด Logo (แบบปลอดภัย)
    if (typeof LOGO_BASE64 !== 'undefined' && LOGO_BASE64) {
        document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64);
    }

    // 2. เช็ค Login หน้า Admin
    if (window.location.href.includes('admin.html')) {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            if (currentUserRole && sessionStorage.getItem('isAdmin') === 'true') {
                overlay.style.display = 'none';
                updateAdminUI();
                loadPRs(); 
            } else {
                overlay.style.display = 'flex';
            }
        }
    }
});

// ================= MEMO LOGIC (พร้อมลิงก์ดูเอกสาร) =================
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
                const fileExt = file.name.split('.').pop();
                const fileName = `memo_${Date.now()}.${fileExt}`;
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
                status: 'pending'
            };

            const { data, error } = await db.from('memos').insert([payload]).select();
            if (error) throw error;

            // สร้างลิงก์
            const baseUrl = CONFIG.siteUrl && CONFIG.siteUrl.startsWith('http') ? CONFIG.siteUrl : window.location.origin;
            const memoId = data[0].id;
            const viewLink = `${baseUrl}/view_memo.html?id=${memoId}`;

            btn.innerText = '⏳ ส่งอีเมล...';
            const headEmail = CONFIG.departmentHeads[payload.from_dept];
            
            let fileHtml = '';
            if (publicUrl) fileHtml = `<p>📎 <b>ไฟล์แนบ:</b> <a href="${publicUrl}">คลิกเพื่อดู</a></p>`;

            if (headEmail) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: headEmail, 
                    subject: `[New Memo] เอกสารบันทึกข้อความ ${payload.memo_no}`, 
                    html_content: `
                        <h3>เรียน หัวหน้าแผนก${payload.from_dept},</h3>
                        <p>มีการสร้างบันทึกข้อความ (Memo) ใหม่</p>
                        <div style="background:#f8f9fa;padding:15px;border-left:4px solid #28a745;margin:10px 0;">
                            <p style="margin:5px 0"><b>เลขที่:</b> ${payload.memo_no}</p>
                            <p style="margin:5px 0"><b>เรื่อง:</b> ${payload.subject}</p>
                        </div>
                        <p>กดปุ่มด้านล่างเพื่อเปิดดูเอกสาร:</p>
                        <br>
                        <a href="${viewLink}" style="background-color:#28a745;color:white;padding:12px 20px;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px;display:inline-block;">
                            📄 เปิดดูบันทึกข้อความ
                        </a>
                        <br><br>
                        ${fileHtml}
                    ` 
                });
            }

            alert('✅ บันทึกสำเร็จ! ไปหน้าพิมพ์เอกสาร...');
            window.location.href = `view_memo.html?id=${memoId}`;

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// ================= PR LOGIC =================
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
        updateAdminUI(); loadPRs();
    } else { alert("❌ รหัสผ่านไม่ถูกต้อง!"); }
}

function updateAdminUI() {
    const title = document.querySelector('h3');
    if (title) {
        if (currentUserRole === 'head') title.innerText = `👑 ตรวจสอบรายการ (แผนก${currentUserDept})`;
        else if (currentUserRole === 'manager') title.innerText = '👑 รายการรออนุมัติ (คุณเบญจมาศ)';
    }
}

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

let allPRs = []; let currentPR = {}; let currentMode = 'pending'; 
window.switchTab = function(mode) {
    currentMode = mode;
    if (mode === 'pending') { document.getElementById('btnPending').className = 'btn btn-primary active btn-sm'; document.getElementById('btnHistory').className = 'btn btn-outline-secondary btn-sm'; } 
    else { document.getElementById('btnHistory').className = 'btn btn-secondary active btn-sm'; document.getElementById('btnPending').className = 'btn btn-outline-primary btn-sm'; }
    loadPRs();
}
async function loadPRs() {
    const tableBody = document.getElementById('prTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">⏳ กำลังโหลด...</td></tr>';
    try {
        let query = db.from('purchase_requests').select('*').order('created_at', { ascending: false });
        if (currentMode === 'pending') {
            if (!currentUserRole) { tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">กรุณาเข้าสู่ระบบใหม่</td></tr>'; return; }
            if (currentUserRole === 'head') query = query.eq('status', 'pending_head').eq('department', currentUserDept);
            else if (currentUserRole === 'manager') query = query.eq('status', 'pending_manager');
        } else {
            if (currentUserRole === 'head') query = query.neq('status', 'pending_head').eq('department', currentUserDept);
            else query = query.in('status', ['processed', 'approved', 'rejected']);
        }
        const { data, error } = await query;
        if (error) throw error;
        allPRs = data;
        tableBody.innerHTML = '';
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted">ไม่พบรายการสำหรับแผนกนี้</td></tr>`; return; }
        data.forEach(pr => {
            const createdDate = new Date(pr.created_at).toLocaleDateString('th-TH');
            let attachBtn = pr.attachment_url ? `<a href="${pr.attachment_url}" target="_blank" class="btn btn-sm btn-outline-secondary">📎</a>` : '-';
            let actionBtn = currentMode === 'pending' ? `<button onclick="openDetailModal('${pr.id}')" class="btn btn-primary btn-sm rounded-pill px-3">🔍 ตรวจสอบ</button>` : `<button onclick="openDetailModal('${pr.id}')" class="btn btn-outline-info btn-sm rounded-pill px-3">📄 ดู</button>`;
            let statusText = pr.status;
            if (pr.status === 'pending_head') statusText = `รอหัวหน้า (${pr.department})`;
            if (pr.status === 'pending_manager') statusText = 'รอ ผช.กก.';
            if (pr.status === 'processed') statusText = 'อนุมัติเรียบร้อย';
            const row = `<tr><td><span class="fw-bold text-primary">${pr.pr_number}</span></td><td>${createdDate}</td><td><div class="fw-bold">${pr.requester}</div><small class="text-muted">${pr.department}</small></td><td><span class="badge bg-secondary">${statusText}</span></td><td class="text-center">${attachBtn}</td><td class="text-center">${actionBtn}</td></tr>`;
            tableBody.innerHTML += row;
        });
    } catch (err) { console.error(err); tableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Error: ${err.message}</td></tr>`; }
}
window.openDetailModal = function(id) {
    currentPR = allPRs.find(p => String(p.id) === String(id));
    if (!currentPR) return;
    document.getElementById('m_pr_number').innerText = currentPR.pr_number;
    document.getElementById('m_required_date').innerText = new Date(currentPR.required_date).toLocaleDateString('th-TH');
    document.getElementById('m_requester').innerText = currentPR.requester;
    document.getElementById('m_department').innerText = currentPR.department;
    document.getElementById('m_remark').innerText = currentPR.header_remark || '-';
    document.getElementById('m_attachment').innerHTML = currentPR.attachment_url ? `<a href="${currentPR.attachment_url}" target="_blank" class="btn btn-sm btn-outline-primary">📎 ดูไฟล์</a>` : '-';
    renderItemsTable();
    const saveBtn = document.querySelector('.modal-footer .btn-success');
    if (currentMode === 'history') { saveBtn.style.display = 'none'; } 
    else { saveBtn.style.display = 'block'; saveBtn.disabled = false; saveBtn.innerText = (currentUserRole === 'head') ? 'ส่งต่อให้ผู้ช่วย กก. ➡️' : '✅ อนุมัติและส่งเมล'; }
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
    if (currentPR.items) {
        currentPR.items.forEach((item, index) => {
            if (currentUserRole === 'manager' && item.status === 'rejected') return;
            const isChecked = (item.status === 'approved' || item.status === 'pending');
            const reasonStyle = isChecked ? 'display:none;' : 'display:block;';
            const statusStyle = isChecked ? 'display:inline;' : 'display:none;';
            const reasonVal = item.remark || '';
            const rowClass = isChecked ? '' : 'table-danger';
            htmlRows += `<tr id="tr-item-${index}" class="${rowClass}"><td class="text-center"><input type="checkbox" class="form-check-input item-checkbox" data-index="${index}" onchange="toggleItem(this, ${index})" ${isChecked ? 'checked' : ''}></td><td>${item.code || '-'}</td><td>${item.description}</td><td class="text-center">${item.quantity} ${item.unit || ''}</td><td class="text-center">${item.unit}</td><td><input type="text" class="form-control form-control-sm item-reason" id="reason-${index}" placeholder="เหตุผล..." value="${reasonVal}" style="${reasonStyle}"><span id="status-text-${index}" class="text-success small fw-bold" style="${statusStyle}">✅ อนุมัติ</span></td></tr>`;
        });
    }
    if (htmlRows === '') htmlRows = '<tr><td colspan="6" class="text-center p-3 text-muted">ไม่พบรายการที่ต้องอนุมัติ</td></tr>';
    itemsTable.innerHTML = htmlRows;
    if(currentMode === 'history') { itemsTable.querySelectorAll('input, select').forEach(el => el.disabled = true); if(document.getElementById('selectAll')) document.getElementById('selectAll').disabled = true; }
}
window.toggleSelectAll = function(source) { document.querySelectorAll('.item-checkbox').forEach(cb => { cb.checked = source.checked; toggleItem(cb, cb.dataset.index); }); }
window.toggleItem = function(checkbox, index) { const reasonInput = document.getElementById(`reason-${index}`); const statusText = document.getElementById(`status-text-${index}`); const row = document.getElementById(`tr-item-${index}`); if (checkbox.checked) { reasonInput.style.display = 'none'; statusText.style.display = 'inline'; row.classList.remove('table-danger'); } else { reasonInput.style.display = 'block'; reasonInput.focus(); statusText.style.display = 'none'; row.classList.add('table-danger'); } }

window.finalizeApproval = async function() {
    const checkboxes = document.querySelectorAll('.item-checkbox');
    let hasRejectedWithoutReason = false;
    checkboxes.forEach(cb => {
        const idx = cb.dataset.index;
        const reasonInput = document.getElementById(`reason-${idx}`);
        if (cb.checked) { currentPR.items[idx].status = 'approved'; currentPR.items[idx].remark = ''; } 
        else { currentPR.items[idx].status = 'rejected'; currentPR.items[idx].remark = reasonInput.value.trim(); if (!currentPR.items[idx].remark) { hasRejectedWithoutReason = true; reasonInput.classList.add('is-invalid'); } }
    });
    if (hasRejectedWithoutReason) { alert('กรุณาระบุเหตุผลรายการที่ไม่อนุมัติ'); return; }
    if (!confirm("ยืนยันผลการพิจารณา?")) return;
    const btn = document.querySelector('.modal-footer .btn-success');
    if(btn) { btn.disabled = true; btn.innerText = '⏳ กำลังประมวลผล...'; }
    try {
        let nextStatus = '';
        const adminLink = window.location.origin + '/admin.html';
        if (currentUserRole === 'head') {
            nextStatus = 'pending_manager'; 
            await db.from('purchase_requests').update({ status: nextStatus, items: currentPR.items }).eq('id', currentPR.id);
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.managerEmail, subject: `[Step 2] หัวหน้า${currentPR.department}ตรวจสอบแล้ว รออนุมัติ PR ${currentPR.pr_number}`, html_content: `<h3>เรียน ผู้ช่วยกรรมการผู้จัดการ (คุณเบญจมาศ),</h3><p>หัวหน้าแผนก (${currentPR.department}) ได้ตรวจสอบ PR เลขที่ <b>${currentPR.pr_number}</b> เรียบร้อยแล้ว</p><p>กรุณาพิจารณาอนุมัติขั้นตอนสุดท้าย: <a href="${adminLink}">คลิกที่นี่</a></p>` });
            alert('✅ บันทึกผลแล้ว ส่งต่อให้คุณเบญจมาศเรียบร้อย!');
        } 
        else if (currentUserRole === 'manager') {
            nextStatus = 'processed'; 
            await db.from('purchase_requests').update({ status: nextStatus, items: currentPR.items }).eq('id', currentPR.id);
            const printLink = window.location.origin + `/view_pr.html?id=${currentPR.id}`;
            const printApprovedLink = printLink + "&filter=approved";
            let fullTable = `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;"><tr style="background:#f8f9fa;"><th>รายการ</th><th>จำนวน</th><th>ผล</th></tr>`;
            let approvedTable = `<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;"><tr style="background:#d1fae5;"><th>รหัส</th><th>รายการ</th><th>จำนวน</th></tr>`;
            let hasApprovedItems = false;
            currentPR.items.forEach(i => {
                const color = i.status === 'approved' ? 'green' : 'red';
                const txt = i.status === 'approved' ? '✅' : `❌ (${i.remark})`;
                fullTable += `<tr><td style="border:1px solid #ddd;padding:5px;">${i.description}</td><td style="border:1px solid #ddd;padding:5px;">${i.quantity}</td><td style="border:1px solid #ddd;padding:5px;color:${color}">${txt}</td></tr>`;
                if (i.status === 'approved') { hasApprovedItems = true; approvedTable += `<tr><td style="border:1px solid #ddd;padding:5px;">${i.code||'-'}</td><td style="border:1px solid #ddd;padding:5px;">${i.description}</td><td style="border:1px solid #ddd;padding:5px;">${i.quantity}</td></tr>`; }
            });
            fullTable += `</table>`; approvedTable += `</table>`;
            if (currentPR.email) { await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: currentPR.email, subject: `[Final Result] ผลการอนุมัติ PR ${currentPR.pr_number}`, html_content: `<h3>เรียนคุณ ${currentPR.requester}</h3><p>ใบขอซื้อเลขที่ <b>${currentPR.pr_number}</b> ได้รับการอนุมัติโดย คุณเบญจมาศ ถิ่นจันทร์ แล้ว</p>${fullTable}<br><a href="${printLink}">ดูรายละเอียด</a>` }); }
            if (hasApprovedItems && CONFIG.purchasingEmail) { await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: CONFIG.purchasingEmail, subject: `[Approved] สั่งซื้อสินค้า PR ${currentPR.pr_number}`, html_content: `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>รายการ PR ${currentPR.pr_number} อนุมัติโดย คุณเบญจมาศ แล้ว</p><hr><p><b>1. รายการที่อนุมัติ (สำหรับสั่งซื้อ):</b></p>${approvedTable}<br><a href="${printApprovedLink}" style="background:green;color:white;padding:10px;text-decoration:none;border-radius:5px;">🛒 พิมพ์ใบสั่งซื้อ (เฉพาะอนุมัติ)</a><br><br><p><b>2. รายการทั้งหมด (รวมไม่อนุมัติ):</b></p><a href="${printLink}" style="background:gray;color:white;padding:10px;text-decoration:none;border-radius:5px;">📄 ดูประวัติทั้งหมด</a>` }); }
            alert('✅ อนุมัติจบงานและส่งเรื่องให้จัดซื้อเรียบร้อย!');
        }
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadPRs();
    } catch (err) { console.error(err); alert('Error: ' + err.message); if(btn) btn.disabled = false; }
}

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
