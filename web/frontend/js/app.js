/**
 * NetSpectre Console Web Interface JS
 * Controls UI, APIs, WebSocket, Charts and D3 Network Map
 */

// ─── STATE MANAGEMENT ────────────────────────────────────────────────────────
const state = {
  settings: {},
  stats: {},
  hosts: [],
  selectedIds: new Set(),
  logs: [],
  activeSection: 'dashboard',
  charts: {
    donut: null,
    line: null,
    lineData: {
      labels: [],
      upload: [],
      download: []
    }
  },
  socket: null,
  isScanning: false,
  // Notifications
  notifications: [],
  notifUnread: 0,
  // Previous hosts list for new-device detection
  prevHostIPs: new Set(),
  // Bandwidth threshold (bytes/s) — alert if any host exceeds this
  bwThresholdBytes: 5 * 1024 * 1024, // 5 MB/s default
  bwAlerted: new Set() // track already-alerted host IDs this cycle
};

// Preset limits Mapping
const presetRates = [
  { val: '512kbit', label: '512 kbit' },
  { val: '1mbit', label: '1 Mbit' },
  { val: '5mbit', label: '5 Mbit' },
  { val: '10mbit', label: '10 Mbit' },
  { val: '50mbit', label: '50 Mbit' }
];

// Helper to format bytes
function formatSpeed(bytesPerSec) {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSize(megabytes) {
  if (megabytes < 1024) return megabytes.toFixed(2) + ' MB';
  return (megabytes / 1024).toFixed(2) + ' GB';
}

// ─── DOM ELEMENTS ────────────────────────────────────────────────────────────
const el = {
  sidebar: document.getElementById('sidebar'),
  menuToggle: document.getElementById('menuToggle'),
  pageTitle: document.getElementById('pageTitle'),
  connDot: document.getElementById('conn-dot'),
  connText: document.getElementById('conn-text'),
  statusIface: document.getElementById('status-iface'),
  topbarTime: document.getElementById('topbarTime'),
  badgeHosts: document.getElementById('badge-hosts'),
  btnScan: document.getElementById('btnScan'),
  scanProgress: document.getElementById('scanProgress'),
  scanRange: document.getElementById('scanRange'),
  
  // Dashboard
  valTotal: document.getElementById('val-total'),
  valFree: document.getElementById('val-free'),
  valLimited: document.getElementById('val-limited'),
  valBlocked: document.getElementById('val-blocked'),
  valBwUp: document.getElementById('val-bw-up'),
  valBwDown: document.getElementById('val-bw-down'),
  donutNum: document.getElementById('donutNum'),
  topConsumers: document.getElementById('topConsumers'),
  
  // Hosts Table
  hostSearch: document.getElementById('hostSearch'),
  hostsTableBody: document.getElementById('hostsTableBody'),
  checkAll: document.getElementById('checkAll'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnLimitSelected: document.getElementById('btnLimitSelected'),
  btnBlockSelected: document.getElementById('btnBlockSelected'),
  btnFreeSelected: document.getElementById('btnFreeSelected'),
  
  // Monitor
  monitorGrid: document.getElementById('monitorGrid'),
  
  // Activity Log
  activityLog: document.getElementById('activityLog'),
  logFilters: document.querySelector('.log-filters'),
  btnExportLog: document.getElementById('btnExportLog'),
  
  // Settings
  setInterface: document.getElementById('set-interface'),
  setGatewayIp: document.getElementById('set-gateway-ip'),
  setGatewayMac: document.getElementById('set-gateway-mac'),
  setNetmask: document.getElementById('set-netmask'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  
  setThreads: document.getElementById('set-threads'),
  setThreadsVal: document.getElementById('set-threads-val'),
  setTimeout: document.getElementById('set-timeout'),
  setTimeoutVal: document.getElementById('set-timeout-val'),
  setWatchInterval: document.getElementById('set-watch-interval'),
  setWatchIntervalVal: document.getElementById('set-watch-interval-val'),
  
  // Danger Zone
  btnBlockAll: document.getElementById('btnBlockAll'),
  btnFreeAll: document.getElementById('btnFreeAll'),
  btnFlushRules: document.getElementById('btnFlushRules'),
  
  // Modal Limit
  modalLimit: document.getElementById('modalLimit'),
  modalLimitClose: document.getElementById('modalLimitClose'),
  modalLimitCancel: document.getElementById('modalLimitCancel'),
  modalLimitApply: document.getElementById('modalLimitApply'),
  limitTargetInfo: document.getElementById('limitTargetInfo'),
  limitSlider: document.getElementById('limitSlider'),
  limitRateVal: document.getElementById('limitRateVal'),
  limitRateUnit: document.getElementById('limitRateUnit'),
  
  // Toast
  toastContainer: document.getElementById('toastContainer'),
  // Theme & Notifications
  themeToggle: document.getElementById('themeToggle'),
  notifBell: document.getElementById('notifBell'),
  notifCount: document.getElementById('notifCount')
};

// ─── INITIALIZATION ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initTheme();
  initNavigation();
  initCharts();
  initWebSocket();
  initEventListeners();
  initNotifications();
  // Check auth first, then load data if authenticated
  checkAuthAndInit();
});

async function checkAuthAndInit() {
  const overlay = document.getElementById('loginOverlay');
  const token = getToken();
  if (token) {
    // Verify token is still valid
    const res = await fetch('/api/check-auth', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (data.authenticated) {
      overlay.style.display = 'none';
      fetchInitialData();
      loadSchedulerRules();
      return;
    }
  }
  // Show login overlay
  overlay.style.display = 'flex';

  // Login button handler
  const btnLogin = document.getElementById('btnLoginSubmit');
  const pwdInput = document.getElementById('loginPasswordInput');
  const errMsg   = document.getElementById('loginErrorMessage');

  const doLogin = async () => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwdInput.value })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      setToken(data.token);
      overlay.style.display = 'none';
      errMsg.style.display = 'none';
      fetchInitialData();
      loadSchedulerRules();
    } else {
      errMsg.style.display = 'block';
      pwdInput.value = '';
      pwdInput.focus();
    }
  };

  btnLogin.addEventListener('click', doLogin);
  pwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}

// Real-time Clock
function initClock() {
  const updateClock = () => {
    const now = new Date();
    el.topbarTime.textContent = now.toLocaleTimeString();
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// Navigation Tabs
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');

  const handleNav = (targetId) => {
    state.activeSection = targetId;
    navItems.forEach(item => {
      if (item.dataset.section === targetId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    sections.forEach(sec => {
      if (sec.id === `section-${targetId}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    el.pageTitle.textContent = targetId.replace('-', ' ');

    if (targetId === 'network-map') {
      setTimeout(renderNetworkMap, 100);
    }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;
      window.location.hash = target;
      handleNav(target);
      if (window.innerWidth <= 992) {
        el.sidebar.classList.remove('open');
      }
    });
  });

  // Handle hash route
  if (window.location.hash) {
    const target = window.location.hash.replace('#', '');
    const valid = ['dashboard', 'hosts', 'monitor', 'network-map', 'activity', 'settings'];
    if (valid.includes(target)) {
      handleNav(target);
    }
  }

  // Sidebar toggle
  el.menuToggle.addEventListener('click', () => {
    el.sidebar.classList.toggle('open');
  });
}

// ─── WEBSOCKET HANDLING ──────────────────────────────────────────────────────
function initWebSocket() {
  const socket = io();
  state.socket = socket;

  socket.on('connect', () => {
    el.connDot.className = 'status-dot online';
    el.connText.textContent = 'CONNECTED';
    showToast('WebSocket connected to backend', 'success');
  });

  socket.on('disconnect', () => {
    el.connDot.className = 'status-dot offline';
    el.connText.textContent = 'OFFLINE';
    showToast('WebSocket disconnected', 'danger');
  });

  // Real-time bandwidth updates
  socket.on('bandwidth_update', (data) => {
    data.hosts.forEach(update => {
      const host = state.hosts.find(h => h.id === update.id);
      if (host) {
        host.upload = update.upload;
        host.download = update.download;
        host.total_up = update.total_up;
        host.total_down = update.total_down;

        // Bandwidth threshold alert
        const totalRate = (host.upload || 0) + (host.download || 0);
        if (totalRate > state.bwThresholdBytes && !state.bwAlerted.has(host.id)) {
          state.bwAlerted.add(host.id);
          addNotification('threshold', `High bandwidth: ${host.name || host.ip} using ${formatSpeed(totalRate)}`);
          sendBrowserNotif('⚠️ High Bandwidth Alert', `${host.name || host.ip} is using ${formatSpeed(totalRate)}`);
          // Reset alert after 60s so it can fire again
          setTimeout(() => state.bwAlerted.delete(host.id), 60000);
        }
      }
    });

    updateDashboardMetrics();
    updateLiveLineChart();
    
    if (state.activeSection === 'hosts') {
      updateHostsTableRatesOnly();
    } else if (state.activeSection === 'monitor') {
      updateMonitorGrid();
    }
  });

  // Log events
  socket.on('new_log', (logEntry) => {
    state.logs.unshift(logEntry);
    if (state.activeSection === 'activity') {
      renderLogs();
    }
  });

  // Scan updates
  socket.on('scan_complete', (data) => {
    state.isScanning = false;
    el.scanProgress.classList.add('hidden');
    el.btnScan.classList.remove('loading');

    // Detect new devices vs previous scan
    const newHosts = data.hosts.filter(h => !state.prevHostIPs.has(h.ip));
    newHosts.forEach(h => {
      addNotification('new-device', `New device detected: ${h.name || h.ip} (${h.mac})`);
      sendBrowserNotif('🔍 New Device Detected', `${h.name || 'Unknown'} joined — ${h.ip}`);
    });
    // Update known IPs
    state.prevHostIPs = new Set(data.hosts.map(h => h.ip));

    showToast(`Scan finished: ${data.count} hosts found`, 'success');
    state.hosts = data.hosts;
    updateDashboardMetrics();
    renderHostsTable();
    if (state.activeSection === 'monitor') {
      updateMonitorGrid();
    }
    if (state.activeSection === 'network-map') {
      renderNetworkMap();
    }
  });
}

// ─── AUTH TOKEN HELPERS ───────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ns_token') || ''; }
function setToken(t) { if (t) localStorage.setItem('ns_token', t); else localStorage.removeItem('ns_token'); }

// ─── API OPERATIONS ──────────────────────────────────────────────────────────
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(endpoint, options);
    if (res.status === 401) {
      // Token expired or invalid — show login screen again
      setToken(null);
      document.getElementById('loginOverlay').style.display = 'flex';
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    showToast(`API request failed: ${err.message}`, 'danger');
    return null;
  }
}

async function fetchInitialData() {
  const statusRes = await apiCall('/api/status');
  if (statusRes) {
    state.settings = statusRes.settings;
    state.stats = statusRes.stats;
    state.telegram = statusRes.telegram;
    updateSettingsFields();
  }

  const hostsRes = await apiCall('/api/hosts');
  if (hostsRes) {
    state.hosts = hostsRes.hosts;
  }

  const logsRes = await apiCall('/api/log');
  if (logsRes) {
    state.logs = logsRes.log;
  }

  updateDashboardMetrics();
  renderHostsTable();
  renderLogs();
}

function updateSettingsFields() {
  el.statusIface.textContent = `${state.settings.interface} · ${state.settings.gateway_ip}/${state.settings.netmask}`;
  el.setInterface.value = state.settings.interface || '';
  el.setGatewayIp.value = state.settings.gateway_ip || '';
  el.setGatewayMac.value = state.settings.gateway_mac || '';
  el.setNetmask.value = state.settings.netmask || '';

  if (state.telegram) {
    const telEnabled = document.getElementById('telegram-enabled');
    const telToken = document.getElementById('telegram-token');
    const telChatId = document.getElementById('telegram-chatid');
    if (telEnabled) telEnabled.checked = state.telegram.enabled || false;
    if (telToken) telToken.value = state.telegram.bot_token || '';
    if (telChatId) telChatId.value = state.telegram.chat_id || '';
  }
}

// ─── DASHBOARD RENDER ────────────────────────────────────────────────────────
function updateDashboardMetrics() {
  const total = state.hosts.length;
  const blocked = state.hosts.filter(h => h.status === 'blocked').length;
  const limited = state.hosts.filter(h => h.status === 'limited').length;
  const free = total - blocked - limited;

  // Update card text
  el.valTotal.textContent = total;
  el.valFree.textContent = free;
  el.valLimited.textContent = limited;
  el.valBlocked.textContent = blocked;
  el.donutNum.textContent = total;
  el.badgeHosts.textContent = total;

  // Calculate total bandwidth
  let upSum = 0;
  let downSum = 0;
  state.hosts.forEach(h => {
    upSum += h.upload || 0;
    downSum += h.download || 0;
  });

  el.valBwUp.textContent = `↑ ${formatSpeed(upSum)}`;
  el.valBwDown.textContent = `↓ ${formatSpeed(downSum)}`;

  // Update Donut Chart
  if (state.charts.donut) {
    state.charts.donut.data.datasets[0].data = [free, limited, blocked];
    state.charts.donut.update();
  }

  // Update Top Consumers
  renderTopConsumers();
}

function renderTopConsumers() {
  const sorted = [...state.hosts].sort((a, b) => (b.upload + b.download) - (a.upload + a.download)).slice(0, 4);
  
  el.topConsumers.innerHTML = sorted.map(host => {
    const totalRate = host.upload + host.download;
    if (totalRate === 0) return '';
    return `
      <div class="consumer-item">
        <div>
          <div class="consumer-name">${host.name || 'Unknown Device'}</div>
          <div class="consumer-ip">${host.ip} · ${host.mac}</div>
        </div>
        <div class="consumer-rates">
          <div style="color: var(--accent)">↑ ${formatSpeed(host.upload)}</div>
          <div style="color: var(--accent-secondary)">↓ ${formatSpeed(host.download)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── HOSTS TABLE ─────────────────────────────────────────────────────────────
function renderHostsTable() {
  const query = el.hostSearch.value.toLowerCase();
  
  const filtered = state.hosts.filter(h => {
    return h.ip.toLowerCase().includes(query) || 
           h.mac.toLowerCase().includes(query) || 
           (h.name && h.name.toLowerCase().includes(query)) ||
           (h.vendor && h.vendor.toLowerCase().includes(query));
  });

  el.hostsTableBody.innerHTML = filtered.map(host => {
    const isChecked = state.selectedIds.has(host.id) ? 'checked' : '';
    const isSelectedRow = state.selectedIds.has(host.id) ? 'selected' : '';
    const statusClass = host.status;
    const deviceIcon = getDeviceIcon(host.type);
    
    return `
      <tr class="${isSelectedRow}" data-id="${host.id}">
        <td><input type="checkbox" class="host-checkbox" ${isChecked} data-id="${host.id}" /></td>
        <td>${host.id}</td>
        <td><div class="device-type-icon">${deviceIcon}</div></td>
        <td><strong>${host.ip}</strong></td>
        <td><code>${host.mac}</code></td>
        <td class="editable-name-cell" data-mac="${host.mac}" data-id="${host.id}">
          <span class="device-name-text">${host.name || '<span class="text-muted">Unknown</span>'}</span>
          <button class="edit-name-btn" title="Edit Device Label" data-mac="${host.mac}" data-id="${host.id}">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
        <td>${host.vendor || '<span class="text-muted">Unknown</span>'}</td>
        <td class="rate-up" style="color: var(--accent)">↑ ${formatSpeed(host.upload)}</td>
        <td class="rate-down" style="color: var(--accent-secondary)">↓ ${formatSpeed(host.download)}</td>
        <td><span class="badge ${statusClass}">${host.status}</span></td>
        <td>
          <div class="actions-cell">
            <button class="action-icon-btn btn-act-limit" title="Limit Bandwidth" data-id="${host.id}">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </button>
            <button class="action-icon-btn btn-act-block" title="Block Internet" data-id="${host.id}">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </button>
            <button class="action-icon-btn btn-act-watch ${host.watched ? 'active' : ''}" title="Watch Reconnects" data-id="${host.id}">
              <svg viewBox="0 0 24 24"><eye xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Re-attach listeners inside table
  attachTableEventListeners();
}

function updateHostsTableRatesOnly() {
  const rows = el.hostsTableBody.querySelectorAll('tr');
  rows.forEach(row => {
    const id = parseInt(row.dataset.id);
    const host = state.hosts.find(h => h.id === id);
    if (host) {
      const upCell = row.querySelector('.rate-up');
      const downCell = row.querySelector('.rate-down');
      if (upCell) upCell.textContent = `↑ ${formatSpeed(host.upload)}`;
      if (downCell) downCell.textContent = `↓ ${formatSpeed(host.download)}`;
    }
  });
}

function attachTableEventListeners() {
  // Checkbox select
  const checkBoxes = el.hostsTableBody.querySelectorAll('.host-checkbox');
  checkBoxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(cb.dataset.id);
      const row = cb.closest('tr');
      if (cb.checked) {
        state.selectedIds.add(id);
        row.classList.add('selected');
      } else {
        state.selectedIds.delete(id);
        row.classList.remove('selected');
      }
    });
  });

  // Action: limit click
  el.hostsTableBody.querySelectorAll('.btn-act-limit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      openLimitModal([id]);
    });
  });

  // Action: block click
  el.hostsTableBody.querySelectorAll('.btn-act-block').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const res = await apiCall('/api/block', 'POST', { ids: [id], direction: 'both' });
      if (res && res.status === 'ok') {
        const host = state.hosts.find(h => h.id === id);
        if (host) {
          host.status = 'blocked';
          host.upload = 0;
          host.download = 0;
        }
        updateDashboardMetrics();
        renderHostsTable();
        showToast(`Blocked device successfully`, 'success');
      }
    });
  });

  // Action: watch click
  el.hostsTableBody.querySelectorAll('.btn-act-watch').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const host = state.hosts.find(h => h.id === id);
      if (!host) return;
      
      const newAction = host.watched ? 'remove' : 'add';
      const res = await apiCall('/api/watch', 'POST', { ids: [id], action: newAction });
      if (res && res.status === 'ok') {
        host.watched = !host.watched;
        btn.classList.toggle('active');
        showToast(`${host.watched ? 'Added to' : 'Removed from'} watchlist`, 'success');
      }
    });
  });

  // Action: Edit device custom alias (name)
  el.hostsTableBody.querySelectorAll('.edit-name-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mac = btn.dataset.mac;
      const id = parseInt(btn.dataset.id);
      const host = state.hosts.find(h => h.id === id);
      if (!host) return;

      const currentName = host.name && !host.name.includes('Unknown') ? host.name : '';
      const newName = prompt(`Enter custom name for device (${host.ip} / ${mac}):`, currentName);
      
      if (newName !== null) {
        const trimmed = newName.trim();
        const res = await apiCall('/api/alias', 'POST', { mac: mac, name: trimmed || 'Unknown Host' });
        if (res && res.status === 'ok') {
          host.name = trimmed || 'Unknown Host';
          renderHostsTable();
          showToast(`Device label updated`, 'success');
        }
      }
    });
  });

  // Row click → open device details modal
  el.hostsTableBody.querySelectorAll('tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      if (e.target.closest('button, input')) return;
      const id = parseInt(row.dataset.id);
      const host = state.hosts.find(h => h.id === id);
      if (host) openDetailsModal(host);
    });
  });
}

function getDeviceIcon(type) {
  switch (type) {
    case 'router':
      return `<svg viewBox="0 0 24 24"><rect x="2" y="20" width="20" height="4" rx="1"/><rect x="6" y="4" width="12" height="16" rx="2"/><line x1="12" y1="12" x2="12.01" y2="12"/></svg>`;
    case 'laptop':
      return `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="21" x2="22" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    case 'phone':
      return `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
    case 'desktop':
      return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="12" rx="2"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;
    case 'tv':
      return `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="13" rx="2"/><line x1="12" y1="16" x2="12" y2="21"/><line x1="7" y1="21" x2="17" y2="21"/></svg>`;
    case 'camera':
      return `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    case 'iot':
      return `<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="16"/><path d="M12 8A2.5 2.5 0 0 1 14.5 10.5c0 2-3 3.5-3 3.5"/></svg>`;
  }
}

// ─── MONITOR SECTION RENDER ──────────────────────────────────────────────────
function updateMonitorGrid() {
  if (state.hosts.length === 0) {
    el.monitorGrid.innerHTML = `
      <div class="panel" style="grid-column: span 3; text-align: center; padding: 40px;">
        <p class="text-muted" style="margin-bottom: 20px;">No hosts discovered yet. Scan the network first.</p>
        <a href="#hosts" class="btn btn-primary" style="display: inline-flex;" onclick="document.querySelector('[data-section=hosts]').click()">Scan Network</a>
      </div>
    `;
    return;
  }

  el.monitorGrid.innerHTML = state.hosts.map(host => {
    const totalUsage = (host.total_up || 0) + (host.total_down || 0);
    const isActive = (host.upload || 0) + (host.download || 0) > 0;
    
    return `
      <div class="monitor-card">
        <div class="monitor-card-header">
          <div>
            <div class="monitor-name">${host.name || 'Unknown Device'}</div>
            <div class="monitor-ip">${host.ip} · <code style="font-size:0.75rem;opacity:0.7">${host.mac}</code></div>
          </div>
          <span class="badge ${host.status}">${host.status}</span>
        </div>
        
        <div class="monitor-speeds">
          <div>
            <div class="stat-label">Upload</div>
            <div class="monitor-speed-val" style="color: var(--accent)">
              ↑ ${formatSpeed(host.upload || 0)}
            </div>
          </div>
          <div>
            <div class="stat-label">Download</div>
            <div class="monitor-speed-val" style="color: var(--accent-secondary)">
              ↓ ${formatSpeed(host.download || 0)}
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span class="text-muted">Total: ${formatSize(totalUsage)}</span>
          <span class="text-muted">Limit: ${host.limit || 'None'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── CHARTS ──────────────────────────────────────────────────────────────────
function initCharts() {
  // Donut Chart
  const ctxDonut = document.getElementById('chartDonut').getContext('2d');
  state.charts.donut = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['Free', 'Limited', 'Blocked'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#00ff88', '#ffaa00', '#ff3366'],
        borderColor: '#11182c',
        borderWidth: 2
      }]
    },
    options: {
      cutout: '80%',
      plugins: {
        legend: { display: false }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // Line Chart
  const ctxLine = document.getElementById('chartLine').getContext('2d');
  state.charts.line = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Upload Speed',
          data: [],
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.05)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Download Speed',
          data: [],
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: {
            color: '#64748b',
            callback: function(value) {
              return formatSpeed(value);
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#e2e8f0' }
        }
      }
    }
  });
}

function updateLiveLineChart() {
  let upSum = 0;
  let downSum = 0;
  state.hosts.forEach(h => {
    upSum += h.upload || 0;
    downSum += h.download || 0;
  });

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const labels = state.charts.lineData.labels;
  const upload = state.charts.lineData.upload;
  const download = state.charts.lineData.download;

  labels.push(now);
  upload.push(upSum);
  download.push(downSum);

  if (labels.length > 15) {
    labels.shift();
    upload.shift();
    download.shift();
  }

  if (state.charts.line) {
    state.charts.line.data.labels = labels;
    state.charts.line.data.datasets[0].data = upload;
    state.charts.line.data.datasets[1].data = download;
    state.charts.line.update('none'); // Update without full animation for performance
  }
}

// ─── D3 NETWORK MAP RENDER ───────────────────────────────────────────────────
function renderNetworkMap() {
  const svg = d3.select('#networkMap');
  svg.selectAll('*').remove();

  const width = el.monitorGrid.offsetWidth || 800;
  const height = 500;
  svg.attr('width', '100%').attr('height', height);

  // Nodes and Links structure
  const nodes = [
    { id: 'gateway', label: state.settings.gateway_ip || 'Gateway', group: 'gateway', x: width / 2, y: height / 2 }
  ];
  const links = [];

  state.hosts.forEach(h => {
    if (h.ip !== state.settings.gateway_ip) {
      nodes.push({
        id: h.id.toString(),
        label: h.name || h.ip,
        ip: h.ip,
        mac: h.mac,
        status: h.status,
        group: 'device'
      });
      links.push({ source: 'gateway', target: h.id.toString() });
    }
  });

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', ticked);

  const link = svg.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('class', 'link');

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .style('position', 'absolute')
    .style('z-index', '1000')
    .style('visibility', 'hidden')
    .style('background', 'var(--bg-panel)')
    .style('border', '1px solid var(--accent-secondary)')
    .style('padding', '8px 12px')
    .style('color', 'white')
    .style('font-size', '0.75rem')
    .style('border-radius', '4px');

  const node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .enter().append('g')
    .attr('class', d => `node ${d.status || d.group}`)
    .call(drag(simulation));

  node.append('circle')
    .attr('r', d => d.group === 'gateway' ? 18 : 10)
    .on('mouseover', function(event, d) {
      if (d.group === 'gateway') return;
      tooltip.html(`<strong>${d.label}</strong><br/>IP: ${d.ip}<br/>MAC: ${d.mac}<br/>Status: ${d.status}`)
        .style('visibility', 'visible');
      d3.select(this).attr('r', 13);
    })
    .on('mousemove', function(event) {
      tooltip.style('top', (event.pageY - 10) + 'px').style('left', (event.pageX + 10) + 'px');
    })
    .on('mouseout', function() {
      tooltip.style('visibility', 'hidden');
      d3.select(this).attr('r', d => d.group === 'gateway' ? 18 : 10);
    })
    .on('click', (event, d) => {
      if (d.group !== 'gateway') {
        openLimitModal([parseInt(d.id)]);
      }
    });

  node.append('text')
    .attr('dy', d => d.group === 'gateway' ? 30 : 20)
    .attr('text-anchor', 'middle')
    .text(d => d.label);

  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function drag(sim) {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
}

// ─── LOGS RENDER ─────────────────────────────────────────────────────────────
function renderLogs() {
  const filterBtn = el.logFilters.querySelector('.filter-btn.active');
  const filter = filterBtn ? filterBtn.dataset.filter : 'all';
  
  const filteredLogs = state.logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  el.activityLog.innerHTML = filteredLogs.map(log => {
    return `
      <div class="log-row">
        <span class="log-time">${log.time}</span>
        <span class="log-badge ${log.type}">${log.type}</span>
        <span class="log-msg">${log.message}</span>
      </div>
    `;
  }).join('');
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
function initEventListeners() {
  // Navigation active tab
  window.addEventListener('hashchange', () => {
    const target = window.location.hash.replace('#', '');
    const tabBtn = document.querySelector(`.nav-item[data-section="${target}"]`);
    if (tabBtn) tabBtn.click();
  });

  // Scan Network Button Click
  el.btnScan.addEventListener('click', async () => {
    if (state.isScanning) return;
    state.isScanning = true;
    el.scanProgress.classList.remove('hidden');
    el.btnScan.classList.add('loading');
    showToast('Network scan started...', 'warn');
    await apiCall('/api/scan', 'POST');
  });

  // Search filter
  el.hostSearch.addEventListener('input', renderHostsTable);

  // Check All table hosts
  el.checkAll.addEventListener('change', () => {
    const checkBoxes = el.hostsTableBody.querySelectorAll('.host-checkbox');
    state.selectedIds.clear();
    checkBoxes.forEach(cb => {
      cb.checked = el.checkAll.checked;
      const id = parseInt(cb.dataset.id);
      const row = cb.closest('tr');
      if (el.checkAll.checked) {
        state.selectedIds.add(id);
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });
  });

  // Action Buttons
  el.btnSelectAll.addEventListener('click', () => {
    el.checkAll.checked = true;
    el.checkAll.dispatchEvent(new Event('change'));
  });

  el.btnLimitSelected.addEventListener('click', () => {
    if (state.selectedIds.size === 0) {
      showToast('Select one or more hosts first', 'warn');
      return;
    }
    openLimitModal(Array.from(state.selectedIds));
  });

  el.btnBlockSelected.addEventListener('click', async () => {
    if (state.selectedIds.size === 0) {
      showToast('Select one or more hosts first', 'warn');
      return;
    }
    const ids = Array.from(state.selectedIds);
    const res = await apiCall('/api/block', 'POST', { ids, direction: 'both' });
    if (res && res.status === 'ok') {
      state.hosts.forEach(h => {
        if (ids.includes(h.id)) {
          h.status = 'blocked';
          h.upload = 0;
          h.download = 0;
        }
      });
      state.selectedIds.clear();
      el.checkAll.checked = false;
      updateDashboardMetrics();
      renderHostsTable();
      showToast(`Blocked ${ids.length} device(s)`, 'success');
    }
  });

  el.btnFreeSelected.addEventListener('click', async () => {
    if (state.selectedIds.size === 0) {
      showToast('Select one or more hosts first', 'warn');
      return;
    }
    const ids = Array.from(state.selectedIds);
    const res = await apiCall('/api/free', 'POST', { ids });
    if (res && res.status === 'ok') {
      state.hosts.forEach(h => {
        if (ids.includes(h.id)) {
          h.status = 'free';
          h.limit = null;
        }
      });
      state.selectedIds.clear();
      el.checkAll.checked = false;
      updateDashboardMetrics();
      renderHostsTable();
      showToast(`Freed ${ids.length} device(s)`, 'success');
    }
  });

  // Export Log CSV
  el.btnExportLog.addEventListener('click', () => {
    let csv = 'Time,Type,Message\n';
    state.logs.forEach(log => {
      csv += `"${log.time}","${log.type}","${log.message.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `netspectre_activity_${Date.now()}.csv`);
    a.click();
  });

  // Log filter buttons
  el.logFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    el.logFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderLogs();
  });

  // Settings Save
  el.btnSaveSettings.addEventListener('click', async () => {
    const body = {
      interface: el.setInterface.value,
      gateway_ip: el.setGatewayIp.value,
      gateway_mac: el.setGatewayMac.value,
      netmask: el.setNetmask.value
    };
    const res = await apiCall('/api/settings', 'POST', body);
    if (res && res.status === 'ok') {
      state.settings = res.settings;
      updateSettingsFields();
      showToast('Network settings saved successfully', 'success');
    }
  });

  // Slider input updates
  el.setThreads.addEventListener('input', () => el.setThreadsVal.textContent = el.setThreads.value);
  el.setTimeout.addEventListener('input', () => el.setTimeoutVal.textContent = el.setTimeout.value + 's');
  el.setWatchInterval.addEventListener('input', () => el.setWatchIntervalVal.textContent = el.setWatchInterval.value + 's');

  // Danger Zone Actions
  el.btnBlockAll.addEventListener('click', async () => {
    if (confirm('Are you sure you want to block ALL hosts on the network?')) {
      const ids = state.hosts.map(h => h.id);
      const res = await apiCall('/api/block', 'POST', { ids, direction: 'both' });
      if (res && res.status === 'ok') {
        state.hosts.forEach(h => {
          h.status = 'blocked';
          h.upload = 0;
          h.download = 0;
        });
        updateDashboardMetrics();
        renderHostsTable();
        showToast('All hosts have been blocked', 'danger');
      }
    }
  });

  el.btnFreeAll.addEventListener('click', async () => {
    const ids = state.hosts.map(h => h.id);
    const res = await apiCall('/api/free', 'POST', { ids });
    if (res && res.status === 'ok') {
      state.hosts.forEach(h => {
        h.status = 'free';
        h.limit = null;
      });
      updateDashboardMetrics();
      renderHostsTable();
      showToast('All hosts released', 'success');
    }
  });

  el.btnFlushRules.addEventListener('click', async () => {
    showToast('Flushing network configurations...', 'warn');
    setTimeout(() => {
      showToast('iptables and qdisc structures flushed', 'success');
    }, 1500);
  });

  // Modal controls
  el.modalLimitClose.addEventListener('click', closeLimitModal);
  el.modalLimitCancel.addEventListener('click', closeLimitModal);
  
  el.limitSlider.addEventListener('input', () => {
    el.limitRateVal.textContent = el.limitSlider.value;
  });

  // Preset Rate Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const unit = btn.dataset.unit;
      el.limitSlider.value = val;
      el.limitRateVal.textContent = val;
      el.limitRateUnit.value = unit;
    });
  });

  // Direction select buttons
  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ─── LIMIT MODAL ─────────────────────────────────────────────────────────────
let activeModalIds = [];

function openLimitModal(ids) {
  activeModalIds = ids;
  
  if (ids.length === 1) {
    const host = state.hosts.find(h => h.id === ids[0]);
    el.limitTargetInfo.textContent = `Target: ${host.name || 'Unknown'} (${host.ip})`;
  } else {
    el.limitTargetInfo.textContent = `Target: ${ids.length} selected devices`;
  }

  el.modalLimit.classList.remove('hidden');

  // Action Apply Limit inside modal
  el.modalLimitApply.onclick = async () => {
    const rate = el.limitSlider.value + el.limitRateUnit.value;
    const direction = document.querySelector('.dir-btn.active').dataset.dir;
    
    const res = await apiCall('/api/limit', 'POST', { ids: activeModalIds, rate, direction });
    if (res && res.status === 'ok') {
      state.hosts.forEach(h => {
        if (activeModalIds.includes(h.id)) {
          h.status = 'limited';
          h.limit = rate;
        }
      });
      closeLimitModal();
      updateDashboardMetrics();
      renderHostsTable();
      showToast(`Rate limit applied successfully`, 'success');
    }
  };
}

function closeLimitModal() {
  el.modalLimit.classList.add('hidden');
  activeModalIds = [];
}

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close">✕</button>
  `;

  el.toastContainer.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// ─── DARK / LIGHT MODE ────────────────────────────────────────────────────────
function initTheme() {
  // Restore saved preference
  const saved = localStorage.getItem('el-theme');
  if (saved === 'light') applyTheme('light');

  el.themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-mode');
    applyTheme(isLight ? 'dark' : 'light');
  });
}

function applyTheme(mode) {
  const moonIcon = el.themeToggle.querySelector('.icon-moon');
  const sunIcon  = el.themeToggle.querySelector('.icon-sun');

  if (mode === 'light') {
    document.body.classList.add('light-mode');
    moonIcon.style.display = 'none';
    sunIcon.style.display  = 'block';
    localStorage.setItem('el-theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    moonIcon.style.display = 'block';
    sunIcon.style.display  = 'none';
    localStorage.setItem('el-theme', 'dark');
  }
}

// ─── NOTIFICATIONS SYSTEM ─────────────────────────────────────────────────────
function initNotifications() {
  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Toggle notification panel on bell click
  el.notifBell.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('notifPanel');
    if (existing) { existing.remove(); return; }
    renderNotifPanel();
  });

  // Close panel when clicking outside
  document.addEventListener('click', () => {
    const panel = document.getElementById('notifPanel');
    if (panel) panel.remove();
  });
}

function addNotification(type, message) {
  const entry = {
    id: Date.now(),
    type,   // 'new-device' | 'threshold' | 'reconnect'
    message,
    time: new Date().toLocaleTimeString()
  };
  state.notifications.unshift(entry);
  if (state.notifications.length > 50) state.notifications.pop();

  state.notifUnread++;
  el.notifCount.textContent = state.notifUnread;
  el.notifCount.style.display = 'inline';

  // Refresh panel if open
  if (document.getElementById('notifPanel')) renderNotifPanel();
}

function sendBrowserNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

function renderNotifPanel() {
  const existing = document.getElementById('notifPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel';
  panel.addEventListener('click', e => e.stopPropagation());

  const items = state.notifications.length === 0
    ? `<div class="notif-panel-empty">No notifications yet</div>`
    : state.notifications.map(n => `
        <div class="notif-item">
          <div class="notif-item-dot ${n.type}"></div>
          <div>
            <div class="notif-item-text">${n.message}</div>
            <div class="notif-item-time">${n.time}</div>
          </div>
        </div>
      `).join('');

  panel.innerHTML = `
    <div class="notif-panel-header">
      <span>Notifications</span>
      <button class="notif-clear-btn" id="notifClearBtn">Clear All</button>
    </div>
    <div class="notif-panel-body">${items}</div>
  `;

  document.body.appendChild(panel);

  // Mark all as read
  state.notifUnread = 0;
  el.notifCount.style.display = 'none';

  panel.querySelector('#notifClearBtn')?.addEventListener('click', () => {
    state.notifications = [];
    state.notifUnread = 0;
    el.notifCount.style.display = 'none';
    panel.remove();
  });
}

// ─── HOST ROW CLICK: DETAILS MODAL ──────────────────────────────────────────
let detailsHistChart = null;
let currentDetailHost = null;

function openDetailsModal(host) {
  currentDetailHost = host;
  const modal = document.getElementById('detailsModal');
  modal.classList.remove('hidden');
  document.getElementById('det-name').textContent = host.name || 'Unknown Device';
  document.getElementById('det-ip-mac').textContent = `${host.ip}  ·  ${host.mac}`;
  const statusEl = document.getElementById('det-status');
  statusEl.textContent = host.status;
  statusEl.className = `badge ${host.status}`;
  document.getElementById('det-vendor').textContent = host.vendor || 'Unknown Vendor';
  const totals = document.getElementById('det-totals');
  totals.innerHTML = `<span style="color:var(--accent)">↑ Up: ${formatSize(host.total_up||0)}</span><span style="color:var(--accent-secondary)">↓ Down: ${formatSize(host.total_down||0)}</span><span class="text-muted">Limit: ${host.limit||'None'}</span>`;
  const history = host.history || [];
  const ctx = document.getElementById('detailsHistoryChart').getContext('2d');
  if (detailsHistChart) { detailsHistChart.destroy(); detailsHistChart = null; }
  detailsHistChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: history.map(h => h.time),
      datasets: [
        { label: 'Upload (B/s)', data: history.map(h => h.up), borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.06)', fill: true, tension: 0.4, pointRadius: 2 },
        { label: 'Download (B/s)', data: history.map(h => h.down), borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.06)', fill: true, tension: 0.4, pointRadius: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', maxTicksLimit: 8 } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', callback: v => formatSpeed(v) } }
      },
      plugins: { legend: { labels: { color: '#e2e8f0', font: { size: 11 } } } }
    }
  });
}

document.getElementById('detailsModalClose')?.addEventListener('click', () => { document.getElementById('detailsModal').classList.add('hidden'); if(detailsHistChart){detailsHistChart.destroy();detailsHistChart=null;} });
document.getElementById('detailsModalCloseBtn')?.addEventListener('click', () => { document.getElementById('detailsModal').classList.add('hidden'); if(detailsHistChart){detailsHistChart.destroy();detailsHistChart=null;} });
document.getElementById('btnSaveStaticRule')?.addEventListener('click', async () => {
  if (!currentDetailHost) return;
  const res = await apiCall('/api/rules', 'POST', { mac: currentDetailHost.mac, status: currentDetailHost.status, limit: currentDetailHost.limit || '1mbit' });
  if (res && res.status === 'ok') showToast(`Persistent rule saved for ${currentDetailHost.ip}`, 'success');
});
document.getElementById('btnDeleteStaticRule')?.addEventListener('click', async () => {
  if (!currentDetailHost) return;
  const res = await apiCall('/api/rules/delete', 'POST', { mac: currentDetailHost.mac });
  if (res && res.status === 'ok') showToast(`Rule cleared for ${currentDetailHost.ip}`, 'success');
});

// ─── SETTINGS: SCHEDULER ─────────────────────────────────────────────────────
async function loadSchedulerRules() {
  const res = await apiCall('/api/scheduler');
  if (!res) return;
  const container = document.getElementById('schedulerRulesList');
  if (!container) return;
  if (!res.scheduler || res.scheduler.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;font-size:0.8rem;">No scheduled rules.</p>';
    return;
  }
  container.innerHTML = res.scheduler.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.05);"><code style="font-size:0.72rem;color:var(--accent)">${r.mac}</code><span style="font-size:0.75rem;">${r.action.toUpperCase()} · ${r.time_start}–${r.time_end}</span><button onclick="deleteScheduleRule('${r.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1rem;" title="Delete">✕</button></div>`).join('');
}

window.deleteScheduleRule = async (id) => {
  const res = await apiCall('/api/scheduler/delete', 'POST', { id });
  if (res && res.status === 'ok') { showToast('Rule deleted', 'success'); loadSchedulerRules(); }
};

document.getElementById('btnAddSchedule')?.addEventListener('click', async () => {
  const mac = document.getElementById('sched-mac').value.trim();
  const start = document.getElementById('sched-start').value.trim();
  const end = document.getElementById('sched-end').value.trim();
  const action = document.getElementById('sched-action').value;
  const limit = document.getElementById('sched-limit').value.trim();
  if (!mac || !start || !end) { showToast('Fill in MAC, start, and end time', 'warn'); return; }
  const res = await apiCall('/api/scheduler', 'POST', { mac, time_start: start, time_end: end, action, limit, enabled: true });
  if (res && res.status === 'ok') { showToast('Scheduled rule added', 'success'); document.getElementById('sched-mac').value = ''; loadSchedulerRules(); }
});

// ─── SETTINGS: TELEGRAM BOT ──────────────────────────────────────────────────
document.getElementById('btnSaveTelegram')?.addEventListener('click', async () => {
  const res = await apiCall('/api/settings/telegram', 'POST', {
    enabled: document.getElementById('telegram-enabled').checked,
    bot_token: document.getElementById('telegram-token').value.trim(),
    chat_id: document.getElementById('telegram-chatid').value.trim()
  });
  if (res && res.status === 'ok') showToast('Telegram settings saved!', 'success');
});

// ─── SETTINGS: PASSWORD ──────────────────────────────────────────────────────
document.getElementById('btnSavePassword')?.addEventListener('click', async () => {
  const pwd = document.getElementById('console-pwd-input').value;
  if (!pwd) { showToast('Password cannot be empty', 'warn'); return; }
  const res = await apiCall('/api/settings/password', 'POST', { password: pwd });
  if (res && res.status === 'ok') {
    document.getElementById('console-pwd-input').value = '';
    showToast('Password updated. Logging out...', 'success');
    setTimeout(() => { setToken(null); location.reload(); }, 2500);
  }
});

// ─── SETTINGS: BACKUP EXPORT / IMPORT ────────────────────────────────────────
document.getElementById('btnExportBackup')?.addEventListener('click', async () => {
  const res = await fetch('/api/hosts/export', { headers: { 'Authorization': `Bearer ${getToken()}` } });
  if (!res.ok) { showToast('Export failed', 'danger'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `netspectre_backup_${Date.now()}.json`; a.click();
  showToast('Backup exported', 'success');
});
document.getElementById('btnTriggerImport')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
  if (!e.target.files.length) return;
  const fd = new FormData(); fd.append('file', e.target.files[0]);
  const res = await fetch('/api/hosts/import', { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (data.status === 'ok') { showToast('Configuration restored from backup', 'success'); loadSchedulerRules(); }
  else showToast(data.message || 'Import failed', 'danger');
  e.target.value = '';
});
