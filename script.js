// ================= 1. CONFIG (ตั้งค่าระบบ) =================
const CONFIG = {
    // --------------------------------------------------------
    // [A] ตั้งค่าการเชื่อมต่อ (Supabase & EmailJS)
    // --------------------------------------------------------
    supaUrl: 'https://pufddwdcpugilwlavban.supabase.co', 
    supaKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1ZmRkd2RjcHVnaWx3bGF2YmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY1MDUsImV4cCI6MjA3NDk2MjUwNX0.6dyYteDu6QSkTL9hIiaHw_2WeltSGSIoMSvx3OcEjN0', 
    
    emailPublicKey: 'rEly1Il6Xz0qZwaSc',   
    emailServiceId: 'service_tolm3pu',   
    emailTemplateId_Master: 'template_master', 

    // ใส่ลิงก์เว็บของคุณ (ถ้ามี)
    siteUrl: '', 

    // --------------------------------------------------------
    // [B] รายชื่อหัวหน้าแผนก (สำหรับส่งอีเมลขออนุมัติขั้น 1)
    // --------------------------------------------------------
    departmentHeads: {
        'จัดซื้อ':           'jakkidmarat@gmail.com',
        'บัญชี':             'jakkidmarat@gmail.com',
        'ฝ่ายผลิต(เป่า)':    'jakkidmarat@gmail.com',
        'ฝ่ายผลิต(พิมพ์)':   'jakkidmarat@gmail.com',
        'ซ่อมบำรุง':         'jakkidmarat@gmail.com',
        'คลังสินค้า':        'jakkidmarat@gmail.com',
        'ขาย/การตลาด':       'jakkidmarat@gmail.com'
    },

    // --------------------------------------------------------
    // [C] อีเมลผู้ช่วยกรรมการ (อนุมัติขั้น 2) & ฝ่ายจัดซื้อ (รับงานต่อ)
    // --------------------------------------------------------
    managerEmail: 'bestworld.bwp328@gmail.com', 
    purchasingEmail: 'hr.bpp.2564@gmail.com',

    // --------------------------------------------------------
    // [D] รหัสผ่านเข้าสู่ระบบ Admin
    // --------------------------------------------------------
    passwords: {
        '1001': 'จัดซื้อ',
        '1002': 'บัญชี',
        '1003': 'ฝ่ายผลิต(เป่า)',
        '1006': 'ฝ่ายผลิต(พิมพ์)',
        '1007': 'ซ่อมบำรุง',
        '1004': 'คลังสินค้า',
        '1005': 'ขาย/การตลาด',
        '9999': 'MANAGER_ROLE' // ผู้ช่วยกรรมการ
    }
};

// ================= 2. SYSTEM START (เริ่มระบบ) =================
const db = supabase.createClient(CONFIG.supaUrl, CONFIG.supaKey);
if(typeof emailjs !== 'undefined') emailjs.init(CONFIG.emailPublicKey);

let currentUserRole = sessionStorage.getItem('userRole') || ''; 
let currentUserDept = sessionStorage.getItem('userDept') || ''; 
let currentDocType = 'pr'; // ค่าเริ่มต้น: ดู PR
let currentMode = 'pending'; 
let allDocs = []; 
let currentDoc = {};

document.addEventListener("DOMContentLoaded", function() {
    // โหลด Logo
    if (typeof LOGO_BASE64 !== 'undefined') {
        document.querySelectorAll('.app-logo').forEach(img => img.src = LOGO_BASE64);
    }
    // ตรวจสอบหน้า Admin
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

// ================= 3. MEMO FORM (บันทึกข้อความ) =================
const memoForm = document.getElementById('memoForm');
if (memoForm) {
    memoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnMemoSubmit');
        const originalText = btn.innerText;
        btn.disabled = true; 
        
        try {
            // 1. อัปโหลดไฟล์แนบ (ถ้ามี)
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

            // 2. บันทึกข้อมูลลง DB
            btn.innerText = '⏳ บันทึกข้อมูล...';
            const payload = {
                memo_no: document.getElementById('m_no').value,
                date: document.getElementById('m_date').value,
                from_dept: document.getElementById('m_from').value,
                to_dept: document.getElementById('m_to').value,
                subject: document.getElementById('m_subject').value,
                content: document.getElementById('m_content').value,
                attachment_url: publicUrl,
                status: 'pending_head' // สถานะเริ่มต้น
            };

            const { error } = await db.from('memos').insert([payload]);
            if (error) throw error;

            // 3. ส่งเมลหาหัวหน้าแผนก
            btn.innerText = '⏳ ส่งเมลหาหัวหน้า...';
            const headEmail = CONFIG.departmentHeads[payload.from_dept];
            const adminLink = window.location.origin + '/admin.html';

            if (headEmail) {
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: headEmail, 
                    subject: `[New Memo] ขออนุมัติ Memo: ${payload.memo_no}`, 
                    html_content: `
                        <h3>เรียน หัวหน้าแผนก${payload.from_dept}</h3>
                        <p>มีการสร้างบันทึกข้อความ (Memo) ใหม่ รอการตรวจสอบจากท่าน</p>
                        <p><b>เลขที่:</b> ${payload.memo_no}</p>
                        <p><b>เรื่อง:</b> ${payload.subject}</p>
                        <br>
                        <a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบอนุมัติ</a>
                    ` 
                });
            }
            alert('✅ ส่ง Memo ให้หัวหน้าตรวจสอบเรียบร้อย!');
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// ================= 4. PR FORM (ใบขอซื้อ) =================

// ฟังก์ชันเพิ่มแถวรายการสินค้า (HTML แบบเต็ม ไม่ย่อ)
window.addItemRow = function() {
    const container = document.getElementById('itemsContainer');
    if (!container) return; 
    const rowId = Date.now(); 
    const html = `
        <div class="item-row border p-3 mb-3 rounded bg-light shadow-sm" id="row-${rowId}">
            <div class="row g-3">
                <div class="col-md-3">
                    <label class="small text-muted">รหัสสินค้า</label>
                    <input type="text" class="form-control item-code">
                </div>
                <div class="col-md-5">
                    <label class="small text-muted">รายละเอียด</label>
                    <input type="text" class="form-control item-desc" required>
                </div>
                <div class="col-md-2">
                    <label class="small text-muted">จำนวน</label>
                    <input type="number" class="form-control item-qty" required>
                </div>
                <div class="col-md-2">
                    <label class="small text-muted">หน่วย</label>
                    <input type="text" class="form-control item-unit">
                </div>
            </div>
            <div class="text-end mt-2">
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeRow('${rowId}')">🗑️ ลบรายการนี้</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

// ฟังก์ชันลบแถว
window.removeRow = function(id) { 
    document.getElementById(`row-${id}`)?.remove(); 
}

// เพิ่มแถวแรกอัตโนมัติ
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
            
            if (!headEmail) { 
                alert("⚠️ ไม่พบอีเมลหัวหน้าของแผนกนี้ กรุณาตรวจสอบ Config"); 
                throw new Error("Email not found"); 
            }
            
            // 1. อัปโหลดไฟล์
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

            // 2. เก็บข้อมูลรายการสินค้า
            btn.innerText = '⏳ บันทึกข้อมูล...';
            const items = [];
            document.querySelectorAll('.item-row').forEach(row => { 
                items.push({
                    code: row.querySelector('.item-code').value, 
                    description: row.querySelector('.item-desc').value, 
                    quantity: row.querySelector('.item-qty').value, 
                    unit: row.querySelector('.item-unit').value, 
                    status: 'pending', 
                    remark: ''
                }); 
            });

            // 3. บันทึกลงฐานข้อมูล
            const payload = { 
                department: dept, 
                pr_number: document.getElementById('pr_number').value, 
                requester: document.getElementById('requester').value, 
                email: document.getElementById('email').value, 
                required_date: document.getElementById('required_date').value, 
                header_remark: document.getElementById('header_remark').value, 
                items: items, 
                attachment_url: publicUrl, 
                status: 'pending_head' 
            };
            
            const { error } = await db.from('purchase_requests').insert([payload]);
            if (error) throw error;

            // 4. ส่งเมลหาหัวหน้า
            btn.innerText = '⏳ ส่งอีเมล...';
            const adminLink = window.location.origin + '/admin.html';
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                to_email: headEmail, 
                subject: `[New Request] แผนก${dept} ขอตรวจสอบ PR ${payload.pr_number}`, 
                html_content: `<h3>เรียน หัวหน้าแผนก${dept},</h3><p>มีรายการขอซื้อใหม่จาก <b>${payload.requester}</b> รอการตรวจสอบครับ</p><p>เลขที่ PR: ${payload.pr_number}</p><p><a href="${adminLink}">คลิกเพื่อเข้าสู่ระบบ</a></p>` 
            });

            alert(`✅ ส่งเรื่องถึงหัวหน้าแผนก${dept} เรียบร้อยแล้ว!`); 
            window.location.reload();

        } catch (err) { 
            console.error(err); 
            alert('Error: ' + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = originalText; 
        }
    });
}

// ================= 5. ADMIN LOGIC (ระบบอนุมัติ) =================

// ตรวจสอบรหัสผ่าน
window.checkAdminPassword = function() {
    const input = document.getElementById('adminPassInput').value;
    const matchedDept = CONFIG.passwords[input];
    
    if (matchedDept) {
        sessionStorage.setItem('isAdmin', 'true');
        
        if (matchedDept === 'MANAGER_ROLE') { 
            currentUserRole = 'manager'; 
            currentUserDept = 'ALL'; 
        } else { 
            currentUserRole = 'head'; 
            currentUserDept = matchedDept; 
        }
        
        sessionStorage.setItem('userRole', currentUserRole);
        sessionStorage.setItem('userDept', currentUserDept);
        
        document.getElementById('loginOverlay').style.display = 'none';
        updateAdminUI(); 
        loadData();
    } else { 
        alert("❌ รหัสผ่านไม่ถูกต้อง!"); 
    }
}

function updateAdminUI() {
    const title = document.querySelector('#pageTitle');
    if (title) {
        const roleText = currentUserRole === 'head' ? `(หัวหน้า ${currentUserDept})` : `(ผู้ช่วย กก.)`;
        title.innerText = `👑 ตรวจสอบรายการ ${roleText}`;
    }
}

// สลับประเภทเอกสาร (PR / Memo)
window.switchDocType = function(type) {
    currentDocType = type;
    const btnPR = document.getElementById('btnTypePR');
    const btnMemo = document.getElementById('btnTypeMemo');
    
    if (type === 'pr') { 
        btnPR.className = 'btn btn-primary position-relative'; 
        btnMemo.className = 'btn btn-outline-primary position-relative'; 
    } else { 
        btnPR.className = 'btn btn-outline-primary position-relative'; 
        btnMemo.className = 'btn btn-success position-relative'; 
    }
    loadData();
}

// สลับ Tab (รออนุมัติ / ประวัติ)
window.switchTab = function(mode) {
    currentMode = mode;
    document.getElementById('btnPending').className = mode === 'pending' ? 'btn btn-warning active' : 'btn btn-outline-secondary';
    document.getElementById('btnHistory').className = mode === 'history' ? 'btn btn-secondary active' : 'btn btn-outline-secondary';
    loadData();
}

// โหลดข้อมูลลงตาราง
async function loadData() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">⏳ กำลังโหลด...</td></tr>';
    
    // อัปเดตตัวเลขแจ้งเตือน
    updateBadges();

    try {
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        let query = db.from(tableName).select('*').order('created_at', { ascending: false });

        if (currentMode === 'pending') {
            if (currentUserRole === 'head') {
                query = query.eq('status', 'pending_head');
                // แยกเงื่อนไข Department ตามตาราง
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
        
        if (data.length === 0) { 
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-muted">ไม่พบรายการ (${currentDocType.toUpperCase()})</td></tr>`; 
            return; 
        }

        data.forEach(doc => {
            const date = new Date(doc.created_at || doc.date).toLocaleDateString('th-TH');
            let docNo = currentDocType === 'pr' ? doc.pr_number : doc.memo_no;
            let from = currentDocType === 'pr' ? `${doc.requester} (${doc.department})` : `${doc.from_dept} : ${doc.subject}`;
            
            let statusText = doc.status;
            if (doc.status === 'pending_head') statusText = 'รอหัวหน้าแผนก';
            else if (doc.status === 'pending_manager') statusText = 'รอผู้ช่วย กก.';
            else if (doc.status === 'processed') statusText = 'อนุมัติเรียบร้อย';

            const row = `<tr>
                <td><span class="fw-bold text-primary">${docNo}</span></td>
                <td>${date}</td>
                <td><div class="small">${from}</div></td>
                <td><span class="badge bg-secondary">${statusText}</span></td>
                <td class="text-center"><button onclick="openDetailModal('${doc.id}')" class="btn btn-outline-info btn-sm rounded-pill px-3">ตรวจสอบ</button></td>
            </tr>`;
            tableBody.innerHTML += row;
        });

    } catch (err) { 
        console.error(err); 
        tableBody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Error: ${err.message}</td></tr>`; 
    }
}

// อัปเดตตัวเลขแจ้งเตือน (Badge)
async function updateBadges() {
    const badgePR = document.getElementById('badgePR');
    const badgeMemo = document.getElementById('badgeMemo');
    
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

// เปิดหน้าต่างอนุมัติ
window.openDetailModal = function(id) {
    currentDoc = allDocs.find(d => String(d.id) === String(id));
    if (!currentDoc) return;

    // 1. กรณีเป็น PR
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

        // สร้างตารางรายการสินค้า
        const tbody = document.getElementById('pr_items_body');
        tbody.innerHTML = '';
        currentDoc.items.forEach((item, index) => {
            let approvalHtml = '';
            if (currentMode === 'history') {
                approvalHtml = item.status === 'approved' ? '<span class="text-success">✅ อนุมัติ</span>' : '<span class="text-danger">❌ ไม่อนุมัติ</span>';
            } else {
                approvalHtml = `<input type="checkbox" class="form-check-input item-checkbox" data-index="${index}" checked> อนุมัติ`;
            }
            tbody.innerHTML += `<tr><td>${item.code||'-'}</td><td>${item.description}</td><td>${item.quantity}</td><td>${item.unit}</td><td class="text-center">${approvalHtml}</td></tr>`;
        });

    // 2. กรณีเป็น Memo
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

    // แสดงไฟล์แนบ
    const attArea = document.getElementById('attachment_area');
    if (currentDoc.attachment_url) {
        attArea.style.display = 'block';
        document.getElementById('attachment_link').href = currentDoc.attachment_url;
    } else {
        attArea.style.display = 'none';
    }

    // ปุ่มอนุมัติ
    const saveBtn = document.querySelector('.modal-footer .btn-success');
    if (currentMode === 'history') {
        saveBtn.style.display = 'none';
    } else {
        saveBtn.style.display = 'block';
        saveBtn.innerText = (currentUserRole === 'head') ? '✅ ตรวจสอบแล้ว ➡️ ส่งต่อผู้ช่วย กก.' : '✅ อนุมัติเอกสาร';
    }
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// กดปุ่มยืนยันผลการพิจารณา
window.finalizeApproval = async function() {
    const btn = document.querySelector('.modal-footer .btn-success');
    btn.disabled = true; btn.innerText = '⏳ กำลังประมวลผล...';

    try {
        let nextStatus = (currentUserRole === 'head') ? 'pending_manager' : 'processed';
        const tableName = currentDocType === 'pr' ? 'purchase_requests' : 'memos';
        
        // อัปเดตฐานข้อมูล
        if (currentDocType === 'pr') {
            document.querySelectorAll('.item-checkbox').forEach(cb => {
                const idx = cb.dataset.index;
                currentDoc.items[idx].status = cb.checked ? 'approved' : 'rejected';
            });
            await db.from(tableName).update({ status: nextStatus, items: currentDoc.items }).eq('id', currentDoc.id);
        } else {
            await db.from(tableName).update({ status: nextStatus }).eq('id', currentDoc.id);
        }

        // ส่งอีเมลแจ้งเตือน
        const adminLink = window.location.origin + '/admin.html';
        const docNo = currentDocType === 'pr' ? currentDoc.pr_number : currentDoc.memo_no;

        // 1. หัวหน้าแผนกอนุมัติ -> ส่งต่อ ผู้ช่วย กก.
        if (currentUserRole === 'head') {
            await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                to_email: CONFIG.managerEmail, 
                subject: `[Step 2] รออนุมัติ: ${currentDocType.toUpperCase()} ${docNo}`, 
                html_content: `<h3>เรียน ผู้ช่วยกรรมการ</h3><p>รายการ ${docNo} ผ่านการตรวจสอบจากหัวหน้าแผนกแล้ว</p><a href="${adminLink}">เข้าสู่ระบบเพื่ออนุมัติ</a>` 
            });
        } 
        // 2. ผู้ช่วย กก. อนุมัติ (จบงาน)
        else {
            if (currentDocType === 'pr' && CONFIG.purchasingEmail) {
                // ถ้าเป็น PR -> ส่งฝ่ายจัดซื้อ
                await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                    to_email: CONFIG.purchasingEmail, 
                    subject: `[Approved] สั่งซื้อสินค้า PR ${docNo}`, 
                    html_content: `<h3>เรียน ฝ่ายจัดซื้อ</h3><p>PR ${docNo} อนุมัติแล้ว ดำเนินการสั่งซื้อได้เลย</p>` 
                });
            } else if (currentDocType === 'memo') {
                // ถ้าเป็น Memo -> ส่งกลับหัวหน้าแผนก (เจ้าของเรื่อง)
                const headEmail = CONFIG.departmentHeads[currentDoc.from_dept];
                const viewLink = window.location.origin + `/view_memo.html?id=${currentDoc.id}`;

                if(headEmail) {
                    await emailjs.send(CONFIG.emailServiceId, CONFIG.emailTemplateId_Master, { 
                        to_email: headEmail, 
                        subject: `[Approved] อนุมัติ Memo: ${docNo}`, 
                        html_content: `
                            <h3>เรียน หัวหน้าแผนก${currentDoc.from_dept}</h3>
                            <p>Memo เลขที่ <b>${docNo}</b> ได้รับการอนุมัติแล้ว</p>
                            <p>ท่านสามารถเปิดดูเอกสารและบันทึกเป็นไฟล์ PDF ได้ที่ปุ่มด้านล่างครับ</p>
                            <br>
                            <a href="${viewLink}" style="background-color:#198754; color:white; padding:15px 25px; text-decoration:none; border-radius:5px; font-size:16px;">
                                📂 เปิดดู / บันทึก PDF
                            </a>
                        ` 
                    });
                }
            }
        }

        alert('✅ ดำเนินการเรียบร้อย!');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadData();
    } catch (err) { 
        console.error(err); 
        alert('Error: ' + err.message); 
    } finally { 
        if(btn) btn.disabled = false; 
    }
}

// ================= 6. PRINT VIEW LOGIC (สำหรับหน้าพิมพ์) =================

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

        // แสดงลายเซ็น (3 ช่อง)
        document.getElementById('v_sign_requester').innerText = "เจ้าหน้าที่แผนก" + m.from_dept;
        
        if (m.status === 'pending_manager' || m.status === 'processed') { 
            document.getElementById('v_sign_head').innerHTML = `( หัวหน้าแผนก${m.from_dept} )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>`; 
        }
        if (m.status === 'processed') { 
            document.getElementById('v_sign_manager').innerHTML = '( เบญจมาศ ถิ่นจันทร์ )<br><span class="text-success small" style="font-size:10px;">อนุมัติออนไลน์</span>'; 
        }

    } catch (err) { alert('Error: ' + err.message); }
}

if(document.getElementById('v_tableBody')) window.onload = loadPRForPrint;
if(document.getElementById('v_content')) window.onload = loadMemoForPrint;

document.addEventListener('keydown', function(event) { if (event.key === 'Enter' && event.target.tagName === 'INPUT') { event.preventDefault(); return false; } });
