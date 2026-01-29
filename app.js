/**
 * Sermanto ERP - Main Logic
 */

// State
const state = {
    user: null,
    currentView: 'auth'
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
        switchView('dashboard');
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

function loginUser(user) {
    state.user = user;
    localStorage.setItem('sermanto_user', JSON.stringify(user));
    renderUserNav(); // Show/Hide links
    switchView('dashboard');
}

function renderUserNav() {
    const header = document.querySelector('.app-header');
    let nav = header.querySelector('.nav-links');

    if (!nav) {
        nav = document.createElement('nav');
        nav.className = 'nav-links';
        // Insert after brand
        const brand = header.querySelector('.brand-logo');
        brand.after(nav);
    }

    nav.innerHTML = `
        <a class="nav-link" onclick="switchView('dashboard')">Finanzas</a>
    `;

    // Admin/Superadmin Check
    if (state.user && ['admin', 'superadmin'].includes(state.user.role)) {
        nav.innerHTML += `
            <a class="nav-link" onclick="loadUsers()">Usuarios</a>
        `;
    }

    // Logout Button (Profile)
    const profile = document.getElementById('user-profile');
    if (state.user) {
        profile.classList.remove('hidden');
        profile.innerHTML = `<button class="btn-icon" onclick="logout()"><i class="ph ph-sign-out"></i></button>`;
    }
}

function logout() {
    state.user = null;
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
}
