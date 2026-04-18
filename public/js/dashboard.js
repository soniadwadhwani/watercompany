// ─── Dashboard page logic ───────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  if (user.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }

  // Populate profile
  document.getElementById('userName').textContent = user.full_name;
  document.getElementById('profileInfo').innerHTML = `
    <div class="profile-item">
      <div class="label">Full Name</div>
      <div class="value">${escapeHtml(user.full_name)}</div>
    </div>
    <div class="profile-item">
      <div class="label">Email</div>
      <div class="value">${escapeHtml(user.email)}</div>
    </div>
    <div class="profile-item">
      <div class="label">Phone</div>
      <div class="value">${escapeHtml(user.phone)}</div>
    </div>
    <div class="profile-item">
      <div class="label">Address</div>
      <div class="value">${escapeHtml(user.address)}</div>
    </div>
    <div class="profile-item">
      <div class="label">Member Since</div>
      <div class="value">${new Date(user.created_at).toLocaleDateString()}</div>
    </div>
  `;

  loadConnections();

  // Connection form
  document.getElementById('connectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('connectionError');
    const successEl = document.getElementById('connectionSuccess');
    errEl.classList.add('hidden');
    successEl.classList.add('hidden');

    const data = {
      connection_type: document.getElementById('connection_type').value,
      property_type: document.getElementById('property_type').value,
      property_address: document.getElementById('property_address').value.trim(),
    };

    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        errEl.textContent = result.error;
        errEl.classList.remove('hidden');
        return;
      }
      successEl.textContent = 'Application submitted successfully! Application ID: ' + result.id;
      successEl.classList.remove('hidden');
      document.getElementById('connectionForm').reset();
      loadConnections();
    } catch {
      errEl.textContent = 'Failed to submit. Please try again.';
      errEl.classList.remove('hidden');
    }
  });
});

async function loadConnections() {
  const container = document.getElementById('connectionsList');
  try {
    const res = await fetch('/api/connections');
    const connections = await res.json();

    if (connections.length === 0) {
      container.innerHTML = '<p class="text-muted">You haven\'t applied for any connections yet. Use the form above to apply.</p>';
      return;
    }

    container.innerHTML = connections.map(c => `
      <div class="connection-card">
        <div class="connection-card-header">
          <h4><i class="fas fa-faucet-drip"></i> ${escapeHtml(c.connection_type.charAt(0).toUpperCase() + c.connection_type.slice(1))} Connection</h4>
          <span class="badge badge-${c.status}">${c.status.toUpperCase()}</span>
        </div>
        <div class="connection-meta">
          <div><span>Application ID:</span> <strong>#${c.id}</strong></div>
          <div><span>Property Type:</span> <strong>${escapeHtml(c.property_type)}</strong></div>
          <div><span>Address:</span> <strong>${escapeHtml(c.property_address)}</strong></div>
          <div><span>Applied:</span> <strong>${new Date(c.applied_at).toLocaleDateString()}</strong></div>
          ${c.meter_number ? `<div><span>Meter Number:</span> <strong style="color: var(--success)">${escapeHtml(c.meter_number)}</strong></div>` : ''}
          ${c.admin_remarks ? `<div><span>Remarks:</span> <strong>${escapeHtml(c.admin_remarks)}</strong></div>` : ''}
          ${c.processed_at ? `<div><span>Processed:</span> <strong>${new Date(c.processed_at).toLocaleDateString()}</strong></div>` : ''}
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p class="text-muted">Failed to load connections.</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
