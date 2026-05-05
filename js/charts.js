/**
 * Chart factory using Chart.js 4.
 * All charts are stored by id and destroyed before recreation.
 */
const Charts = (() => {
  const instances = {};

  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  Chart.defaults.color = '#7b8ab8';

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  /* ── Lead Acquisition Timeline (line) ── */
  function renderLeadsTimeline(labels, data) {
    destroy('leads-timeline-chart');
    const ctx = document.getElementById('leads-timeline-chart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(255,122,89,.25)');
    gradient.addColorStop(1, 'rgba(255,122,89,0)');

    instances['leads-timeline-chart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'New Leads',
          data,
          borderColor: '#ff7a59',
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
          y: { grid: { color: 'rgba(0,0,0,.05)' }, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  /* ── Lead Sources (doughnut) ── */
  function renderLeadSources(labels, data) {
    destroy('lead-sources-chart');
    const ctx = document.getElementById('lead-sources-chart').getContext('2d');
    instances['lead-sources-chart'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#ff7a59','#0091ae','#7850ff','#00b4a0','#00a854','#e8c000'],
          borderWidth: 0,
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } }
        }
      }
    });
  }

  /* ── Campaign Email Performance (grouped bar) ── */
  function renderCampaignPerf(labels, sent, opens, clicks) {
    destroy('campaign-perf-chart');
    const ctx = document.getElementById('campaign-perf-chart').getContext('2d');
    instances['campaign-perf-chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Sent',   data: sent,   backgroundColor: 'rgba(0,145,174,.7)',  borderRadius: 4 },
          { label: 'Opens',  data: opens,  backgroundColor: 'rgba(255,122,89,.7)', borderRadius: 4 },
          { label: 'Clicks', data: clicks, backgroundColor: 'rgba(120,80,255,.7)', borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 14, font: { size: 12 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 25, font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,.05)' }, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  /* ── Lead Status Breakdown (horizontal bar) ── */
  function renderLeadStatus(labels, data) {
    destroy('lead-status-chart');
    const ctx = document.getElementById('lead-status-chart').getContext('2d');
    instances['lead-status-chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#0091ae','#ff7a59','#e8c000','#00a854','#e83c3c'],
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,.05)' }, beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } }
        }
      }
    });
  }

  return { renderLeadsTimeline, renderLeadSources, renderCampaignPerf, renderLeadStatus };
})();
