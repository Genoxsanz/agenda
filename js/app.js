const STORAGE_KEY = 'agendapro_session';

const loginForm = document.getElementById('loginForm');
const usuarioInput = document.getElementById('usuario');
const claveInput = document.getElementById('clave');
const dispositivoInput = document.getElementById('dispositivo');
const empresaBlock = document.getElementById('empresaBlock');
const empresaSelect = document.getElementById('empresaSelect');
const btnLogin = document.getElementById('btnLogin');
const loginAlert = document.getElementById('loginAlert');

function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSelectedEmpresaId() {
  const value = empresaSelect.value;
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function showAlert(message, type = 'error') {
  loginAlert.innerHTML = `<div class="alert alert-${type === 'success' ? 'success' : 'error'}">${escapeHtml(message)}</div>`;
}

function clearAlert() {
  loginAlert.innerHTML = '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setLoading(isLoading) {
  btnLogin.disabled = isLoading;
  btnLogin.textContent = isLoading ? 'Ingresando...' : 'Iniciar sesión';
}

function fillEmpresas(empresas) {
  empresaSelect.innerHTML = empresas.map(item => `
    <option value="${escapeHtml(item.id_empresa)}">
      ${escapeHtml(item.nombre_empresa)}${item.rol ? ` · ${escapeHtml(item.rol)}` : ''}
    </option>
  `).join('');
}

async function apiLogin({ usuario, clave, dispositivo, id_empresa = null }) {
  const payload = {
    correo_usuario: usuario,
    clave_usuario: clave,
    dispositivo,
  };

  if (id_empresa !== null) {
    payload.id_empresa = id_empresa;
  }

  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;

    if (typeof detail === 'string') {
      throw new Error(detail);
    }

    if (detail?.message && Array.isArray(detail?.empresas_disponibles)) {
      const err = new Error(detail.message);
      err.empresas_disponibles = detail.empresas_disponibles;
      throw err;
    }

    if (detail?.message) {
      throw new Error(detail.message);
    }

    if (data?.message) {
      throw new Error(data.message);
    }

    throw new Error(`Error HTTP ${response.status}`);
  }

  return data;
}

async function tryLogin() {
  clearAlert();

  const usuario = usuarioInput.value.trim();
  const clave = claveInput.value;
  const dispositivo = dispositivoInput.value.trim() || 'Panel Web AgendaPro';
  const id_empresa = empresaBlock.classList.contains('d-none') ? null : getSelectedEmpresaId();

  if (!usuario || !clave) {
    showAlert('Completá el usuario y la clave.');
    return;
  }

  if (!empresaBlock.classList.contains('d-none') && !id_empresa) {
    showAlert('Seleccioná una empresa.');
    return;
  }

  setLoading(true);

  try {
    const data = await apiLogin({
      usuario,
      clave,
      dispositivo,
      id_empresa,
    });

    saveSession({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_at: data.expires_at,
      idle_expires_at: data.idle_expires_at,
      session_id: data.session_id,
      id_usuario: data.user?.id_usuario,
      nombre_usuario: data.user?.nombre_usuario,
      correo_usuario: data.user?.correo_usuario,
      id_empresa: data.empresa?.id_empresa,
      nombre_empresa: data.empresa?.nombre_empresa,
      rol: data.rol,
    });

    showAlert('Inicio de sesión correcto.', 'success');

    setTimeout(() => {
      window.location.href = './panel.html';
    }, 400);
  } catch (error) {
    if (Array.isArray(error.empresas_disponibles) && error.empresas_disponibles.length) {
      fillEmpresas(error.empresas_disponibles);
      empresaBlock.classList.remove('d-none');
      showAlert('Este usuario pertenece a varias empresas. Seleccioná una para continuar.');
      return;
    }

    showAlert(error.message || 'No se pudo iniciar sesión.');
  } finally {
    setLoading(false);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await tryLogin();
});
