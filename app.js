/**
 * Sermanto ERP - Main Logic
 */

// State
const state = {
    user: null,
    currentView: 'auth',
    data: {
        expenses: null,
        income: null,
        services: null,
        tools: null,
        services: null,
        tools: null,
        mermas: null,
        operations: null,
        personnel: null
    },
    lastUpdated: {
        expenses: null,
        income: null,
        services: null,
        tools: null,
        mermas: null,
        operations: null,
        personnel: null
    },
    activeOperation: null, // Stores the full object of currently viewed op
    intervals: []
};

// DOM Elements
const views = {
    auth: document.getElementById('auth-view'),
    dashboard: document.getElementById('dashboard-view')
};

const forms = {
    login: document.getElementById('login-form')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initUploadListeners();
    checkSession();
});

function initEventListeners() {
    forms.login.addEventListener('submit', handleLogin);
}

function initUploadListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (!dropZone || !fileInput) return; // Exit if elements don't exist (Refactored View)

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // File Input
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    console.log("Processing file:", file.name);

    // 1. Show processing state
    // TODO: Add visual loader

    // 2. Convert to Base64
    const base64 = await toBase64(file);

    // 3. Send to Backend
    try {
        const response = await uploadToGAS(file.name, file.type, base64);

        if (response.status === 'success') {
            console.log("Uploaded!", response);
            alert(`¡Factura "${file.name}" subida exitosamente!`);
            // 4. Update UI
            addToRecentList(file.name);
        } else {
            throw new Error(response.message || 'Error desconocido');
        }

    } catch (error) {
        console.error(error);
        alert("Error al subir: " + error.message);
    }
}

function addToRecentList(fileName) {
    const list = document.getElementById('invoice-list');
    const empty = list.querySelector('.empty-state');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'invoice-item';
    div.innerHTML = `
        <div style="flex:1">
            <strong>${fileName}</strong><br>
            <span class="text-muted">Subido ahora mismo</span>
        </div>
        <div class="badge warning">Pendiente</div>
    `;
    list.prepend(div);
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); // Remove "data:*/*;base64," prefix for GAS
    reader.onerror = error => reject(error);
});

// API Connection
const API_URL = 'https://script.google.com/macros/s/AKfycbzfV8aFdVZ07tMweU5qUDfRxJbkfYw-7m6llDAP2tiumTOT4DlOp9xlwedKmmmmhWOSaA/exec';

async function uploadToGAS(fileName, mimeType, base64) {
    const payload = {
        action: 'uploadInvoice',
        fileName: fileName,
        mimeType: mimeType,
        fileBase64: base64
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    return await response.json();
}

function checkSession() {
    const savedUser = localStorage.getItem('sermanto_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        toggleLayout(true); // Ensure sidebar is visible
        updateSidebarPermissions();
        switchView('home-view');
    } else {
        toggleLayout(false); // Ensure login is visible
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const userUser = e.target.querySelector('input[type="text"]').value;
    const userPass = e.target.querySelector('input[type="password"]').value;
    const btn = e.target.querySelector('button');

    if (!userUser || !userPass) return;

    // UI Loading State
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Entrando...';
    btn.disabled = true;

    try {
        const payload = {
            action: 'login',
            username: userUser,
            password: userPass
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.status === 'success') {
            loginUser(data.user);
        } else {
            alert("Error: " + data.message);
        }

    } catch (error) {
        console.error(error);
        alert("Error de conexión con el servidor");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- Layout Control ---
function toggleLayout(isLoggedIn) {
    const sidebar = document.getElementById('app-sidebar');
    const authView = document.getElementById('auth-view');

    if (isLoggedIn) {
        sidebar.classList.remove('hidden');
        if (authView) authView.classList.add('hidden');
    } else {
        sidebar.classList.add('hidden');
        if (authView) authView.classList.remove('hidden');
    }
}

function loginUser(user) {
    state.user = user;
    localStorage.setItem('sermanto_user', JSON.stringify(user));

    // Update Profile UI
    if (document.getElementById('display-name')) {
        document.getElementById('display-name').textContent = user.name || user.username;
        document.getElementById('display-role').textContent = user.role;
    }

    toggleLayout(true); // Show Sidebar
    updateSidebarPermissions(); // Show Admin Menu if needed

    // Preload Data (Initial Load)
    loadExpenses();
    loadIncome();
    loadServices();
    loadTools();
    loadTools();
    loadMermas();
    loadOperations();

    // Start Background Polling (Every 60s)
    const intervalId = setInterval(() => {
        console.log('Syncing data in background...');
        loadExpenses(true);
        loadIncome(true);
        loadServices(true);
        loadTools(true);
        loadMermas(true);
        loadOperations(true);
        if (state.user.role === 'admin' || state.user.role === 'superadmin') loadPersonnel(true);
    }, 60000);
    state.intervals.push(intervalId);

    switchView('home-view');
}

function updateSidebarPermissions() {
    const adminMenu = document.getElementById('admin-menu-section');
    if (state.user && ['admin', 'superadmin'].includes(state.user.role)) {
        adminMenu.classList.remove('hidden');
    } else {
        adminMenu.classList.add('hidden');
    }
}

function renderUserNav() {
    // Legacy function replaced by updateSidebarPermissions + toggleLayout
    // Keeping empty alias if needed
}

function logout() {
    // Clear Intervals
    state.intervals.forEach(clearInterval);
    state.intervals = [];

    state.user = null;
    state.data = { expenses: null, income: null, services: null, tools: null, mermas: null, operations: null, personnel: null }; // Clear Cache
    localStorage.removeItem('sermanto_user');
    location.reload();
}

async function loadUsers() {
    switchView('users-view');
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Usuarios',
                userRole: state.user.role
            })
        });

        const res = await response.json();
        if (res.status === 'success') {
            tbody.innerHTML = '';
            res.data.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${u.Usuario}</td>
                    <td>${u.Nombres || '-'}</td>
                    <td><span class="badge ${u.Rol === 'admin' ? 'warning' : ''}">${u.Rol}</span></td>
                    <td>
                        <button class="action-btn" onclick='editUser(${JSON.stringify(u)})'><i class="ph ph-pencil"></i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            alert(res.message);
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar</td></tr>';
    }
}

// User Form State
let isEditing = false;

function openUserModal() {
    isEditing = false;
    document.getElementById('user-form').reset();
    document.getElementById('modal-title').textContent = "Nuevo Usuario";
    document.querySelector('input[name="Usuario"]').readOnly = false;
    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

function editUser(user) {
    isEditing = true;
    openUserModal();
    document.getElementById('modal-title').textContent = "Editar Usuario";

    // Fill Form
    const f = document.getElementById('user-form');
    f.querySelector('input[name="Usuario"]').value = user.Usuario;
    f.querySelector('input[name="Usuario"]').readOnly = true; // Cannot change ID for now
    f.querySelector('input[name="Nombres"]').value = user.Nombres;
    f.querySelector('input[name="Contrase&#241;a"]').value = user['Contraseña'];
    f.querySelector('select[name="Rol"]').value = user.Rol;
}

// Form Submit
document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    const op = isEditing ? 'update' : 'create';

    // Optimistic UI close
    closeUserModal();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: op,
                table: 'Usuarios',
                userRole: state.user.role, // RBAC Check
                payload: payload
            })
        });

        const res = await response.json();
        alert(res.message);
        if (res.status === 'success') loadUsers();

    } catch (err) {
        alert("Error al guardar");
    }
});

function switchView(viewName) {
    // Hide all direct children sections of main
    const sections = document.querySelectorAll('main > section');
    sections.forEach(el => el.classList.add('hidden'));

    // Show target
    const target = document.getElementById(viewName);
    if (target) {
        target.classList.remove('hidden');
        state.currentView = viewName;
    } else {
        console.error("View not found:", viewName);
    }

    // Update Sidebar Active State
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewName)) {
            item.classList.add('active');
        }
    });

    // Auto-load finance data if entering finance view
    if (viewName === 'finances-view') {
        const date = new Date().toLocaleDateString();
        document.getElementById('finance-date').textContent = date;

        // Data is now preloaded/cached.
        // We can optionally trigger a silent refresh if data is too old, 
        // but for now, rely on background polling + cache.
        if (!state.data.expenses) loadExpenses();
        if (!state.data.income) loadIncome();
    }

    if (viewName === 'services-view') {
        if (!state.data.services) loadServices();
    }

    if (viewName === 'inventory-view') {
        document.getElementById('inventory-date').textContent = new Date().toLocaleDateString();
        // Load both to correlate data
        loadTools();
        loadMermas();
    }
}

// --- Finance Module Logic ---

function switchFinanceTab(tabName) {
    // 1. Update Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Simple check based on text or click handler would be better, but we rely on order or ID for now
    // Actually, finding the button that called this would be cleaner, but let's toggle visibility first

    // 2. Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // 3. Show target
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // 4. Update button active state (simple hack: finding the button via event is harder here without 'event' passed)
    // Let's assume the user clicks.
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'expenses') btns[0].classList.add('active');
    if (tabName === 'income') btns[1].classList.add('active');
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    if (type === 'error') toast.style.backgroundColor = '#ef4444';
    if (type === 'success') toast.style.backgroundColor = '#22c55e';

    document.body.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Generic Modal Helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function openExpenseModal() {
    openModal('expense-modal');
    // Set Default Date to Today
    document.querySelector('#expense-form input[name="Fecha"]').valueAsDate = new Date();
}

function openIncomeModal() {
    openModal('income-modal');
    document.querySelector('#income-form input[name="Fecha"]').valueAsDate = new Date();
}

// Expense Form Submit
document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    // 1. Capture Data
    const formData = new FormData(e.target);
    const fileInput = document.getElementById('expense-file-input');
    const file = fileInput.files[0];

    // 2. Optimistic UI (Render immediately)
    const tempId = 'temp-' + Date.now();
    const tempItem = {
        Fecha: formData.get('Fecha') || new Date().toISOString(),
        Proveedor: formData.get('Proveedor'),
        Tipo: formData.get('Tipo'),
        Categoria: formData.get('Categoria'),
        Monto: formData.get('Monto'),
        fileUrl: null // Will update later if file exists
    };

    const tbody = document.getElementById('expenses-list');
    // Remove "No expenses" or "Loading" row if exists
    if (tbody.querySelector('.text-center')) tbody.innerHTML = '';

    const rowHtml = `
        <tr id="${tempId}" class="fade-in" style="background: #f0fdf4;">
            <td>${formatDate(tempItem.Fecha)}</td>
            <td>${tempItem.Proveedor}</td>
            <td>${tempItem.Tipo || 'Factura'}</td>
            <td><span class="badge">${tempItem.Categoria}</span></td>
            <td>S/ ${parseFloat(tempItem.Monto).toFixed(2)}</td>
            <td id="e-${tempId}">
                ${file ? '<span class="text-muted"><i class="ph ph-spinner ph-spin"></i> Subiendo...</span>' : '-'}
            </td>
            <td><span class="text-muted">...</span></td>
        </tr>
    `;
    tbody.insertAdjacentHTML('afterbegin', rowHtml);
    closeModal('expense-modal');
    e.target.reset();

    // 3. Background Process (Upload + Save)
    try {
        let fileUrl = '';

        // A. Upload File if exists
        if (file) {
            const base64 = await toBase64(file);
            const uploadPayload = {
                action: 'uploadInvoice',
                fileName: file.name,
                mimeType: file.type,
                fileBase64: base64
            };

            const uploadResp = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(uploadPayload)
            });
            const uploadResult = await uploadResp.json();

            if (uploadResult.status === 'success') {
                fileUrl = uploadResult.fileUrl;
                // Update Optimistic UI Confirmation
                const evidenceCell = document.getElementById(`e-${tempId}`);
                if (evidenceCell) evidenceCell.innerHTML = `<a href="${fileUrl}" target="_blank" class="action-btn"><i class="ph ph-file-pdf"></i> Ver</a>`;
            }
        }

        // B. Save Record to DB
        const payload = Object.fromEntries(formData.entries());
        payload.fileUrl = fileUrl; // Add the URL to the payload

        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create',
                table: 'Gastos',
                userRole: state.user.role,
                payload: payload
            })
        });

        console.log('Gasto sincronizado en background');
        // Remove temp highlight
        setTimeout(() => {
            const row = document.getElementById(tempId);
            if (row) row.style.background = 'white';
        }, 2000);

    } catch (error) {
        console.error(error);
        alert('Hubo un error guardando el gasto en la nube. Por favor verifica tu conexión.');
        const row = document.getElementById(tempId);
        if (row) row.style.backgroundColor = '#fff0f0';
    } finally {
        btn.disabled = false;
        // loadExpenses(); // Optional: Refresh full list to get server-side sort/ID
    }
});

// Income Form Submit
document.getElementById('income-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    btn.disabled = true;

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create',
                table: 'Ingresos',
                userRole: state.user.role,
                payload: payload
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            alert('Ingreso registrado correctamente');
            closeModal('income-modal');
            e.target.reset();
            loadIncome(); // Refresh Data
        } else {
            alert('Error: ' + res.message);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// Service Modal & Logic refactored below with Edit support

// Service Form Submit
// Service Form Submit
document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";

    const formData = new FormData(e.target);
    const fileInput = document.getElementById('service-file-input');
    const file = fileInput.files[0];

    try {
        let fileUrl = '';

        // 1. Upload Photo if exists
        if (file) {
            const base64 = await toBase64(file);
            const uploadResp = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadFile',
                    module: 'services',
                    fileName: 'SVC-' + file.name,
                    mimeType: file.type,
                    fileBase64: base64
                })
            });
            const uploadResult = await uploadResp.json();
            if (uploadResult.status === 'success') {
                fileUrl = uploadResult.fileUrl;
            }
        }

        // 2. Prepare Payload
        const payload = Object.fromEntries(formData.entries());
        if (fileUrl) payload.FotoUrl = fileUrl;

        // Determine Action: Create or Update
        let op = 'create';
        if (editingServiceId) {
            op = 'update';
            payload.id = editingServiceId;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: op,
                table: 'Servicios',
                userRole: state.user.role,
                payload: payload
            })
        });

        const res = await response.json();

        if (res.status === 'success') {
            alert(editingServiceId ? 'Servicio actualizado' : 'Servicio creado');
            closeModal('service-modal');
            e.target.reset();
            editingServiceId = null; // Reset edit mode
            loadServices(false); // Force refresh
        } else {
            alert('Error: ' + res.message);
        }

    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

// --- Data Loading Functions ---

async function loadExpenses(silent = false) {
    const tbody = document.getElementById('expenses-list');

    // 1. Cache Check (Immediate Render)
    if (!silent && state.data.expenses) {
        renderExpenses(state.data.expenses);
        // We still fetch in background to update, but user sees data immediately
    } else if (!silent) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando datos...</td></tr>';
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Gastos',
                userRole: state.user.role
            })
        });
        const res = await response.json();

        if (res.status === 'success') {
            // Update Cache
            state.data.expenses = res.data;
            state.lastUpdated.expenses = new Date();

            // Render
            renderExpenses(res.data);
        } else if (!silent) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay gastos registrados.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        if (!silent) tbody.innerHTML = '<tr><td colspan="7" class="text-center warning">Error al cargar.</td></tr>';
    }
}

function renderExpenses(data) {
    const tbody = document.getElementById('expenses-list');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay gastos registrados.</td></tr>';
        return;
    }

    // Sort by Date Descending
    const sortedData = [...data].sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

    tbody.innerHTML = sortedData.map(item => `
        <tr id="row-${item.id}">
            <td>${formatDate(item.Fecha)}</td>
            <td>${item.Proveedor || '-'}</td>
            <td>${item.Tipo || 'Factura'}</td>
            <td><span class="badge">${item.Categoria || 'General'}</span></td>
            <td>S/ ${parseFloat(item.Monto).toFixed(2)}</td>
            <td>
                <span class="badge ${item.Estado === 'Aprobado' ? 'success' : 'warning'}">
                    ${item.Estado || 'Aprobado'} 
                </span>
            </td>
            <td>
                    ${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" class="action-btn"><i class="ph ph-file-pdf"></i> Ver</a>` : '<span class="text-muted">-</span>'}
            </td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                ${(item.Estado === 'Pendiente' && ['admin', 'superadmin', 'contador'].includes(state.user.role)) ?
            `<button class="action-btn text-success" onclick="approveExpense('${item.id}')" title="Aprobar"><i class="ph ph-check"></i></button>` : ''
        }
                <button class="action-btn text-danger" onclick="deleteExpense('${item.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    // Calculate Monthly Total
    const total = data.reduce((acc, curr) => acc + (parseFloat(curr.Monto) || 0), 0);
    const totalEl = document.querySelector('#tab-expenses .mini-stats .value');
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;

    // Pending Count (Mock)
    const countEl = document.querySelector('#tab-expenses .mini-stats .value.warning');
    if (countEl) countEl.textContent = data.length;
}

window.approveExpense = async function (id) {
    if (!confirm('¿Aprobar este gasto?')) return;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'approve',
                table: 'Gastos',
                userRole: state.user.role,
                payload: { id: id }
            })
        });
        showToast('Gasto aprobado', 'success');
        loadExpenses(); // Reload to update UI
    } catch (e) {
        showToast('Error al aprobar', 'error');
    }
};

// Global scope for onclick
window.deleteExpense = async function (id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;

    // Optimistic UI
    const row = document.getElementById(`row-${id}`);
    if (row) row.style.opacity = '0.5';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'delete',
                table: 'Gastos',
                userRole: state.user.role,
                payload: { id: id }
            })
        });
        const res = await response.json();

        if (res.status === 'success') {
            if (row) row.remove();
            // Update total? Might be too expensive to recalculate completely without reload, 
            // but we can try subtracting or just re-load. Let's re-load for accuracy.
            loadExpenses();
        } else {
            alert('Error al eliminar: ' + res.message);
            if (row) row.style.opacity = '1';
        }

    } catch (e) {
        console.error(e);
        alert('Error de conexión');
        if (row) row.style.opacity = '1';
    }
};

async function loadIncome(silent = false) {
    const tbody = document.getElementById('income-list');

    // 1. Cache Check
    if (!silent && state.data.income) {
        renderIncome(state.data.income);
    } else if (!silent) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando datos...</td></tr>';
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Ingresos',
                userRole: state.user.role
            })
        });
        const res = await response.json();

        if (res.status === 'success') {
            state.data.income = res.data;
            state.lastUpdated.income = new Date();
            renderIncome(res.data);
        } else if (!silent) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ingresos registrados.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        if (!silent) tbody.innerHTML = '<tr><td colspan="5" class="text-center warning">Error al cargar.</td></tr>';
    }
}

function renderIncome(data) {
    const tbody = document.getElementById('income-list');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay ingresos registrados.</td></tr>';
        return;
    }

    // Sort logic can be added here if needed

    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${formatDate(item.Fecha)}</td>
            <td>${item.Cliente || '-'}</td>
            <td>${item.Contrato || '-'}</td>
            <td>S/ ${parseFloat(item.Monto).toFixed(2)}</td>
            <td><span class="badge success">Registrado</span></td>
        </tr>
    `).join('');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    // Handle both "2024-01-29" and full ISO strings
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString();
}

async function loadServices(silent = false) {
    const tbody = document.getElementById('services-list');

    if (!silent && state.data.services) {
        renderServices(state.data.services);
    } else if (!silent) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Cargando catálogo...</td></tr>';
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Servicios',
                userRole: state.user.role
            })
        });
        const res = await response.json();

        if (res.status === 'success') {
            state.data.services = res.data;
            state.lastUpdated.services = new Date();
            renderServices(res.data);
        } else if (!silent) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay servicios registrados.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        if (!silent) tbody.innerHTML = '<tr><td colspan="8" class="text-center warning">Error al cargar.</td></tr>';
    }
}


function formatDriveImage(url) {
    if (!url) return null;
    try {
        let fileId = null;
        // Case 1: Raw ID (long alphanumeric)
        if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) {
            fileId = url;
        }
        // Case 2: Standard View/Share URLs
        else if (url.includes('/file/d/')) {
            const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        }
        // Case 3: Export/Open URLs
        else if (url.includes('id=')) {
            const match = url.match(/id=([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        }

        if (fileId) {
            // Using 'thumbnail' endpoint for reliable public viewing without redirect issues
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        }
    } catch (e) { console.error('Error parsing Image URL', e); }
    return url;
}

function renderServices(data) {
    const grid = document.getElementById('services-list');
    if (!data || data.length === 0) {
        grid.innerHTML = '<div class="text-center" style="grid-column: 1/-1;">No hay servicios registrados.</div>';
        return;
    }

    grid.innerHTML = data.map(item => {
        const cost = parseFloat(item.CostoUnitario) || 0;
        const price = parseFloat(item.PrecioUnitario) || 0;
        const margin = price > 0 ? ((price - cost) / price * 100).toFixed(1) : 0;
        const currency = item.Moneda === 'USD' ? '$' : 'S/';

        // Default Image Logic
        let displayUrl = formatDriveImage(item.FotoUrl);
        if (!displayUrl || displayUrl.trim() === '') {
            // Using UI Avatars for a clean default if no image
            const name = encodeURIComponent(item.Nombre.substring(0, 20));
            displayUrl = `https://ui-avatars.com/api/?name=${name}&background=0a192f&color=64ffda&size=400&font-size=0.33&length=2`;
        }

        return `
            <div class="service-card" onclick="this.classList.toggle('flipped')">
                <div class="card-inner">
                    <!-- Front -->
                    <div class="card-front">
                        <div class="card-img-container" style="width:100%; height:180px; overflow:hidden; background:#f0f0f0; display:flex; align-items:center; justify-content:center;">
                             <img src="${displayUrl}" alt="${item.Nombre}" class="card-img" style="width:100%; height:100%; object-fit:cover;" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
                        </div>
                        <div class="card-content">
                            <div>
                                <h3 class="card-title">${item.Nombre}</h3>
                                <span class="badge ${margin > 30 ? 'success' : 'warning'}">Margen: ${margin}%</span>
                            </div>
                            <div class="card-price">
                                ${currency} ${price.toFixed(2)} <span style="font-size:0.8rem; font-weight:400; color:#718096">/ ${item.UnidadMedida}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Back -->
                    <div class="card-back">
                        <h4>Detalles</h4>
                        <p>${item.Descripcion || 'Sin descripción'}</p>
                        
                        <div class="data-row">
                            <span>Cost. Unit:</span>
                            <strong>${currency} ${cost.toFixed(2)}</strong>
                        </div>
                        <div class="data-row">
                            <span>Precio:</span>
                            <strong>${currency} ${price.toFixed(2)}</strong>
                        </div>
                        <div class="data-row">
                            <span>Utilidad:</span>
                            <strong>${currency} ${(price - cost).toFixed(2)}</strong>
                        </div>

                        <div class="card-actions">
                            <button class="btn-icon-circle" onclick="event.stopPropagation(); editService('${item.id}')" title="Editar">
                                <i class="ph ph-pencil-simple"></i>
                            </button>
                            <button class="btn-icon-circle" onclick="event.stopPropagation(); deleteService('${item.id}')" title="Eliminar" style="background:#ef4444;">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

let editingServiceId = null;

window.editService = function (id) {
    const service = state.data.services.find(s => s.id === id);
    if (!service) return;

    editingServiceId = id;

    // Fill Form
    const f = document.getElementById('service-form');
    f.querySelector('input[name="Nombre"]').value = service.Nombre;
    f.querySelector('textarea[name="Descripcion"]').value = service.Descripcion;
    f.querySelector('input[name="UnidadMedida"]').value = service.UnidadMedida;
    f.querySelector('select[name="Moneda"]').value = service.Moneda;
    f.querySelector('input[name="CostoUnitario"]').value = service.CostoUnitario;
    f.querySelector('input[name="PrecioUnitario"]').value = service.PrecioUnitario;

    // Update Modal UI
    document.querySelector('#service-modal .modal-title').textContent = "Editar Servicio";
    document.querySelector('#service-form button[type="submit"]').textContent = "Actualizar Servicio";

    openModal('service-modal');
};

window.openServiceModal = function () {
    editingServiceId = null;
    document.getElementById('service-form').reset();
    document.querySelector('#service-modal .modal-title').textContent = "Nuevo Servicio";
    document.querySelector('#service-form button[type="submit"]').textContent = "Guardar Servicio";
    openModal('service-modal');
};

window.deleteService = async function (id) {
    if (!confirm('¿Eliminar este servicio del catálogo?')) return;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'delete',
                table: 'Servicios',
                userRole: state.user.role,
                payload: { id: id }
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            loadServices(false);
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error de conexión');
    }
};

// --- Inventory Module Logic ---

function switchInventoryTab(tabName) {
    document.querySelectorAll('#inventory-view .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#inventory-view .tab-content').forEach(content => content.classList.add('hidden'));

    if (tabName === 'tools') {
        document.querySelector(`#inventory-view .tab-btn[onclick="switchInventoryTab('tools')"]`).classList.add('active');
        document.getElementById('tab-tools').classList.remove('hidden');
    } else {
        document.querySelector(`#inventory-view .tab-btn[onclick="switchInventoryTab('mermas')"]`).classList.add('active');
        document.getElementById('tab-mermas').classList.remove('hidden');
    }
}

// Tool Modals
function openToolModal() {
    openModal('tool-modal');
}

function openMermaModal(toolId, toolName, currentStock) {
    document.getElementById('merma-tool-id').value = toolId;
    document.getElementById('merma-tool-name').value = toolName;

    // Set System Stock for calculation
    document.getElementById('merma-system-stock').value = currentStock;

    // Reset other fields
    document.getElementById('merma-physical-count').value = '';
    document.getElementById('merma-difference').value = '';
    document.getElementById('merma-quantity').value = '';
    document.querySelector('#merma-form textarea[name="Motivo"]').value = '';

    openModal('merma-modal');
}

// Data Handling
async function loadTools(silent = false) {
    const tbody = document.getElementById('tools-list');
    if (!silent) tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando inventario...</td></tr>';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'db', op: 'read', table: 'Herramientas', userRole: state.user.role })
        });
        const res = await response.json();
        if (res.status === 'success') {
            state.data.tools = res.data;
            renderTools(res.data);
        } else if (!silent) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay herramientas registradas.</td></tr>';
        }
    } catch (e) { console.error(e); }
}

async function loadMermas(silent = false) {
    const tbody = document.getElementById('mermas-list');
    if (!silent) tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando reportes...</td></tr>';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'db', op: 'read', table: 'Mermas', userRole: state.user.role })
        });
        const res = await response.json();
        if (res.status === 'success') {
            state.data.mermas = res.data;
            renderMermas(res.data);
        } else if (!silent) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay mermas reportadas.</td></tr>';
        }
    } catch (e) { console.error(e); }
}

function renderTools(data) {
    const grid = document.getElementById('tools-list');
    if (!data || data.length === 0) {
        grid.innerHTML = '<div class="text-center" style="grid-column: 1/-1;">No hay herramientas registradas.</div>';
        return;
    }

    grid.innerHTML = data.map(item => {
        // Stock Logic
        const total = parseInt(item.StockTotal) || 0;
        const available = item.StockDisponible !== undefined ? parseInt(item.StockDisponible) : total;

        let statusClass = 'success';
        let statusText = 'Optimo';
        if (available === 0) { statusClass = 'danger'; statusText = 'Agotado'; }
        else if (available < total * 0.3) { statusClass = 'warning'; statusText = 'Bajo Stack'; }

        // Image Logic
        let displayUrl = formatDriveImage(item.FotoUrl);
        if (!displayUrl || displayUrl.trim() === '') {
            const name = encodeURIComponent(item.Nombre.substring(0, 20));
            displayUrl = `https://ui-avatars.com/api/?name=${name}&background=f1f5f9&color=64748b&size=400&font-size=0.33&length=2`;
        }

        return `
            <div class="service-card" onclick="this.classList.toggle('flipped')">
                <div class="card-inner">
                    <!-- Front -->
                    <div class="card-front">
                        <div class="card-img-container" style="width:100%; height:180px; overflow:hidden; background:#f0f0f0; display:flex; align-items:center; justify-content:center;">
                             <img src="${displayUrl}" alt="${item.Nombre}" class="card-img" style="width:100%; height:100%; object-fit:cover;" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
                        </div>
                        <div class="card-content">
                            <div>
                                <h3 class="card-title">${item.Nombre}</h3>
                                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:0.5rem;">
                                    <span class="badge ${statusClass}">${statusText}</span>
                                    <span style="font-size:0.9rem; color:#64748b; font-weight:600;">Stock: ${available} / ${total}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Back -->
                    <div class="card-back">
                        <h4>Detalles</h4>
                        <p>${item.Descripcion || 'Sin descripción'}</p>
                        
                        <div class="data-row">
                            <span>Costo Reposición:</span>
                            <strong>S/ ${parseFloat(item.CostoReposicion || 0).toFixed(2)}</strong>
                        </div>
                        <div class="data-row">
                            <span>Total:</span>
                            <strong>${total} und.</strong>
                        </div>
                         <div class="data-row">
                            <span>Disponible:</span>
                            <strong style="color:${available > 0 ? '#4ade80' : '#f87171'}">${available} und.</strong>
                        </div>

                        <div class="card-actions">
                             <button class="btn-icon-circle" title="Realizar Auditoría" onclick="event.stopPropagation(); openMermaModal('${item.id}', '${item.Nombre}', ${available})">
                                <i class="ph ph-clipboard-text"></i>
                            </button>
                             <button class="btn-icon-circle" title="Ver Historial" onclick="event.stopPropagation(); openHistoryModal('${item.id}', '${item.Nombre}')">
                                <i class="ph ph-clock-counter-clockwise"></i>
                            </button>
                             <!-- Add Edit/Delete actions here if needed later -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMermas(data) {
    const tbody = document.getElementById('mermas-list');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay mermas activas.</td></tr>';
        return;
    }

    // Sort: 'En Revision' first
    const sortedDetails = [...data].sort((a, b) => {
        if (a.Estado === 'En Revision' && b.Estado !== 'En Revision') return -1;
        if (a.Estado !== 'En Revision' && b.Estado === 'En Revision') return 1;
        return 0;
    });

    tbody.innerHTML = sortedDetails.map(item => {
        // Find Tool Name
        const tool = state.data.tools ? state.data.tools.find(t => t.id === item.HerramientaId) : null;
        const toolName = tool ? tool.Nombre : 'Herramienta Eliminada';

        let actions = '-';
        if (item.Estado === 'En Revision') {
            actions = `
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-success btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="resolveMerma('${item.id}', 'Recuperar', '${item.HerramientaId}', ${item.Cantidad})">
                        Recuperar
                    </button>
                    <button class="btn btn-primary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; background:#ef4444;" onclick="resolveMerma('${item.id}', 'Baja', '${item.HerramientaId}', ${item.Cantidad})">
                        Dar Baja
                    </button>
                </div>
            `;
        }

        let badgeClass = 'warning'; // En Revision
        if (item.Estado === 'Recuperado') badgeClass = 'success';
        if (item.Estado === 'Baja') badgeClass = 'danger';

        return `
            <tr>
                <td>${formatDate(item.FechaReporte)}</td>
                <td>${toolName}</td>
                <td><strong>${item.Cantidad}</strong></td>
                <td>${item.Motivo}</td>
                <td><span class="badge ${badgeClass}">${item.Estado}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

// Actions

// CREATE TOOL
// CREATE TOOL (Optimistic)
// --- Unified Entry Workflow ---
function openEntryModal() {
    const form = document.getElementById('tool-form');
    form.reset();

    // Default to Existing
    document.querySelector('input[name="EntryType"][value="existing"]').checked = true;
    toggleEntryType();

    // Populate Select
    const select = document.getElementById('existing-tool-select');
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    if (state.data.tools) {
        state.data.tools.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.Nombre}</option>`;
        });
    }

    openModal('tool-modal');
}

window.toggleEntryType = function () {
    const type = document.querySelector('input[name="EntryType"]:checked').value;
    const existingSection = document.getElementById('section-existing');
    const newSection = document.getElementById('section-new');
    const fileInput = document.getElementById('tool-file-input');

    if (type === 'existing') {
        existingSection.classList.remove('hidden');
        newSection.classList.add('hidden');
        // Remove 'required' from new section inputs to avoid validation error
        document.querySelector('input[name="Nombre"]').removeAttribute('required');
        document.querySelector('input[name="StockTotal"]').removeAttribute('required');
        document.querySelector('input[name="CostoReposicion"]').removeAttribute('required');
        // Add required to existing
        document.getElementById('existing-tool-select').setAttribute('required', 'true');
        document.getElementById('entry-quantity').setAttribute('required', 'true');
    } else {
        existingSection.classList.add('hidden');
        newSection.classList.remove('hidden');
        // Add required to new section
        document.querySelector('input[name="Nombre"]').setAttribute('required', 'true');
        document.querySelector('input[name="StockTotal"]').setAttribute('required', 'true');
        document.querySelector('input[name="CostoReposicion"]').setAttribute('required', 'true');
        // Remove required from existing
        document.getElementById('existing-tool-select').removeAttribute('required');
        document.getElementById('entry-quantity').removeAttribute('required');
    }
}

// Tool Form Handler (Unified)
document.getElementById('tool-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const type = formData.get('EntryType');

    if (type === 'existing') {
        // --- ADD STOCK LOGIC ---
        const toolId = formData.get('ExistingToolId');
        const qty = parseInt(formData.get('EntryQuantity'));

        if (!toolId || isNaN(qty) || qty <= 0) return alert('Datos inválidos');

        const tool = state.data.tools.find(t => t.id === toolId);
        if (!tool) return alert('Herramienta no encontrada');

        // Optimistic Update
        tool.StockTotal = parseInt(tool.StockTotal) + qty;
        tool.StockDisponible = parseInt(tool.StockDisponible) + qty;
        renderTools(state.data.tools);
        closeModal('tool-modal');

        // Toast
        showToast(`Ingresando ${qty} und. de ${tool.Nombre}...`);

        // Background Sync using 'update' op
        try {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'update', table: 'Herramientas', userRole: state.user.role,
                    payload: { id: toolId, StockTotal: tool.StockTotal, StockDisponible: tool.StockDisponible }
                })
            });
            // LOG MOVEMENT
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                    payload: {
                        ToolId: tool.id, ToolName: tool.Nombre, Type: 'Ingreso (Stock)',
                        Quantity: qty, Reason: 'Ingreso Manual', User: state.user.username
                    }
                })
            });

            loadTools(true); // Silent reload to confirm
        } catch (e) {
            console.error(e);
            loadTools(); // Revert
            alert('Error al guardar ingreso.');

        }

    } else {
        // --- NEW TOOL LOGIC ---
        if (!formData.get('Nombre') || !formData.get('StockTotal')) return;

        const payload = Object.fromEntries(formData.entries());
        // Remove entry-specific fields from payload
        delete payload.EntryType;
        delete payload.ExistingToolId;
        delete payload.EntryQuantity;

        payload.StockDisponible = payload.StockTotal;

        // Temp ID
        const tempId = 'temp-' + Date.now();
        const optimisticTool = {
            id: tempId,
            ...payload,
            CostoReposicion: parseFloat(payload.CostoReposicion),
            StockTotal: parseInt(payload.StockTotal),
            StockDisponible: parseInt(payload.StockDisponible),
            FotoUrl: ''
        };

        state.data.tools = state.data.tools || [];
        state.data.tools.push(optimisticTool);
        renderTools(state.data.tools);

        closeModal('tool-modal');
        e.target.reset();

        showToast('Guardando nueva herramienta...');

        try {
            const fileInput = document.getElementById('tool-file-input');
            const file = fileInput.files[0];
            let fileUrl = '';

            if (file) {
                const base64 = await toBase64(file);
                const uploadResp = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'uploadFile',
                        module: 'inventory',
                        fileName: 'TOOL-' + file.name,
                        mimeType: file.type,
                        fileBase64: base64
                    })
                });
                const result = await uploadResp.json();
                if (result.status === 'success') fileUrl = result.fileUrl;
            }

            payload.FotoUrl = fileUrl;

            const response = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'db', op: 'create', table: 'Herramientas', userRole: state.user.role, payload: payload })
            });
            const res = await response.json();

            if (res.status === 'success') {
                // LOG MOVEMENT (Initial Stock)
                await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                        payload: {
                            ToolId: res.id || 'N/A', ToolName: payload.Nombre, Type: 'Ingreso (Nuevo)',
                            Quantity: payload.StockTotal, Reason: 'Creación de Item', User: state.user.username
                        }
                    })
                });
                loadTools(true);
            } else {
                console.error('Error:', res.message);
                state.data.tools = state.data.tools.filter(t => t.id !== tempId);
                renderTools(state.data.tools);
                alert('Error al guardar: ' + res.message);
            }
        } catch (e) {
            console.error(e);
            state.data.tools = state.data.tools.filter(t => t.id !== tempId);
            renderTools(state.data.tools);
            alert('Error de conexión.');
        }
    }
});

// History Logic
window.openHistoryModal = async function (toolId, toolName) {
    const tbody = document.getElementById('history-list');
    const title = document.querySelector('#history-modal .modal-title');
    if (toolName) title.textContent = `Historial: ${toolName}`;
    else title.textContent = 'Historial Global';

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando historial...</td></tr>';
    openModal('history-modal');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'db', op: 'read', table: 'Movimientos', userRole: state.user.role })
        });
        const res = await response.json();
        if (res.status === 'success' && res.data) {
            let sorted = res.data;
            if (toolId) sorted = sorted.filter(item => String(item.HerramientaId) === String(toolId));
            sorted.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

            if (sorted.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay movimientos registrados.</td></tr>';
                return;
            }

            tbody.innerHTML = sorted.map(item => `
                <tr>
                    <td>${formatDate(item.Fecha)}</td>
                    <td>${item.Herramienta || '-'}</td>
                    <td><span class="badge ${item.Tipo.includes('Ingreso') ? 'success' : 'warning'}">${item.Tipo}</span></td>
                    <td><strong>${item.Cantidad}</strong></td>
                    <td>${item.Motivo}</td>
                    <td>${item.Usuario}</td>
                </tr>
            `).join('');

        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No se pudo cargar el historial.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error de conexión.</td></tr>';
    }
}

// REPORT MERMA
// REPORT MERMA (Optimistic)
document.getElementById('merma-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const toolId = formData.get('HerramientaId');
    const systemStock = parseInt(document.getElementById('merma-system-stock').value);
    const physicalCount = parseInt(document.getElementById('merma-physical-count').value);
    const diff = physicalCount - systemStock;
    const qty = Math.abs(diff);

    if (diff === 0) {
        closeModal('merma-modal');
        return;
    }

    // 1. Optimistic Update
    const toolIndex = state.data.tools.findIndex(t => t.id === toolId);
    if (toolIndex !== -1) {
        state.data.tools[toolIndex].StockDisponible = physicalCount;
        renderTools(state.data.tools);
    }

    const mermaPayload = {
        HerramientaId: toolId,
        Cantidad: qty,
        Motivo: formData.get('Motivo'),
        Estado: 'En Revision',
        FechaReporte: new Date().toISOString()
    };

    if (diff < 0) {
        state.data.mermas = state.data.mermas || [];
        state.data.mermas.push({ id: 'temp-' + Date.now(), ...mermaPayload });
        renderMermas(state.data.mermas);
    }

    closeModal('merma-modal');
    e.target.reset();

    // 2. Background Sync
    try {
        if (diff < 0) {
            // Deficit
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'db', op: 'create', table: 'Mermas', userRole: state.user.role, payload: mermaPayload })
            });
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'db', op: 'update', table: 'Herramientas', userRole: state.user.role, payload: { id: toolId, StockDisponible: physicalCount } })
            });
            // LOG MOVEMENT (Deficit)
            const tool = state.data.tools.find(t => t.id === toolId);
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                    payload: {
                        ToolId: toolId, ToolName: tool ? tool.Nombre : '?', Type: 'Ajuste (Deficit)',
                        Quantity: qty, Reason: `Auditoría: ${formData.get('Motivo')}`, User: state.user.username
                    }
                })
            });

        } else {
            // Surplus
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'db', op: 'update', table: 'Herramientas', userRole: state.user.role, payload: { id: toolId, StockDisponible: physicalCount } })
            });
            // LOG MOVEMENT (Surplus)
            const tool = state.data.tools.find(t => t.id === toolId);
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                    payload: {
                        ToolId: toolId, ToolName: tool ? tool.Nombre : '?', Type: 'Ajuste (Excedente)',
                        Quantity: qty, Reason: `Auditoría: ${formData.get('Motivo')}`, User: state.user.username
                    }
                })
            });
        }
        loadTools(true);
        loadMermas(true);
    } catch (e) {
        console.error(e);
        loadTools(); // Revert
        loadMermas();
        alert('Error de sincronización.');
    }
});

// RESOLVE MERMA
// RESOLVE MERMA (Optimistic)
window.resolveMerma = async function (mermaId, action, toolId, totalQty) {
    let qtyToProcess = totalQty;

    if (action === 'Recuperar') {
        const input = prompt(`Cantidad a recuperar (Máximo: ${totalQty}):`, totalQty);
        if (input === null) return;
        qtyToProcess = parseInt(input);
        if (isNaN(qtyToProcess) || qtyToProcess <= 0 || qtyToProcess > totalQty) {
            alert("Cantidad inválida.");
            return;
        }
    } else {
        if (!confirm(`¿Confirmar Dar de Baja a ${totalQty} items?`)) return;
    }

    // 1. Optimistic Update
    const mermaIndex = state.data.mermas.findIndex(m => m.id === mermaId);
    if (mermaIndex !== -1) {
        state.data.mermas[mermaIndex].Estado = action === 'Recuperar' ? 'Recuperado' : 'Baja';
    }
    renderMermas(state.data.mermas);

    const toolIndex = state.data.tools.findIndex(t => t.id === toolId);
    if (toolIndex !== -1 && action === 'Recuperar') {
        state.data.tools[toolIndex].StockDisponible = parseInt(state.data.tools[toolIndex].StockDisponible) + qtyToProcess;
        renderTools(state.data.tools);
    } else if (toolIndex !== -1) {
        state.data.tools[toolIndex].StockTotal = parseInt(state.data.tools[toolIndex].StockTotal) - qtyToProcess;
        renderTools(state.data.tools);
    }

    // 2. Background Sync
    try {
        const remainingQty = totalQty - qtyToProcess;
        const newStatus = action === 'Recuperar' ? 'Recuperado' : 'Baja';

        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db', op: 'update', table: 'Mermas', userRole: state.user.role,
                payload: { id: mermaId, Estado: newStatus, Cantidad: qtyToProcess }
            })
        });

        if (remainingQty > 0) {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'create', table: 'Mermas', userRole: state.user.role,
                    payload: {
                        HerramientaId: toolId,
                        Cantidad: remainingQty,
                        Motivo: 'Remanente de merma parcial',
                        Estado: 'En Revision',
                        FechaReporte: new Date().toISOString()
                    }
                })
            });
        }

        const tool = state.data.tools.find(t => t.id === toolId);
        if (action === 'Recuperar') {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'update', table: 'Herramientas', userRole: state.user.role,
                    payload: { id: toolId, StockDisponible: tool.StockDisponible }
                })
            });
            // LOG MOVEMENT (Recovery)
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                    payload: {
                        ToolId: toolId, ToolName: tool ? tool.Nombre : '?', Type: 'Reingreso (Recuperado)',
                        Quantity: qtyToProcess, Reason: 'Recuperación de Merma', User: state.user.username
                    }
                })
            });

        } else {
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'update', table: 'Herramientas', userRole: state.user.role,
                    payload: { id: toolId, StockTotal: tool.StockTotal }
                })
            });
            // LOG MOVEMENT (Write-off)
            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'db', op: 'logMovement', table: 'Movimientos', userRole: state.user.role,
                    payload: {
                        ToolId: toolId, ToolName: tool ? tool.Nombre : '?', Type: 'Salida (Baja)',
                        Quantity: qtyToProcess, Reason: 'Baja Definitiva', User: state.user.username
                    }
                })
            });
        }

        loadTools(true);
        loadMermas(true);

    } catch (e) {
        console.error(e);
        loadTools();
        loadMermas();
        alert('Error de sincronización.');
    }
};

// --- Operations Module Logic ---

async function loadOperations(silent = false) {
    const container = document.getElementById('operations-list');

    // Cache render
    if (!silent && state.data.operations) {
        renderOperations(state.data.operations);
    } else if (!silent) {
        container.innerHTML = '<div class="text-center">Cargando operaciones...</div>';
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Operaciones',
                userRole: state.user.role
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            state.data.operations = res.data;
            renderOperations(res.data);

            // Update Active Count
            const active = res.data.filter(o => o.Estado !== 'Cerrado').length;
            const personnel = res.data.reduce((acc, curr) => acc + (parseInt(curr.Personal) || 0), 0);

            if (document.getElementById('op-active-count')) {
                document.getElementById('op-active-count').textContent = active;
                document.getElementById('op-personnel-count').textContent = personnel;
            }

        } else if (!silent) {
            container.innerHTML = '<div class="text-center">No hay operaciones activas.</div>';
        }
    } catch (e) {
        console.error(e);
        if (!silent) container.innerHTML = '<div class="text-center warning">Error al cargar.</div>';
    }
}

function renderOperations(data) {
    const container = document.getElementById('operations-list');
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-center">No hay operaciones.</div>';
        return;
    }

    // Sort by Date Desc
    const sorted = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = sorted.map(op => `
        <div class="service-card" onclick="viewOperation('${op.id}')" style="cursor:pointer;">
            <div class="service-header">
                <div>
                    <h3>${op.Nombre}</h3>
                    <small class="text-muted">${op.Codigo || 'Sin Código'}</small>
                </div>
                <span class="badge ${op.Estado === 'Cerrado' ? '' : 'warning'}">${op.Estado || 'En Progreso'}</span>
            </div>
            <div class="service-body">
                <p><strong>Tipo:</strong> ${op.Tipo}</p>
                <div style="display:flex; justify-content:space-between; margin-top:0.5rem;">
                    <span><i class="ph ph-users"></i> ${op.Personal || 0} pax</span>
                    <span><i class="ph ph-calendar"></i> ${formatDate(op.timestamp)}</span>
                </div>
            </div>
            <div class="service-footer">
                <button class="btn btn-sm btn-outline">Ver Panel</button>
            </div>
        </div>
    `).join('');
}

function viewOperation(id) {
    const op = state.data.operations.find(o => o.id === id);
    if (!op) return;

    state.activeOperation = op;

    // Fill Details
    document.getElementById('op-detail-title').textContent = op.Nombre;
    document.getElementById('op-detail-subtitle').textContent = `Código: ${op.Codigo} | Inicio: ${formatDate(op.timestamp)}`;
    document.getElementById('op-detail-status').textContent = op.Estado;

    // Render Stepper
    renderOpStepper(op.Etapa || 'Inicio');

    // Personnel Count Update
    // Can calculate from active shifts
    if (document.getElementById('op-active-personnel-count')) {
        // This needs async data, ideally we already have it or fetch it.
        // For now, simple placeholder or fetch
        // loadOpPersonnel(op.id); // This updates table, maybe simple count too?
    }

    // Load Op Expenses (Filter from global expenses or fetch specific?)
    // Basic approach: Filter global expenses by operationId.
    // If we haven't loaded expenses yet, we should.
    if (!state.data.expenses) loadExpenses(true);

    renderOpExpenses(op.id);

    // Default Tab
    const tab = 'overview';

    // Switch View
    switchView('operation-details-view');

    // UI State
    const buttons = document.querySelectorAll('.tabs-nav .tab-btn');
    buttons.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    if (tab === 'overview') buttons[0].classList.add('active');

    document.getElementById(`tab-op-${tab}`).classList.remove('hidden');

    renderOpExpenses(op.id);
    if (state.data.personnel) loadOpPersonnel(op.id);
}

function renderOpExpenses(opId) {
    const tbody = document.getElementById('op-expenses-list');
    const expenses = (state.data.expenses || []).filter(e => e.operationId === opId);

    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay gastos en caja chica para esta operación.</td></tr>';
        return;
    }

    tbody.innerHTML = expenses.map(e => `
        <tr>
             <td>${formatDate(e.Fecha)}</td>
             <td>${e.Categoria} - ${e.Proveedor}</td>
             <td>S/ ${parseFloat(e.Monto).toFixed(2)}</td>
             <td><span class="badge ${e.Estado === 'Aprobado' ? 'success' : 'warning'}">${e.Estado || 'Pendiente'}</span></td>
        </tr>
    `).join('');
}


// Populate Service Select when opening Modal
// Populate Service Select when opening Modal
// Populate Service Select when opening Modal
function openOperationModal() {
    document.getElementById('operation-modal').classList.remove('hidden');

    // 1. Services
    const select = document.getElementById('op-service-select');
    if (select) {
        if (state.data.services) {
            select.innerHTML = state.data.services.map(s => `<option value="${s.Nombre}">${s.Nombre}</option>`).join('');
        } else {
            select.innerHTML = '<option>Cargando servicios...</option>';
            loadServices().then(() => {
                if (!document.getElementById('operation-modal').classList.contains('hidden')) {
                    const s = document.getElementById('op-service-select');
                    if (s && state.data.services) {
                        s.innerHTML = state.data.services.map(o => `<option value="${o.Nombre}">${o.Nombre}</option>`).join('');
                    }
                }
            });
        }
    }

    // 2. Supervisors
    const supSelect = document.getElementById('op-supervisor-select');
    if (supSelect) {
        // Ensure personnel is loaded
        if (!state.data.personnel) {
            supSelect.innerHTML = '<option>Cargando...</option>';
            loadPersonnel(true).then(() => openOperationModal());
            return;
        }

        const supervisors = (state.data.personnel || []).filter(p => p.RolDefault === 'Supervisor' || p.RolDefault === 'Jefe de Riesgos');

        if (supervisors.length > 0) {
            supSelect.innerHTML = supervisors.map(s => `<option value="${s.Nombres} ${s.Apellidos}|${s.id}">${s.Nombres} ${s.Apellidos}</option>`).join('');
        } else {
            supSelect.innerHTML = '<option value="">No hay supervisores registrados</option>';
        }
    }
}

// --- Personnel Module Logic ---

async function loadPersonnel(silent = false) {
    const tbody = document.getElementById('personnel-list'); // Table body
    if (!silent && state.data.personnel) {
        renderPersonnel(state.data.personnel);
    } else if (!silent && tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando personal...</td></tr>';
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Personal',
                userRole: state.user.role
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            state.data.personnel = res.data;
            if (tbody) renderPersonnel(res.data);
        } else {
            if (tbody && !silent) tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay personal registrado.</td></tr>';
        }
    } catch (e) {
        console.error(e);
    }
}

function renderPersonnel(data) {
    const tbody = document.getElementById('personnel-list');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay personal registrado.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>
                <strong>${p.Nombres} ${p.Apellidos || ''}</strong><br>
                <small class="text-muted">${p.DNI || '-'}</small>
            </td>
            <td>${p.RolDefault || 'Operador'}</td>
            <td>${p.Telefono || '-'}</td>
            <td>
                ${p.CertificadoUrl ? `<a href="${p.CertificadoUrl}" target="_blank" class="badge">PDF</a>` : '<span class="text-muted">-</span>'}
            </td>
            <td>
                 <span class="badge ${p.Estado === 'Apto' ? 'success' : 'danger'}">${p.Estado || 'Apto'}</span>
            </td>
            <td>
                <button class="action-btn" onclick="editPersonnel('${p.id}')"><i class="ph ph-pencil"></i></button>
            </td>
        </tr>
    `).join('');
}

function openPersonnelModal() {
    document.getElementById('personnel-modal').classList.remove('hidden');
}

// Personnel Form Submit
document.getElementById('personnel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    const formData = new FormData(e.target);
    const fileInput = document.getElementById('personnel-file-input');
    const file = fileInput.files[0];

    try {
        let fileUrl = '';
        if (file) {
            const base64 = await toBase64(file);
            const uploadResp = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadFile', // Reuse generic upload
                    module: 'finances', // Using finances bucket for now
                    fileName: 'DOC-' + file.name,
                    mimeType: file.type,
                    fileBase64: base64
                })
            });
            const res = await uploadResp.json();
            if (res.status === 'success') fileUrl = res.fileUrl;
        }

        const payload = Object.fromEntries(formData.entries());
        if (fileUrl) payload.CertificadoUrl = fileUrl;

        // Checkboxes to Boolean
        payload.IncluyeViaticos = payload.IncluyeViaticos === 'on';
        payload.IncluyeTraslado = payload.IncluyeTraslado === 'on';

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create', // TODO: Handle Edit/Update
                table: 'Personal',
                userRole: state.user.role,
                payload: payload
            })
        });

        const res = await response.json();
        if (res.status === 'success') {
            alert('Personal registrado');
            closeModal('personnel-modal');
            e.target.reset();
            loadPersonnel();
        } else {
            alert(res.message);
        }

    } catch (e) {
        console.error(e);
        alert('Error al guardar');
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Personal";
    }
});

// --- Operation Personnel Assignment Logic ---

function openAssignModal() {
    document.getElementById('assign-modal').classList.remove('hidden');

    // Populate Select
    const select = document.getElementById('assign-personnel-select');
    // Filter only Aptos
    const aptos = (state.data.personnel || []).filter(p => p.Estado === 'Apto');
    select.innerHTML = aptos.map(p => `<option value="${p.id}">${p.Nombres} ${p.Apellidos} (${p.RolDefault})</option>`).join('');
}

document.getElementById('assign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeOperation) return;

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Add Link Data
    payload.operationId = state.activeOperation.id;
    // Find Personnel Data to Snapshot roles? Or just link ID
    // We link ID.

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create',
                table: 'Operacion_Personal',
                userRole: state.user.role,
                payload: payload
            })
        });
        alert('Personal agregado a la operación');
        closeModal('assign-modal');
        loadOpPersonnel(state.activeOperation.id);
        alert('Personal agregado a la operación');
        closeModal('assign-modal');
        loadOpPersonnel(state.activeOperation.id);
    } catch (e) {
        alert('Error al asignar');
    }
});

// Stepper Logic
function renderOpStepper(currentStage) {
    const steps = ['Inicio', 'Ejecucion', 'Finalizacion', 'Cerrado'];
    const currentIndex = steps.indexOf(currentStage);

    document.querySelectorAll('.step-item').forEach((item, index) => {
        item.classList.remove('active', 'completed');
        if (index < currentIndex) item.classList.add('completed');
        if (index === currentIndex) item.classList.add('active');
    });
}

window.updateOpStage = async function (newStage) {
    if (!state.activeOperation) return;

    if (!confirm(`¿Cambiar etapa a ${newStage}?`)) return;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'update',
                table: 'Operaciones',
                userRole: state.user.role,
                payload: { id: state.activeOperation.id, Etapa: newStage }
            })
        });

        state.activeOperation.Etapa = newStage;
        renderOpStepper(newStage);

        if (newStage === 'Cerrado') {
            state.activeOperation.Estado = 'Cerrado';
            document.getElementById('op-detail-status').textContent = 'Cerrado';
            // Also update main list
            loadOperations(true);
        }

    } catch (e) {
        console.error(e);
        alert('Error al actualizar etapa');
    }
};

async function loadOpPersonnel(opId) {
    const tbody = document.getElementById('op-personnel-list');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando turnos...</td></tr>';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'read',
                table: 'Operacion_Personal',
                userRole: state.user.role
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            const opTeam = res.data.filter(Link => Link.operationId === opId);

            // Update Active Count
            const activeCount = opTeam.filter(t => t.Estado === 'Activo').length;
            if (document.getElementById('op-active-personnel-count')) {
                document.getElementById('op-active-personnel-count').textContent = activeCount;
            }

            renderOpPersonnel(opTeam);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sin registros.</td></tr>';
        }

    } catch (e) {
        console.error(e);
    }
}

function renderOpPersonnel(links) {
    const tbody = document.getElementById('op-personnel-list');
    if (links.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Sin registros.</td></tr>';
        return;
    }

    const fullList = links.map(link => {
        const p = (state.data.personnel || []).find(x => x.id === link.personalId);
        return { link, personnel: p || { Nombres: 'Desconocido', Apellidos: '' } };
    });

    tbody.innerHTML = fullList.map(item => {
        // Calculate Hours if Exit exists
        let hours = '-';
        if (item.link.HoraIngreso && item.link.HoraSalida) {
            // Simple parsing assuming 'HH:MM' 24h format
            // In a real app, use full Date objects or a library
            // Here assuming same day or next day handling is handled by manual input or server
            // For MVP, just display raw or diff if possible. User likely inputs this.
            hours = item.link.TotalHoras || '?';
        }

        return `
        <tr>
            <td>
                <strong>${item.personnel.Nombres} ${item.personnel.Apellidos}</strong><br>
                <small class="text-muted">${item.personnel.RolDefault}</small>
            </td>
            <td>${item.link.RolAsignado || '-'}</td>
            <td>${item.link.HoraIngreso || '-'}</td>
            <td>${item.link.HoraSalida || '<span class="text-muted">En turno</span>'}</td>
            <td>${item.link.TotalHoras || '-'}</td>
            <td>
                <span class="badge ${item.link.Estado === 'Liquidado' ? 'success' : (item.link.Estado === 'Activo' ? 'primary' : 'warning')}">
                    ${item.link.Estado || 'Activo'}
                </span>
            </td>
            <td>
                ${item.link.Estado === 'Activo' ?
                `<button class="btn btn-sm btn-outline warning" onclick="registerExit('${item.link.id}')">Marcar Salida</button>`
                : ''}
                ${item.link.Estado === 'Terminado' ?
                `<button class="btn btn-sm btn-outline success" onclick="openLiquidationModal('${item.link.id}', '${item.personnel.Nombres} ${item.personnel.Apellidos}', '${item.personnel.PagoDiario}', '${item.personnel.Moneda}')">Liquidar</button>`
                : ''}
                 ${item.link.Estado === 'Liquidado' ?
                `<strong>${item.personnel.Moneda || 'S/'} ${item.link.CostoFinal}</strong>` : ''}
            </td>
        </tr>
    `}).join('');
}

window.registerExit = async function (linkId) {
    const exitTime = prompt("Ingrese Hora Salida (HH:MM):", new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (!exitTime) return;

    // Ask for Total Hours (Manual override for accuracy)
    const totalHours = prompt("Total Horas Trabajadas (Calculado):", "8");
    if (!totalHours) return;

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'update',
                table: 'Operacion_Personal',
                userRole: state.user.role,
                payload: {
                    id: linkId,
                    HoraSalida: exitTime,
                    TotalHoras: totalHours,
                    Estado: 'Terminado' // Ready for Liquidation
                }
            })
        });
        alert('Salida registrada. Pendiente de liquidación.');
        loadOpPersonnel(state.activeOperation.id);
    } catch (e) {
        alert('Error al registrar salida');
    }
};

// Liquidation Logic
window.openLiquidationModal = function (linkId, name, rate, currency) {
    document.getElementById('liquidation-modal').classList.remove('hidden');
    document.getElementById('liq-link-id').value = linkId;
    document.getElementById('liq-name').value = name;

    const dailyRate = parseFloat(rate) || 0;
    document.getElementById('liq-daily-rate').value = dailyRate;
    document.getElementById('liq-rate-display').value = `${currency || 'S/'} ${dailyRate}`;

    // Reset defaults
    document.getElementById('liq-days').value = 1;
    document.getElementById('liq-bonus').value = 0;
    document.getElementById('liq-discount').value = 0;
    calculateLiquidationTotal();
};

window.calculateLiquidationTotal = function () {
    const rate = parseFloat(document.getElementById('liq-daily-rate').value) || 0;
    const days = parseFloat(document.getElementById('liq-days').value) || 0;
    const bonus = parseFloat(document.getElementById('liq-bonus').value) || 0;
    const discount = parseFloat(document.getElementById('liq-discount').value) || 0;

    const total = (rate * days) + bonus - discount;
    document.getElementById('liq-total').value = total.toFixed(2);
};

document.getElementById('liquidation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeOperation) return;

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Status update
    payload.Estado = 'Liquidado';
    // ID is payload.linkId, we need to map it to 'id' for update
    payload.id = payload.linkId;
    delete payload.linkId; // cleanup

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'update',
                table: 'Operacion_Personal',
                userRole: state.user.role,
                payload: payload
            })
        });
        alert('Personal liquidado correctamente');
        closeModal('liquidation-modal');
        loadOpPersonnel(state.activeOperation.id);
    } catch (e) {
        alert('Error al liquidar');
    }
});


document.getElementById('operation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Creando...";

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Handle Supervisor Split "Name|ID"
    let supervisorId = null;
    if (payload.Supervisor && payload.Supervisor.includes('|')) {
        const parts = payload.Supervisor.split('|');
        payload.Supervisor = parts[0]; // Validation Name
        supervisorId = parts[1];
    }

    try {
        // 1. Create Operation
        const resp = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create',
                table: 'Operaciones',
                userRole: state.user.role,
                payload: payload
            })
        });
        const res = await resp.json();

        if (res.status === 'success') {
            const opId = res.id;

            // 2. Auto-Assign Supervisor
            if (supervisorId) {
                await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'db',
                        op: 'create',
                        table: 'Operacion_Personal',
                        userRole: state.user.role,
                        payload: {
                            operationId: opId,
                            personalId: supervisorId,
                            RolAsignado: 'Supervisor',
                            HoraIngreso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            Estado: 'Activo'
                        }
                    })
                });
            }

            alert('Operación creada correctamente');
            closeModal('operation-modal');
            e.target.reset();
            loadOperations();
        } else {
            alert(res.message);
        }
    } catch (e) {
        console.error(e);
        alert('Error al crear operación');
    } finally {
        btn.disabled = false;
        btn.innerText = "Crear Operación";
    }
});

function switchOpTab(tab) {
    document.querySelectorAll('#operation-details-view .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#operation-details-view .tab-content').forEach(c => c.classList.add('hidden'));

    // Find button (hacky, assumes order or text)
    // Better to pass 'event' or use ID
    // Lets just iterate buttons and match onclick text
    const buttons = document.querySelectorAll('#operation-details-view .tab-btn');
    if (tab === 'overview') buttons[0].classList.add('active');
    if (tab === 'expenses') buttons[1].classList.add('active');

    document.getElementById(`tab-op-${tab}`).classList.remove('hidden');

    if (tab === 'expenses' && state.activeOperation) {
        renderOpExpenses(state.activeOperation.id);
    }
}

// Update Op Data
async function updateOpStage() {
    if (!state.activeOperation) return;
    const newVal = document.getElementById('op-stage-select').value;
    await updateOpField('Etapa', newVal);
}

async function updateOpPersonnel() {
    if (!state.activeOperation) return;
    const newVal = document.getElementById('op-personnel-input').value;
    await updateOpField('Personal', newVal);
}

async function updateOpField(field, value) {
    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'update',
                table: 'Operaciones',
                userRole: state.user.role,
                payload: { id: state.activeOperation.id, [field]: value }
            })
        });
        // Update local state
        state.activeOperation[field] = value;
        // Optionally reload list
        loadOperations(true);
        alert('Actualizado');
    } catch (e) {
        alert('Error al actualizar');
    }
}

// Op Expense Logic
function openOpExpenseModal() {
    // Reuse existing expense modal but mark it as linked to OP
    openExpenseModal();
    // Inject hidden field if it doesn't exist
    let form = document.getElementById('expense-form');
    let hidden = form.querySelector('input[name="operationId"]');
    if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'operationId';
        form.appendChild(hidden);
    }
    hidden.value = state.activeOperation.id;
}

// Helper: Clear opId when opening generic expense modal (from Finances view)
const _origOpenExpenseModal = openExpenseModal;
openExpenseModal = function () {
    _origOpenExpenseModal();
    // Check if we are in Finances View -> Clear operationId
    if (state.currentView !== 'operation-details-view') {
        const form = document.getElementById('expense-form');
        const hidden = form.querySelector('input[name="operationId"]');
        if (hidden) hidden.value = '';
    }
};
