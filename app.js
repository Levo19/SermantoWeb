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
const API_URL = 'https://script.google.com/macros/s/AKfycby_vohLJZz_9-M6DukKcQ2HnqZoCMee2Xoj2wrlXWNbZwilsvebylhnVHLKMSpVpsH7qg/exec';

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
        switchView('dashboard');
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
    switchView('dashboard');
}

function switchView(viewName) {
    // Hide all
    Object.values(views).forEach(el => el.classList.add('hidden'));

    // Show target
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        state.currentView = viewName;
    }
}
