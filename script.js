// ================= 1. CONFIG =================
const CONFIG = {
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 
    siteUrl: '', 

    departmentHeads: {
        'จัดซื้อ': 'jakkidmarat@gmail.com', 'บัญชี': 'jakkidmarat@gmail.com',
        'ฝ่ายผลิต(เป่า)': 'jakkidmarat@gmail.com', 'ฝ่ายผลิต(พิมพ์)': 'jakkidmarat@gmail.com',
        'ซ่อมบำรุง': 'jakkidmarat@gmail.com', 'คลังสินค้า': 'jakkidmarat@gmail.com',
        'ขาย/การตลาด': 'jakkidmarat@gmail.com'
    },
    managerEmail: 'bestworld.bwp328@gmail.com', 
    purchasingEmail: 'hr.bpp.2564@gmail.com',

    passwords: {
        '1001': 'จัดซื้อ', '1002': 'บัญชี', '1003': 'ฝ่ายผลิต(เป่า)', '1006': 'ฝ่ายผลิต(พิมพ์)', 
        '1007': 'ซ่อมบำรุง', '1004': 'คลังสินค้า', '1005': 'ขาย/การตลาด', '9999': 'MANAGER_ROLE' 
    }
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
    if (typeof LOGO_BASE64 !== 'undefined') document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64);
    if (window.location.href.includes('admin.html')) {
        const overlay = document.getElementById('loginOverlay');
        if (overlay) {
            if (currentUserRole && sessionStorage.getItem('isAdmin') === 'true') {
                overlay.style.display = 'none';
                updateAdminUI(); loadData(); 
            } else { overlay.style.display = 'flex'; }
        }
    }
});

// ================= MEMO FORM =================
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
                memo_no: document.getElementById('m_no').value, date: document.getElementById('m_date').value,
                from_dept: document.getElementById('m_from').value, to_dept: document.getElementById('m_to').value,
                subject: document.getElementById('m_subject').value, content: document.getElementById('m_content').value,
                attachment_url: publicUrl, status: 'pending_head' 
            };
            const { error } = await db.from('memos').insert([payload]);
            if (error) throw error;
            btn.innerText = '⏳ ส่งเมลหาหัวหน้า...';
            const headEmail = CONFIG.departmentHeads[payload.from_dept];
            if (headEmail) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { to_email: headEmail, subject: `[New Memo] ขออนุมัติ Memo: ${payload.memo_no}`, html_content: `<h3>เรียน หัวหน้าแผนก${payload.from_dept}</h3><p>มี Memo ใหม่รออนุมัติ</p><p>เลขที่: ${payload.memo_no}</p><p>เรื่อง: ${payload.subject}</p><br><a href="${window.location.origin}/admin.html">เข้าสู่ระบบ</a>` });
            }
            alert('✅ ส่ง Memo ให้หัวหน้าตรวจสอบเรียบร้อย!'); window.location.reload();
        } catch (err) { alert('Error: ' + err.message); } finally { btn.disabled = false; btn.innerText = originalText; }
    });
}

// ================= ADMIN LOGIC =================
window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput').value;
    const matchedDept = CONFIG.passwords[input];
    if (matchedDept) {
        sessionStorage.setItem('isAdmin', 'true');
        if (matchedDept === 'MANAGER_ROLE') { currentUserRole = 'manager'; currentUserDept = 'ALL'; } 
        else { currentUserRole = 'head'; currentUserDept = matchedDept; }
        sessionStorage.setItem('userRole', currentUserRole); sessionStorage.setItem('userDept', currentUserDept);
        document.getElementById('loginOverlay').style.display = 'none';
        updateAdminUI(); loadData();
    } else { alert("❌ รหัสผ่านไม่ถูกต้อง!"); }
}

function updateAdminUI() {
    const title = document.querySelector('#pageTitle');
    if (title) title.innerText = `👑 ตรวจสอบรายการ ${currentUserRole === 'head' ? `(หัวหน้า ${currentUserDept})` : `(ผู้ช่วย กก.)`}`;
}

window.switchDocType = function(type) {
    currentDocType = type;
    const btnPR = document.getElementById('btnTypePR');
    const btnMemo = document.getElementById('btnTypeMemo');
    if (type === 'pr') { btnPR.className = 'btn btn-primary position-relative'; btnMemo.className = 'btn btn-outline-primary position-relative'; } 
    else { btnPR.className = 'btn btn-outline-primary position-relative'; btnMemo.className = 'btn btn-success position-relative'; }
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
    
    // 1. อัปเดตตัวเลขแจ้งเตือน (Badges) ก่อนเลย
    updateBadges();

    // 2. โหลดข้อมูลตาม Type
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
        
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบรายการ (${currentDocType.toUpperCase()})</td></tr>`; return; }

        data.forEach(doc => {
            const date = new Date(doc.created_at || doc.date).toLocaleDateString('th-TH');
            let docNo = currentDocType === 'pr' ? doc.pr_number : doc.memo_no;
            let from = currentDocType === 'pr' ? `${doc.requester} (${doc.department})` : `${doc.from_dept} : ${doc.subject}`;
            let statusText = doc.status === 'pending_head' ? 'รอหัวหน้าแผนก' : (doc.status === 'pending_manager' ? 'รอผู้ช่วย กก.' : 'อนุมัติเรียบร้อย');
            
            tableBody.innerHTML += `<tr><td><span class="fw-bold text-primary">${docNo}</span></td><td>${date}</td><td><div class="small">${from}</div></td><td><span class="badge bg-secondary">${statusText}</span></td><td class="text-center"><button onclick="openDetailModal('${doc.id}')" class="btn btn-outline-info btn-sm rounded-pill px-3">ตรวจสอบ</button></td></tr>`;
        });
    } catch (err) { console.error(err); tableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${err.message}</td></tr>`; }
}

// ฟังก์ชันนับจำนวนแจ้งเตือน (ใหม่)
async function updateBadges() {
    const badgePR = document.getElementById('badgePR');
    const badgeMemo = document.getElementById('badgeMemo');
    
    // ฟังก์ชันย่อยสำหรับดึงจำนวน
    const getCount = async (table) => {
        let q = db.from(table).select('id', { count: 'exact', head: true });
        if (currentUserRole === 'head') {
            q = q.eq('status', 'pending_head');
            if(table === 'purchase_requests') q = q.eq('department', currentUserDept);
            else q = q.eq('from_dept', currentUserDept);
        } else {
            q = q.eq('status', 'pending_manager');
        }
        const { count } = await q;
        return count || 0;
    };

    const countPR = await getCount('purchase_requests');
    const countMemo = await getCount('memos');

    if(countPR > 0) { badgePR.innerText = countPR; badgePR.style.display = 'inline-block'; } else { badgePR.style.display = 'none'; }
    if(countMemo > 0) { badgeMemo.innerText = countMemo; badgeMemo.style.display = 'inline-block'; } else { badgeMemo.style.display = 'none'; }
}

window.openDetailModal = function(id) {
    currentDoc = allDocs.find(d => String(d.id) === String(id));
    if (!currentDoc) return;

    // แสดงผลแบบ Form
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

        // Render PR Table inside Modal
        const tbody = document.getElementById('pr_items_body');
        tbody.innerHTML = '';
        currentDoc.items.forEach((item, index) => {
            // Logic ซ่อนรายการที่ Manager ไม่ต้องเห็น (ถ้าถูก Reject มาก่อน) อาจจะใส่ตรงนี้ได้
            let approvalHtml = '';
            if (currentMode === 'history') {
                approvalHtml = item.status === 'approved' ? '<span class="text-success">✅ อนุมัติ</span>' : '<span class="text-danger">❌ ไม่</span>';
            } else {
                approvalHtml = `<input type="checkbox" class="form-check-input item-checkbox" data-index="${index}" checked> อนุมัติ`;
            }
            tbody.innerHTML += `<tr><td>${item.code||'-'}</td><td>${item.description}</td><td>${item.quantity}</td><td>${item.unit}</td><td class="text-center">${approvalHtml}</td></tr>`;
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

    // Attachment
    const attArea = document.getElementById('attachment_area');
    if (currentDoc.attachment_url) {
        attArea.style.display = 'block';
        document.getElementById('attachment_link').href = currentDoc.attachment_url;
    } else {
        attArea.style.display = 'none';
    }

    // Button Logic
    const saveBtn = document.querySelector('.modal-footer .btn-success');
    if (currentMode === 'history') {
        saveBtn.style.display = 'none';
    } else {
        saveBtn.style.display = 'block';
        saveBtn.innerText = (currentUserRole === 'head') ? '✅ ตรวจสอบแล้ว ➡️ ส่งต่อผู้ช่วย กก.' : '✅ อนุมัติเอกสาร';
    }
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

window.finalizeApproval = async function() {
    const btn = document.querySelector('.modal-footer .btn-success');
    btn.disabled = true; btn.innerText = '⏳ กำลังประมวลผล...';

    try {
        let nextStatus = (currentUserRole === 'head') ? 'pending_manager' : 'processed';
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        
        // Update DB
        if (currentDocType === 'pr') {
            document.querySelectorAll('.item-checkbox').forEach(cb => {
                const idx = cb.dataset.index;
                currentDoc.items[idx].status = cb.checked ? 'approved' : 'rejected';
            });
            await db.from(tableName).update({ status: nextStatus, items: currentDoc.items }).eq('id', currentDoc.id);
        } else {
            await db.from(tableName).update({ status: nextStatus }).eq('id', currentDoc.id);
        }

        // Send Email
        const adminLink = window.location.origin + '/admin.html';
        const docNo = currentDocType === 'pr' ? currentDoc.pr_number : currentDoc.memo_no;

        if (currentUserRole === 'head') {
            // Head -> Manager
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                to_email: CONFIG.managerEmail, 
                subject: `[Step 2] รออนุมัติ: ${currentDocType.toUpperCase()} ${docNo}`, 
                html_content: `<h3>เรียน ผู้ช่วยกรรมการ</h3><p>รายการ ${docNo} ผ่านการตรวจสอบจากหัวหน้าแผนกแล้ว</p><a href="${adminLink}">เข้าสู่ระบบเพื่ออนุมัติ</a>` 
            });
        } else {
            // Manager -> Final
            if (currentDocType === 'pr' && CONFIG.purchasingEmail) {
                // PR -> Purchasing
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: CONFIG.purchasingEmail, 
                    subject: `[Approved] สั่งซื้อสินค้า PR ${docNo}`, 
                    html_content: `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>PR ${docNo} อนุมัติแล้ว ดำเนินการสั่งซื้อได้เลย</p>` 
                });
            } else if (currentDocType === 'memo') {
                // Memo -> Head (Owner)
                const headEmail = CONFIG.departmentHeads[currentDoc.from_dept];
                if(headEmail) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: headEmail, 
                        subject: `[Approved] อนุมัติ Memo: ${docNo}`, 
                        html_content: `<h3>เรียน หัวหน้าแผนก${currentDoc.from_dept}</h3><p>Memo ${docNo} ได้รับการอนุมัติแล้ว</p>` 
                    });
                }
            }
        }

        alert('✅ ดำเนินการเรียบร้อย!');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadData();
    } catch (err) { console.error(err); alert('Error: ' + err.message); if(btn) btn.disabled = false; }
}

// PR Form Logic (คงเดิม)
window.addItemRow = function() { const c = document.getElementById('itemsContainer'); if(c) c.insertAdjacentHTML('beforeend', `<div class="item-row border p-3 mb-3 bg-light shadow-sm"><div class="row g-3"><div class="col-md-3"><input type="text" class="form-control item-code" placeholder="รหัส"></div><div class="col-md-5"><input type="text" class="form-control item-desc" placeholder="รายละเอียด" required></div><div class="col-md-2"><input type="number" class="form-control item-qty" placeholder="จำนวน" required></div><div class="col-md-2"><input type="text" class="form-control item-unit" placeholder="หน่วย"></div></div><div class="text-end mt-2"><button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove()">ลบ</button></div></div>`); }
const prForm = document.getElementById('prForm');
if (prForm) { prForm.addEventListener('submit', async (e) => { e.preventDefault(); const btn = document.getElementById('btnSubmit'); btn.disabled = true; /* (Logic PR Submit เดิม) */ window.location.reload(); }); }
