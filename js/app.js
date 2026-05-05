/**
 * Main application controller.
 * Wires up navigation, settings modal, data fetching, and rendering.
 */
(() => {
  /* ── State ── */
  const state = {
    mode: 'demo',        // 'demo' | 'live'
    days: 30,
    contacts: [],
    campaigns: [],
    emails: [],
    currentSection: 'overview',
    leadsPage: 1,
    leadsFilter: '',
    leadsStatusFilter: '',
  };

  const PER_PAGE = 15;
  const TOKEN_KEY = 'hs_dashboard_token';

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      HubSpotAPI.setToken(saved);
      state.mode = 'live';
      updateConnectionBadge();
      loadData();
    } else {
      openSettings();
    }
    bindEvents();
  });

  /* ── Event Binding ── */
  function bindEvents() {
    // Settings modal
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('close-settings').addEventListener('click', closeSettings);
    document.getElementById('settings-modal').addEventListener('click', e => {
      if (e.target.id === 'settings-modal') closeSettings();
    });
    document.getElementById('toggle-token').addEventListener('click', () => {
      const inp = document.getElementById('api-token');
      const icon = document.querySelector('#toggle-token i');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      icon.className = inp.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });
    document.getElementById('save-token').addEventListener('click', handleConnect);
    document.getElementById('use-demo').addEventListener('click', () => {
      closeSettings();
      state.mode = 'demo';
      updateConnectionBadge();
      loadData();
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const section = a.dataset.section;
        switchSection(section);
      });
    });

    // Date range
    document.querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.days = parseInt(btn.dataset.days);
        renderOverview();
      });
    });

    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', loadData);

    // Leads search & filter
    document.getElementById('leads-search').addEventListener('input', e => {
      state.leadsFilter = e.target.value.toLowerCase();
      state.leadsPage = 1;
      renderLeadsTable();
    });
    document.getElementById('leads-status-filter').addEventListener('change', e => {
      state.leadsStatusFilter = e.target.value;
      state.leadsPage = 1;
      renderLeadsTable();
    });

    // Emails search
    document.getElementById('emails-search').addEventListener('input', e => {
      renderEmailsTable(e.target.value.toLowerCase());
    });
  }

  /* ── Settings Modal ── */
  function openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) document.getElementById('api-token').value = saved;
  }

  function closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('token-error').classList.add('hidden');
  }

  async function handleConnect() {
    const token = document.getElementById('api-token').value.trim();
    const errEl = document.getElementById('token-error');
    errEl.classList.add('hidden');

    if (!token) { showTokenError('Please enter an access token.'); return; }

    const btn = document.getElementById('save-token');
    btn.textContent = 'Connecting…';
    btn.disabled = true;

    HubSpotAPI.setToken(token);
    try {
      await HubSpotAPI.request('/crm/v3/objects/contacts', { limit: 1 });
      localStorage.setItem(TOKEN_KEY, token);
      state.mode = 'live';
      updateConnectionBadge();
      closeSettings();
      loadData();
    } catch (err) {
      showTokenError(`Connection failed: ${err.message}. Check the token and scopes.`);
      HubSpotAPI.setToken(null);
    } finally {
      btn.textContent = 'Connect';
      btn.disabled = false;
    }
  }

  function showTokenError(msg) {
    const el = document.getElementById('token-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function updateConnectionBadge() {
    const badge = document.getElementById('connection-badge');
    if (state.mode === 'live') {
      badge.textContent = 'Live';
      badge.className = 'badge badge-live';
    } else {
      badge.textContent = 'Demo';
      badge.className = 'badge badge-demo';
    }
  }

  /* ── Navigation ── */
  function switchSection(section) {
    state.currentSection = section;
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.section === section);
    });
    document.querySelectorAll('.content-section').forEach(el => {
      el.classList.toggle('hidden', el.id !== `section-${section}`);
    });
    const titles = { overview: 'Overview', leads: 'Leads', campaigns: 'Campaigns', emails: 'Emails' };
    document.getElementById('page-title').textContent = titles[section] || 'Dashboard';
  }

  /* ── Data Loading ── */
  async function loadData() {
    showLoading(true);
    try {
      if (state.mode === 'live') {
        await loadLiveData();
      } else {
        loadDemoData();
      }
      renderAll();
    } catch (err) {
      console.error('Load error:', err);
      alert(`Failed to load data: ${err.message}`);
    } finally {
      showLoading(false);
      document.getElementById('last-updated').textContent =
        `Updated ${new Date().toLocaleTimeString()}`;
    }
  }

  async function loadLiveData() {
    const [contactsData, dealsData, emailsData] = await Promise.allSettled([
      HubSpotAPI.getAllContacts(5),
      HubSpotAPI.getDeals(100),
      HubSpotAPI.getMarketingEmails(50),
    ]);

    state.contacts = contactsData.status === 'fulfilled' ? contactsData.value : [];
    state.deals    = dealsData.status    === 'fulfilled' ? (dealsData.value.results || []) : [];
    state.emails   = emailsData.status  === 'fulfilled' ? formatLiveEmails(emailsData.value) : [];
    state.campaigns = buildCampaignsFromEmails(state.emails);
  }

  function loadDemoData() {
    state.contacts  = DemoData.contacts(200);
    state.emails    = DemoData.emails();
    state.campaigns = DemoData.campaigns();
    state.deals     = [];
  }

  /* ── Live data normalisation ── */
  function formatLiveEmails(data) {
    const list = data.objects || data.emails || [];
    return list.map(e => ({
      id: e.id,
      name: e.name || e.subject || '(untitled)',
      subject: e.subject || e.name || '(no subject)',
      status: e.currentState || e.status || 'UNKNOWN',
      created: e.created || e.publishDate || new Date().toISOString(),
      stats: {
        sent:          e.stats?.sent          || e.counters?.sent          || 0,
        delivered:     e.stats?.delivered     || e.counters?.delivered     || 0,
        opens:         e.stats?.opens         || e.counters?.open          || 0,
        clicks:        e.stats?.clicks        || e.counters?.click         || 0,
        unsubscribes:  e.stats?.unsubscribes  || e.counters?.unsubscribed  || 0,
      },
    }));
  }

  function buildCampaignsFromEmails(emails) {
    return emails.slice(0, 8).map((e, i) => ({
      id: `c${i}`,
      properties: { name: e.name, type: 'EMAIL', status: e.status === 'SENT' ? 'ACTIVE' : 'DRAFT' },
      stats: e.stats,
    }));
  }

  /* ── Render All ── */
  function renderAll() {
    renderOverview();
    renderLeadsTable();
    renderCampaignsTable();
    renderEmailsTable();
  }

  /* ── Overview ── */
  function renderOverview() {
    const cutoff = new Date(Date.now() - state.days * 86400000);
    const periodContacts = state.contacts.filter(c =>
      new Date(c.properties.createdate) >= cutoff
    );

    /* KPIs */
    setKPI('kpi-total-leads', state.contacts.length);
    setKPI('kpi-new-leads', periodContacts.length);
    setKPI('kpi-campaigns', state.campaigns.filter(c => c.properties?.status === 'ACTIVE').length);

    const totalSent   = state.emails.reduce((s, e) => s + (e.stats?.sent || 0), 0);
    const totalOpens  = state.emails.reduce((s, e) => s + (e.stats?.opens || 0), 0);
    const totalClicks = state.emails.reduce((s, e) => s + (e.stats?.clicks || 0), 0);

    const openRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) + '%' : '—';
    const ctr      = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) + '%' : '—';

    setKPI('kpi-open-rate', openRate);
    setKPI('kpi-ctr', ctr);
    setKPI('kpi-deals', (state.deals || []).length || state.campaigns.length);

    /* Charts */
    renderTimelineChart(periodContacts, cutoff);
    renderSourcesChart(periodContacts);
    renderCampaignPerfChart();
    renderStatusChart();
  }

  function setKPI(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = typeof value === 'number' ? value.toLocaleString() : value;
  }

  function renderTimelineChart(contacts, cutoff) {
    const map = {};
    const now = Date.now();
    for (let d = 0; d < state.days; d++) {
      const dt = new Date(now - d * 86400000);
      map[dt.toISOString().slice(0, 10)] = 0;
    }
    contacts.forEach(c => {
      const day = c.properties.createdate?.slice(0, 10);
      if (day && map[day] !== undefined) map[day]++;
    });
    const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    const labels = entries.map(([d]) => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    Charts.renderLeadsTimeline(labels, entries.map(([, v]) => v));
  }

  function renderSourcesChart(contacts) {
    const map = {};
    contacts.forEach(c => {
      const src = c.properties.hs_analytics_source || 'Unknown';
      map[src] = (map[src] || 0) + 1;
    });
    const entries = Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6);
    Charts.renderLeadSources(entries.map(([k]) => k), entries.map(([, v]) => v));
  }

  function renderCampaignPerfChart() {
    const top = state.campaigns.slice(0, 6);
    Charts.renderCampaignPerf(
      top.map(c => c.properties?.name || 'Campaign'),
      top.map(c => c.stats?.sent || 0),
      top.map(c => c.stats?.opens || 0),
      top.map(c => c.stats?.clicks || 0),
    );
  }

  function renderStatusChart() {
    const statuses = ['New', 'Open', 'In Progress', 'Qualified', 'Unqualified'];
    const keys     = ['new', 'open', 'in_progress', 'qualified', 'unqualified'];
    const counts   = keys.map(k =>
      state.contacts.filter(c => (c.properties.hs_lead_status || '').toLowerCase() === k).length
    );
    Charts.renderLeadStatus(statuses, counts);
  }

  /* ── Leads Table ── */
  function renderLeadsTable() {
    const q = state.leadsFilter;
    const sf = state.leadsStatusFilter;

    const filtered = state.contacts.filter(c => {
      const name  = `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.toLowerCase();
      const email = (c.properties.email || '').toLowerCase();
      const status = (c.properties.hs_lead_status || '').toLowerCase();
      const matchQ  = !q  || name.includes(q) || email.includes(q);
      const matchSF = !sf || status === sf;
      return matchQ && matchSF;
    });

    const total = filtered.length;
    const pages = Math.ceil(total / PER_PAGE) || 1;
    if (state.leadsPage > pages) state.leadsPage = pages;

    const slice = filtered.slice((state.leadsPage - 1) * PER_PAGE, state.leadsPage * PER_PAGE);
    const tbody = document.getElementById('leads-tbody');
    tbody.innerHTML = slice.map(c => {
      const first = c.properties.firstname || '';
      const last  = c.properties.lastname  || '';
      const name  = `${first} ${last}`.trim() || '—';
      const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || '?';
      const color = c._avatarColor || '#0091ae';
      const status = c.properties.hs_lead_status || 'unknown';
      const source = c.properties.hs_analytics_source || '—';
      const created = c.properties.createdate
        ? new Date(c.properties.createdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      return `<tr>
        <td>
          <div class="name-cell">
            <span class="avatar" style="background:${color}">${initials}</span>
            ${escHtml(name)}
          </div>
        </td>
        <td>${escHtml(c.properties.email || '—')}</td>
        <td>${statusPill(status)}</td>
        <td>${escHtml(source)}</td>
        <td>${created}</td>
      </tr>`;
    }).join('');

    document.getElementById('leads-count').textContent =
      `Showing ${((state.leadsPage - 1) * PER_PAGE) + 1}–${Math.min(state.leadsPage * PER_PAGE, total)} of ${total} leads`;

    renderPagination('leads-pagination', pages, state.leadsPage, page => {
      state.leadsPage = page;
      renderLeadsTable();
    });
  }

  /* ── Campaigns Table ── */
  function renderCampaignsTable() {
    const tbody = document.getElementById('campaigns-tbody');
    tbody.innerHTML = state.campaigns.map(c => {
      const s = c.stats || {};
      const openRate = s.sent > 0 ? ((s.opens / s.sent) * 100).toFixed(1) + '%' : '—';
      const ctr      = s.sent > 0 ? ((s.clicks / s.sent) * 100).toFixed(1) + '%' : '—';
      const status   = (c.properties?.status || '').toLowerCase();
      return `<tr>
        <td><strong>${escHtml(c.properties?.name || '—')}</strong></td>
        <td>${escHtml(c.properties?.type || '—')}</td>
        <td>${statusPill(status)}</td>
        <td>${(s.sent || 0).toLocaleString()}</td>
        <td>${(s.opens || 0).toLocaleString()}</td>
        <td>${(s.clicks || 0).toLocaleString()}</td>
        <td>${openRate}</td>
        <td>${ctr}</td>
      </tr>`;
    }).join('');
    document.getElementById('campaigns-count').textContent =
      `${state.campaigns.length} campaigns`;
  }

  /* ── Emails Table ── */
  function renderEmailsTable(searchQuery = '') {
    const q = searchQuery || document.getElementById('emails-search').value.toLowerCase();
    const filtered = state.emails.filter(e =>
      !q || e.subject.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    );
    const tbody = document.getElementById('emails-tbody');
    tbody.innerHTML = filtered.map(e => {
      const s = e.stats || {};
      const created = e.created
        ? new Date(e.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      return `<tr>
        <td>${escHtml(e.subject || e.name || '—')}</td>
        <td>${statusPill((e.status || '').toLowerCase())}</td>
        <td>${(s.sent || 0).toLocaleString()}</td>
        <td>${(s.delivered || 0).toLocaleString()}</td>
        <td>${(s.opens || 0).toLocaleString()}</td>
        <td>${(s.clicks || 0).toLocaleString()}</td>
        <td>${(s.unsubscribes || 0).toLocaleString()}</td>
        <td>${created}</td>
      </tr>`;
    }).join('');
    document.getElementById('emails-count').textContent = `${filtered.length} emails`;
  }

  /* ── Helpers ── */
  function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
  }

  function statusPill(status) {
    const map = {
      new: 'pill-new', open: 'pill-open', in_progress: 'pill-progress',
      qualified: 'pill-qualified', unqualified: 'pill-unqualified',
      sent: 'pill-sent', draft: 'pill-draft', scheduled: 'pill-scheduled',
      active: 'pill-active', completed: 'pill-qualified',
    };
    const cls = map[status] || 'pill-draft';
    const label = status.replace(/_/g, ' ') || 'unknown';
    return `<span class="pill ${cls}">${escHtml(label)}</span>`;
  }

  function renderPagination(containerId, totalPages, currentPage, onClick) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    const pages = [];
    for (let i = 1; i <= Math.min(totalPages, 7); i++) pages.push(i);
    container.innerHTML = pages.map(p =>
      `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
    ).join('');
    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => onClick(parseInt(btn.dataset.page)));
    });
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
