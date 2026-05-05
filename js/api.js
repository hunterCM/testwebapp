/**
 * HubSpot API client + demo data fallback.
 * All requests use the v3 CRM API and v1 marketing-emails API.
 * Requires a Private App Access Token stored in localStorage.
 */
const HubSpotAPI = (() => {
  const BASE = 'https://api.hubapi.com';
  let _token = null;

  function setToken(t) { _token = t; }
  function getToken()  { return _token; }

  async function request(path, params = {}) {
    const url = new URL(BASE + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${_token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /* ── Contacts (Leads) ── */
  async function getContacts(limit = 100, after = undefined) {
    const params = {
      limit,
      properties: 'firstname,lastname,email,createdate,hs_lead_status,hs_analytics_source,hubspot_owner_id',
      sorts: '-createdate',
    };
    if (after) params.after = after;
    return request('/crm/v3/objects/contacts', params);
  }

  async function getAllContacts(maxPages = 5) {
    let all = [], after;
    for (let i = 0; i < maxPages; i++) {
      const data = await getContacts(100, after);
      all = all.concat(data.results || []);
      after = data.paging?.next?.after;
      if (!after) break;
    }
    return all;
  }

  /* ── Deals ── */
  async function getDeals(limit = 100) {
    return request('/crm/v3/objects/deals', {
      limit,
      properties: 'dealname,amount,dealstage,createdate,closedate,pipeline',
      sorts: '-createdate',
    });
  }

  /* ── Marketing Emails with Statistics ── */
  async function getMarketingEmails(limit = 50) {
    return request('/marketing-emails/v1/emails/with-statistics', {
      limit,
      orderBy: '-created',
    });
  }

  /* ── Campaigns ── */
  async function getCampaigns(limit = 20) {
    return request('/marketing/v3/campaigns', { limit });
  }

  return { setToken, getToken, getAllContacts, getDeals, getMarketingEmails, getCampaigns, request };
})();


/* ═══════════════════════════════════════
   Demo Data — used when no token is set
═══════════════════════════════════════ */
const DemoData = (() => {
  const SOURCES = ['Organic Search', 'Direct Traffic', 'Social Media', 'Email', 'Paid Search', 'Referral'];
  const STATUSES = ['new', 'open', 'in_progress', 'qualified', 'unqualified'];
  const FIRST = ['Liam','Emma','Noah','Olivia','James','Sophia','Ethan','Ava','Lucas','Mia','Mason','Isabella','Logan','Charlotte','Aiden'];
  const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas'];

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dateAgo(days) {
    const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString();
  }
  function avatarColor(name) {
    const colors = ['#ff7a59','#0091ae','#7850ff','#00b4a0','#00a854','#e83c3c'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  function contacts(n = 200) {
    return Array.from({ length: n }, (_, i) => {
      const first = pick(FIRST), last = pick(LAST);
      return {
        id: `c${i + 1}`,
        properties: {
          firstname: first,
          lastname: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${rand(1,99)}@example.com`,
          createdate: dateAgo(rand(0, 89)),
          hs_lead_status: pick(STATUSES),
          hs_analytics_source: pick(SOURCES),
        },
        _avatarColor: avatarColor(first),
      };
    });
  }

  const CAMPAIGN_NAMES = [
    'Q2 Product Launch','Summer Promo','Webinar Invite Series','Re-engagement Blast',
    'Welcome Nurture','Newsletter May','Black Friday Teaser','Customer Win-back',
  ];

  function campaigns() {
    return CAMPAIGN_NAMES.map((name, i) => ({
      id: `camp${i}`,
      properties: { name, type: i % 2 === 0 ? 'EMAIL' : 'MULTI_TOUCH', status: i < 5 ? 'ACTIVE' : 'COMPLETED' },
      stats: {
        sent: rand(800, 8000),
        opens: rand(200, 3000),
        clicks: rand(80, 1200),
        unsubscribes: rand(2, 40),
      },
    }));
  }

  const EMAIL_SUBJECTS = [
    '🚀 Introducing our new feature','Your monthly insights report','Last chance: offer ends Friday',
    'How [Customer] increased ROI by 3x','Join us for a live demo','Welcome to MarketingHub!',
    'Tips to improve your campaigns','New case study inside',
  ];

  function emails() {
    return EMAIL_SUBJECTS.map((subject, i) => {
      const sent = rand(500, 10000);
      const delivered = Math.floor(sent * (rand(93, 99) / 100));
      const opens = Math.floor(delivered * (rand(15, 45) / 100));
      const clicks = Math.floor(opens * (rand(10, 40) / 100));
      return {
        id: `em${i}`,
        name: subject,
        subject,
        status: i < 6 ? 'SENT' : 'DRAFT',
        created: dateAgo(rand(1, 80)),
        stats: { sent, delivered, opens, clicks, unsubscribes: rand(1, 30) },
      };
    });
  }

  /* Daily lead counts for last N days */
  function leadTimeline(days = 30, allContacts) {
    const map = {};
    const now = Date.now();
    for (let d = 0; d < days; d++) {
      const dt = new Date(now - d * 86400000);
      map[dt.toISOString().slice(0, 10)] = 0;
    }
    allContacts.forEach(c => {
      const day = c.properties.createdate.slice(0, 10);
      if (map[day] !== undefined) map[day]++;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }

  return { contacts, campaigns, emails, leadTimeline };
})();
