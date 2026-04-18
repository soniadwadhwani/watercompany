// ─── Admin page logic ───────────────────────────────────────

let currentConnectionId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return;
  }

  loadStats();
  loadConnections();
  loadUsers();
  setupTabs();
  setupModal();
});

// ─── Tabs ────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    });
  });
}

// ─── Stats ───────────────────────────────────────────────────

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();
    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statApproved').textContent = stats.approved;
    document.getElementById('statRejected').textContent = stats.rejected;
  } catch { /* silent */ }
}

// ─── Connections Table ───────────────────────────────────────

async function loadConnections() {
  const tbody = document.getElementById('connectionsTableBody');
  try {
    const res = await fetch('/api/admin/connections');
    const connections = await res.json();

    if (connections.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No connection requests yet.</td></tr>';
      return;
    }

    tbody.innerHTML = connections.map(c => `
      <tr>
        <td>#${c.id}</td>
        <td>${escapeHtml(c.full_name)}<br><small class="text-muted">${escapeHtml(c.email)}</small></td>
        <td>${escapeHtml(c.connection_type)}</td>
        <td>${escapeHtml(c.property_type)}</td>
        <td style="max-width:200px">${escapeHtml(c.property_address)}</td>
        <td><span class="badge badge-${c.status}">${c.status.toUpperCase()}</span></td>
        <td>${c.meter_number ? escapeHtml(c.meter_number) : '—'}</td>
        <td>${new Date(c.applied_at).toLocaleDateString()}</td>
        <td>
          ${c.status === 'pending' ?
            `<button class="btn-action" onclick="openModal(${c.id}, '${escapeAttr(c.full_name)}', '${escapeAttr(c.connection_type)}', '${escapeAttr(c.property_address)}')">
              <i class="fas fa-cog"></i> Process
            </button>` :
            '<span class="text-muted">Done</span>'
          }
        </td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Failed to load.</td></tr>';
  }
}

// ─── Users Table ─────────────────────────────────────────────

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  try {
    const res = await fetch('/api/admin/registrations');
    const users = await res.json();

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No registered users yet.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id}</td>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone)}</td>
        <td style="max-width:200px">${escapeHtml(u.address)}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Failed to load.</td></tr>';
  }
}

// ─── Modal ───────────────────────────────────────────────────

function setupModal() {
  const modal = document.getElementById('actionModal');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById('btnApprove').addEventListener('click', () => processConnection('approved'));
  document.getElementById('btnReject').addEventListener('click', () => processConnection('rejected'));
}

function openModal(id, name, type, address) {
  currentConnectionId = id;
  document.getElementById('modalApplicant').textContent = name;
  document.getElementById('modalType').textContent = type;
  document.getElementById('modalAddress').textContent = address;
  document.getElementById('adminRemarks').value = '';
  document.getElementById('actionModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('actionModal').classList.add('hidden');
  currentConnectionId = null;
}

async function processConnection(status) {
  if (!currentConnectionId) return;

  const remarks = document.getElementById('adminRemarks').value.trim();

  try {
    const res = await fetch(`/api/admin/connections/${currentConnectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_remarks: remarks }),
    });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error);
      return;
    }

    if (status === 'approved' && result.meter_number) {
      alert(`Connection approved! Meter Number: ${result.meter_number}`);
    } else {
      alert('Connection has been ' + status);
    }

    closeModal();
    loadConnections();
    loadStats();
  } catch {
    alert('Failed to process. Please try again.');
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
