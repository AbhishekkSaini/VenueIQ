/**
 * VenueIQ — Analytics Module
 * Google Analytics GA4 integration + internal performance dashboards.
 * @module analytics
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.Analytics = (() => {

  const { Security, DataStore, Charts, Utils } = window.VenueIQ;
  const { $, formatNumber, formatPercent, formatCurrency } = Utils;

  let _isInitialized = false;

  const init = () => {
    if (_isInitialized) return;
    _isInitialized = true;

    renderAttendanceChart();
    renderWaitChart();
    renderRevenueChart();
    renderAIInsights();
    renderGAMetrics();
    initAnalyticsActions();
  };

  /* ------------------------------------------------------------------ */
  /*  Attendance Trend Chart                                              */
  /* ------------------------------------------------------------------ */
  const renderAttendanceChart = () => {
    const canvas = $('#attendance-chart');
    if (!canvas) return;

    Charts.drawLineChart(canvas, {
      labels: ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', 'Now'],
      datasets: [
        {
          label: 'Attendance',
          values: [5200, 18400, 38700, 54200, 65800, 70200, 72100, 72340],
          color: '#6C63FF',
        },
        {
          label: 'Target',
          values: [4000, 16000, 36000, 52000, 64000, 68000, 71000, 74000],
          color: '#00D4AA',
        },
      ],
    }, { smooth: true, showDots: true });
  };

  /* ------------------------------------------------------------------ */
  /*  Wait Time Distribution                                              */
  /* ------------------------------------------------------------------ */
  const renderWaitChart = () => {
    const canvas = $('#wait-chart');
    if (!canvas) return;

    Charts.drawBarChart(canvas, {
      labels: ['0-2m', '2-5m', '5-8m', '8-12m', '12m+'],
      datasets: [
        { label: 'Services', values: [8, 12, 9, 3, 2], color: '#6C63FF' },
      ],
    }, { showGrid: true });
  };

  /* ------------------------------------------------------------------ */
  /*  Revenue Breakdown Donut                                             */
  /* ------------------------------------------------------------------ */
  const renderRevenueChart = () => {
    const canvas = $('#revenue-chart');
    if (!canvas) return;

    Charts.drawDonutChart(canvas, [
      { label: 'Food & Bev', value: 42, color: '#6C63FF' },
      { label: 'Merch',      value: 28, color: '#00D4AA' },
      { label: 'Parking',    value: 18, color: '#ff9f43' },
      { label: 'VIP/Premium',value: 12, color: '#ff6b9d' },
    ], { showLegend: true });
  };

  /* ------------------------------------------------------------------ */
  /*  AI Insights                                                         */
  /* ------------------------------------------------------------------ */
  const AI_INSIGHTS = [
    {
      icon: '🤖', title: 'Staff Reallocation Opportunity',
      desc: 'Gate B is overloaded while Gate D is underutilized. Redirecting 2 staff from Gate D to Gate B could reduce Gate B wait time by ~40%.',
      impact: '↓ 40% wait time at Gate B', positive: true,
    },
    {
      icon: '📈', title: 'Revenue Uplift Identified',
      desc: 'North Stand sections near Gates A/B show high foot traffic but no concessions within 100m. Adding a mobile kiosk could generate ₹3.5L additional revenue.',
      impact: '↑ ₹3.5L estimated revenue', positive: true,
    },
    {
      icon: '⚠', title: 'Crowd Surge Warning',
      desc: 'Historical data predicts a 15,000-attendee surge exodus through Gates C & D in next 45 minutes. Pre-open Gate E immediately.',
      impact: '⚠ Act now — 45 min window', positive: false,
    },
    {
      icon: '✅', title: 'Satisfaction Score Above Target',
      desc: 'App in-venue satisfaction at 94.7%, beating target by 2.3%. Top drivers: shorter queue times and clean facilities. Maintain current staffing.',
      impact: '↑ 2.3% above target', positive: true,
    },
    {
      icon: '🌡', title: 'Heat Stress Risk — Zone E',
      desc: 'Temperature in Zone E (sun-exposed, uncovered) is 34°C. With high humidity, heat stress risk is elevated. Deploy water stations and medical alert.',
      impact: '⚠ Health risk if unaddressed', positive: false,
    },
  ];

  const renderAIInsights = () => {
    const container = $('#ai-insights-list');
    if (!container) return;
    container.innerHTML = '';

    AI_INSIGHTS.forEach(insight => {
      const item = Security.createElement('div', {
        class: 'insight-item',
        role: 'listitem',
        'aria-label': `AI Insight: ${insight.title}`,
      });
      const icon    = Security.createElement('span', { class: 'insight-icon', 'aria-hidden': 'true' }, [insight.icon]);
      const content = Security.createElement('div', { class: 'insight-content' });
      const title   = Security.createElement('div', { class: 'insight-title', textContent: insight.title });
      const desc    = Security.createElement('div', { class: 'insight-desc',  textContent: insight.desc });
      const impact  = Security.createElement('div', {
        class: `insight-impact ${insight.positive ? 'positive' : 'negative'}`,
        textContent: insight.impact,
      });
      const actBtn = Security.createElement('button', {
        class: 'btn btn-ghost btn-sm',
        style: 'margin-top:8px;',
        'aria-label': `Act on insight: ${insight.title}`,
      }, ['Act on this →']);
      actBtn.addEventListener('click', () => {
        window.VenueIQ.showToast?.({ title: 'Action Queued', message: `${insight.title} — action logged.`, type: 'info' });
        typeof gtag !== 'undefined' && gtag('event', 'ai_insight_action', { insight: insight.title });
      });
      content.append(title, desc, impact, actBtn);
      item.append(icon, content);
      container.appendChild(item);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Google Analytics Metrics Panel                                      */
  /* ------------------------------------------------------------------ */
  const renderGAMetrics = () => {
    const container = $('#ga-metrics');
    if (!container) return;
    container.innerHTML = '';

    // Simulated GA4 metrics (in production, fetched from GA4 Data API)
    const metrics = [
      { val: '72,340', lbl: 'Active Users' },
      { val: '4.8 min', lbl: 'Session Duration' },
      { val: '94.7%', lbl: 'App Satisfaction' },
      { val: '18,340', lbl: 'Check-ins Today' },
      { val: '₹28.4L', lbl: 'Digital Revenue' },
      { val: '38,200', lbl: 'App Downloads' },
    ];

    metrics.forEach(m => {
      const el = Security.createElement('div', { class: 'ga-metric', 'aria-label': `${m.lbl}: ${m.val}` });
      const val = Security.createElement('span', { class: 'ga-metric-val', textContent: m.val });
      const lbl = Security.createElement('span', { class: 'ga-metric-lbl', textContent: m.lbl });
      el.append(val, lbl);
      container.appendChild(el);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Actions                                                             */
  /* ------------------------------------------------------------------ */
  const initAnalyticsActions = () => {
    $('#analytics-date-range')?.addEventListener('change', (e) => {
      window.VenueIQ.showToast?.({
        title: 'Range Updated',
        message: `Showing analytics for: ${e.target.options[e.target.selectedIndex].text}`,
        type: 'info',
        duration: 2000,
      });
      typeof gtag !== 'undefined' && gtag('event', 'analytics_date_change', { range: e.target.value });
    });

    $('#download-analytics')?.addEventListener('click', () => {
      if (!Security.checkRateLimit('analytics-download', 3)) {
        window.VenueIQ.showToast?.({ title: 'Rate Limited', message: 'Please wait before downloading again.', type: 'warning' });
        return;
      }
      const stats = DataStore.get('stats');
      const venue = DataStore.get('venue');
      const csv = [
        ['VenueIQ Analytics Report', new Date().toISOString()],
        [''],
        ['Metric', 'Value'],
        ['Attendance', venue?.currentAttendance],
        ['Avg Wait (min)', stats?.avgWaitMinutes],
        ['Satisfaction (%)', stats?.satisfactionPct],
        ['Revenue (₹)', stats?.revenueRupees],
        ['Served Today', stats?.servedToday],
      ].map(r => r.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'venueiq-analytics.csv'; a.click();
      URL.revokeObjectURL(url);
      window.VenueIQ.showToast?.({ title: 'Downloaded', message: 'Analytics report saved as CSV.', type: 'success' });
      typeof gtag !== 'undefined' && gtag('event', 'analytics_downloaded');
    });
  };

  return Object.freeze({ init });

})();
