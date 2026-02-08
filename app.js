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
        services: null
    },
    lastUpdated: {
        expenses: null,
        income: null,
        services: null
    },
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

    // Start Background Polling (Every 60s)
    const intervalId = setInterval(() => {
        console.log('Syncing data in background...');
        loadExpenses(true);
        loadIncome(true);
        loadServices(true);
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
    state.data = { expenses: null, income: null, services: null }; // Clear Cache
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
document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "Guardando...";

    const formData = new FormData(e.target);
    const fileInput = document.getElementById('service-file-input');
    const file = fileInput.files[0];

    // Optimistic UI
    // (We could implement optimistic rendering here like expenses if desired, 
    // but for catalog items, a small wait is usually acceptable. Let's do simple wait for now)

    try {
        let fileUrl = '';

        // 1. Upload Photo if exists
        if (file) {
            const base64 = await toBase64(file);
            const uploadResp = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadInvoice', // Reusing upload logic (stores in Finance folder, maybe we should change folder but ok for now)
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

        // 2. Save to DB
        const payload = Object.fromEntries(formData.entries());
        payload.FotoUrl = fileUrl;

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'db',
                op: 'create',
                table: 'Servicios',
                userRole: state.user.role,
                payload: payload
            })
        });

        const res = await response.json();

        if (res.status === 'success') {
            alert('Servicio creado correctamente');
            closeModal('service-modal');
            e.target.reset();
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
                    ${item.fileUrl ? `<a href="${item.fileUrl}" target="_blank" class="action-btn"><i class="ph ph-file-pdf"></i> Ver</a>` : '<span class="text-muted">-</span>'}
            </td>
            <td>
                <button class="action-btn text-danger" onclick="deleteExpense('${item.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
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
        let imgUrl = item.FotoUrl;
        if (!imgUrl || imgUrl.trim() === '') {
            // Using UI Avatars for a clean default if no image
            const name = encodeURIComponent(item.Nombre.substring(0, 20));
            imgUrl = `https://ui-avatars.com/api/?name=${name}&background=0a192f&color=64ffda&size=400&font-size=0.33&length=2`;
        }

        return `
            <div class="service-card" onclick="this.classList.toggle('flipped')">
                <div class="card-inner">
                    <!-- Front -->
                    <div class="card-front">
                        <img src="${imgUrl}" alt="${item.Nombre}" class="card-img">
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
