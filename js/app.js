/**
 * VenueIQ — Main Application Module
 * Orchestrates all modules, handles routing, events, and lifecycle.
 * @module app
 */

'use strict';

(async () => {

  const { $, $$, addEventListeners, debounce, addRipple,
          formatNumber, formatDuration, formatPercent, formatCurrency,
          formatRelativeTime, formatFullDateTime, animateNumber,
          statusToColor, uniqueId } = window.VenueIQ.Utils;
  const { Security }  = window.VenueIQ;
  const { DataStore } = window.VenueIQ;
  const { Charts }    = window.VenueIQ;

  /* ================================================================== */
  /*  Loading Screen                                                      */
  /* ================================================================== */

  const showLoading = async () => {
    const bar    = $('#loading-bar');
    const status = $('#loading-status');
    const steps  = [
      [10,  'Initializing platform...'],
      [30,  'Loading venue data...'],
      [55,  'Connecting live feeds...'],
      [75,  'Generating crowd models...'],
      [90,  'Setting up charts...'],
      [100, 'Ready!'],
    ];

    for (const [pct, msg] of steps) {
      if (bar)    bar.style.width = `${pct}%`;
      if (status) status.textContent = msg;
      await new Promise(r => setTimeout(r, 320 + Math.random() * 180));
    }

    const screen = $('#loading-screen');
    if (screen) {
      screen.classList.add('hidden');
      setTimeout(() => { screen.hidden = true; }, 400);
    }
  };

  /* ================================================================== */
  /*  View Router                                                         */
  /* ================================================================== */

  /** @type {Map<string, function>} */
  const _viewInitializers = new Map();
  const _viewsInitialized = new Set();

  /**
   * Navigate to a view by name.
   * @param {string} viewName
   */
  const navigateTo = (viewName) => {
    const sanitized = Security.sanitizeText(viewName, 32);
    if (!sanitized) return;

    // Update nav buttons
    $$('.nav-btn').forEach(btn => {
      const isActive = btn.dataset.view === sanitized;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // Show/hide views
    $$('.view').forEach(view => {
      const isActive = view.dataset.view === sanitized;
      view.classList.toggle('active', isActive);
      view.hidden = !isActive;
    });

    // Update breadcrumb
    const breadcrumb = $('#breadcrumb-current');
    if (breadcrumb) {
      const labels = {
        dashboard: 'Dashboard', crowd: 'Crowd Flow', queues: 'Queue Manager',
        map: 'Venue Map', emergency: 'Emergency', analytics: 'Analytics',
        accessibility: 'Accessibility', notifications: 'Notifications',
      };
      breadcrumb.textContent = labels[sanitized] || sanitized;
    }

    // Announce view change to screen readers
    announceToScreenReader(`Navigated to ${$('#breadcrumb-current')?.textContent || sanitized}`);

    // Initialize view if not yet
    if (!_viewsInitialized.has(sanitized) && _viewInitializers.has(sanitized)) {
      _viewInitializers.get(sanitized)();
      _viewsInitialized.add(sanitized);
    }

    // Update state
    DataStore.set('app.currentView', sanitized);

    // Update URL hash for bookmarkability and back/forward support
    if (window.location.hash.replace('#', '') !== sanitized) {
      window.history.pushState(null, '', `#${sanitized}`);
    }

    // Focus main content for keyboard/screen reader users
    const main = $('#main-content');
    if (main) { main.focus(); }

    // Track with Google Analytics
    trackPageView(sanitized);
  };

  /* ================================================================== */
  /*  Accessibility: aria-live announcements                             */
  /* ================================================================== */

  const announceToScreenReader = (msg, priority = 'polite') => {
    const el = priority === 'assertive'
      ? $('#aria-live-assertive')
      : $('#aria-live-polite');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = Security.sanitizeText(msg, 200); }, 50);
  };

  /* ================================================================== */
  /*  Toast Notifications                                                 */
  /* ================================================================== */

  /**
   * Show a toast notification.
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} [opts.message]
   * @param {'info'|'success'|'warning'|'danger'} [opts.type='info']
   * @param {number} [opts.duration=4000]
   */
  const showToast = ({ title, message = '', type = 'info', duration = 4000 }) => {
    const container = $('#toast-container');
    if (!container) return;

    const icons = { info: 'ℹ', success: '✓', warning: '⚠', danger: '✕' };
    const id = uniqueId('toast');

    const toast = Security.createElement('div', {
      class: `toast ${type}`,
      role: 'alert',
      id,
      'aria-label': `${type}: ${Security.sanitizeText(title)}`,
    });

    const iconEl = Security.createElement('span', { class: 'toast-icon', 'aria-hidden': 'true' }, [icons[type] || 'ℹ']);
    const contentEl = Security.createElement('div', { class: 'toast-content' });
    const titleEl = Security.createElement('div', { class: 'toast-title', textContent: title });
    const msgEl = Security.createElement('div', { class: 'toast-message', textContent: message });
    const closeBtn = Security.createElement('button', { class: 'toast-close', 'aria-label': 'Dismiss notification' }, ['✕']);

    contentEl.append(titleEl, msgEl);
    toast.append(iconEl, contentEl, closeBtn);
    container.prepend(toast);

    const dismiss = () => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    };
    closeBtn.addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);

    // Announce to screen reader
    announceToScreenReader(`${type} notification: ${title}. ${message}`, type === 'danger' ? 'assertive' : 'polite');
  };

  /* ================================================================== */
  /*  Dashboard Render                                                    */
  /* ================================================================== */

  const renderDashboard = () => {
    updateStatCards();
    renderZonesList();
    renderQueueListPreview();
    renderAlertsList();
    renderStaffGrid();
    renderWeatherCard();
    renderMiniHeatmap();
    startStatAnimations();
  };

  const updateStatCards = () => {
    const venue  = DataStore.get('venue');
    const stats  = DataStore.get('stats');
    const zones  = DataStore.get('zones');

    const attendance = venue?.currentAttendance ?? 0;
    const pct = ((attendance / venue?.capacity) * 100).toFixed(1);

    setStatValue('stat-attendance', formatNumber(attendance));
    setStatValue('stat-wait', formatDuration(stats?.avgWaitMinutes));
    setStatValue('stat-incidents', DataStore.get('incidents')?.length ?? 0);
    setStatValue('stat-satisfaction', formatPercent(stats?.satisfactionPct));
    setStatValue('stat-gates', `${venue?.gatesOpen}/${venue?.gatesTotal}`);
    setStatValue('stat-revenue', formatCurrency(stats?.revenueRupees));

    // Update attendance display in topbar
    const attDisplay = $('#attendance-display');
    if (attDisplay) attDisplay.textContent = formatNumber(attendance);
  };

  const setStatValue = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.textContent = value;
  };

  const renderZonesList = () => {
    const container = $('#zones-list');
    if (!container) return;
    container.innerHTML = '';
    const zones = DataStore.get('zones') ?? [];

    zones.forEach(zone => {
      const pct = zone.current / zone.capacity;
      const item = Security.createElement('div', { class: 'zone-item', role: 'listitem' });
      const dot  = Security.createElement('span', { class: `zone-dot ${zone.status}`, 'aria-hidden': 'true' });
      const name = Security.createElement('span', { class: 'zone-name', textContent: zone.name });
      const count= Security.createElement('span', { class: 'zone-count', textContent: formatNumber(zone.current) });
      const bar  = Security.createElement('div',  { class: 'zone-bar', 'aria-label': `${Math.round(pct*100)}% capacity` });
      const fill = Security.createElement('div',  { class: 'zone-bar-fill' });
      fill.style.cssText = `width:${pct*100}%;background:${statusToColor(zone.status)};`;
      bar.appendChild(fill);
      item.setAttribute('aria-label', `${zone.name}: ${formatNumber(zone.current)} of ${formatNumber(zone.capacity)} — ${zone.status}`);
      item.append(dot, name, count, bar);
      container.appendChild(item);
    });
  };

  const renderQueueListPreview = () => {
    const container = $('#queue-list-preview');
    if (!container) return;
    container.innerHTML = '';
    const queues = DataStore.get('queues') ?? [];
    const top5 = [...queues].sort((a, b) => b.waitMin - a.waitMin).slice(0, 5);

    top5.forEach(q => {
      const item = Security.createElement('div', { class: 'queue-item', role: 'listitem' });
      const dot  = Security.createElement('span', { class: `queue-status-dot`, 'aria-hidden': 'true' });
      dot.style.background = statusToColor(q.status);
      const name = Security.createElement('span', { class: 'queue-item-name', textContent: q.name });
      const wait = Security.createElement('span', { class: `queue-wait ${q.status}`, textContent: formatDuration(q.waitMin) });
      item.setAttribute('aria-label', `${q.name}: ${formatDuration(q.waitMin)} wait`);
      item.append(dot, name, wait);
      container.appendChild(item);
    });
  };

  const renderAlertsList = () => {
    const container = $('#alerts-list');
    if (!container) return;
    container.innerHTML = '';
    const alerts = DataStore.get('alerts') ?? [];

    alerts.forEach(alert => {
      const item = Security.createElement('div', { class: `alert-item ${alert.type}`, role: 'listitem',
        'aria-label': `${alert.type} alert: ${Security.sanitizeText(alert.title)}` });
      const icon    = Security.createElement('span', { class: 'alert-icon', 'aria-hidden': 'true' }, [alert.icon]);
      const content = Security.createElement('div', { class: 'alert-content' });
      const title   = Security.createElement('div', { class: 'alert-title', textContent: alert.title });
      const desc    = Security.createElement('div', { class: 'alert-desc',  textContent: alert.desc });
      const time    = Security.createElement('div', { class: 'alert-time',  textContent: formatRelativeTime(alert.time) });
      const action  = Security.createElement('button', { class: 'alert-action', 'aria-label': `Resolve alert: ${Security.sanitizeText(alert.title)}` }, ['Resolve']);
      action.addEventListener('click', () => resolveAlert(alert.id));
      content.append(title, desc, time);
      item.append(icon, content, action);
      container.appendChild(item);
    });
  };

  const resolveAlert = (id) => {
    const alerts = DataStore.get('alerts').filter(a => a.id !== id);
    DataStore.set('alerts', alerts);
    renderAlertsList();
    showToast({ title: 'Alert Resolved', message: 'The alert has been marked as resolved.', type: 'success', duration: 3000 });
    announceToScreenReader('Alert resolved successfully.');
  };

  const renderStaffGrid = () => {
    const container = $('#staff-grid');
    if (!container) return;
    container.innerHTML = '';
    const staff = DataStore.get('staff') ?? [];

    staff.forEach(s => {
      const item = Security.createElement('div', { class: 'staff-item', role: 'listitem',
        'aria-label': `${s.area}: ${s.count} staff deployed` });
      const icon  = Security.createElement('span', { class: 'staff-icon', 'aria-hidden': 'true' }, [s.icon]);
      const info  = Security.createElement('div', { class: 'staff-info' });
      const area  = Security.createElement('div', { class: 'staff-area', textContent: s.area });
      const count = Security.createElement('div', { class: 'staff-count', textContent: `${s.count} staff deployed` });
      const status= Security.createElement('div', { class: 'staff-status', 'aria-hidden': 'true' });
      info.append(area, count);
      item.append(icon, info, status);
      container.appendChild(item);
    });
  };

  const renderWeatherCard = () => {
    const container = $('#weather-details');
    if (!container) return;
    container.innerHTML = '';
    const w = DataStore.get('venue.weather');
    if (!w) return;

    const metrics = [
      { icon: '🌡', val: `${w.temp}°C`, lbl: 'Temperature', sub: `Feels ${w.feelsLike}°C` },
      { icon: '💧', val: `${w.humidity}%`, lbl: 'Humidity', sub: 'Moderate' },
      { icon: '💨', val: `${w.windKmh} km/h`, lbl: 'Wind Speed', sub: 'Light breeze' },
      { icon: '⛅', val: w.condition, lbl: 'Condition', sub: 'Stadium open' },
    ];

    metrics.forEach(m => {
      const el = Security.createElement('div', { class: 'weather-metric', 'aria-label': `${m.lbl}: ${m.val}` });
      el.innerHTML = `<span class="weather-metric-icon" aria-hidden="true">${m.icon}</span>
        <span class="weather-metric-value">${Security.sanitizeText(m.val)}</span>
        <span class="weather-metric-label">${Security.sanitizeText(m.lbl)}</span>
        <span class="weather-metric-sub">${Security.sanitizeText(m.sub)}</span>`;
      container.appendChild(el);
    });
  };

  const renderMiniHeatmap = () => {
    const canvas = $('#crowd-heatmap-mini');
    if (!canvas) return;
    const zones = DataStore.get('zones') ?? [];
    const grid = Charts.generateDensityGrid(zones, 20, 35);
    Charts.drawHeatmap(canvas, grid, { showAnnotations: true });
  };

  const startStatAnimations = () => {
    const sparkData = {
      'spark-attendance': [65000, 67000, 69000, 70000, 71000, 72340],
      'spark-wait':        [6.5, 5.8, 5.2, 4.9, 4.5, 4.2],
      'spark-incidents':   [1, 2, 1, 3, 3, 3],
      'spark-satisfaction':[90, 91, 92, 93, 94, 94.7],
    };

    Object.entries(sparkData).forEach(([id, data]) => {
      const canvas = $(`#${id}`);
      if (canvas) {
        Charts.drawSparkline(canvas, data, { color: id.includes('incidents') ? '#ff6b6b' : '#6C63FF' });
      }
    });
  };

  /* ================================================================== */
  /*  Date/Time Clock                                                     */
  /* ================================================================== */

  const startClock = () => {
    const update = () => {
      const dt = $('#current-datetime');
      const lastUpdated = $('#last-updated');
      const now = new Date();
      if (dt) {
        dt.textContent = formatFullDateTime(now);
        // Keep machine-readable datetime in sync
        dt.setAttribute('datetime', now.toISOString().slice(0, 10));
      }
      if (lastUpdated) lastUpdated.textContent = 'Updated just now';
    };
    update();
    setInterval(update, 60_000);
  };

  /* ================================================================== */
  /*  Theme Toggle                                                        */
  /* ================================================================== */

  const initThemeToggle = () => {
    const toggleBtn = $('#theme-toggle');
    const body = document.body;
    const savedTheme = Security.lsGet('theme', 'dark');
    applyTheme(savedTheme);

    toggleBtn?.addEventListener('click', () => {
      const current = body.classList.contains('theme-light') ? 'light' : 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Security.lsSet('theme', next);

      // Update GA
      typeof gtag !== 'undefined' && gtag('event', 'theme_change', { theme: next });
    });
  };

  const applyTheme = (theme) => {
    const body = document.body;
    const icon = $('#theme-icon');
    body.classList.remove('theme-dark', 'theme-light');
    body.classList.add(`theme-${theme}`);
    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀';
    body.setAttribute('data-theme', theme);
    $('#theme-toggle')?.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  };

  /* ================================================================== */
  /*  Sidebar Toggle                                                      */
  /* ================================================================== */

  const initSidebar = () => {
    const sidebar     = $('#sidebar');
    const toggleBtn   = $('#sidebar-toggle');
    const mobileBtn   = $('#mobile-menu-btn');

    toggleBtn?.addEventListener('click', () => {
      const collapsed = sidebar.classList.toggle('collapsed');
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      Security.lsSet('sidebar-collapsed', collapsed);
    });

    mobileBtn?.addEventListener('click', () => {
      const open = sidebar.classList.toggle('mobile-open');
      mobileBtn.setAttribute('aria-expanded', String(open));
      // Backdrop click closes
      if (open) {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;z-index:299;background:rgba(0,0,0,0.5);';
        backdrop.id = 'mobile-backdrop';
        backdrop.addEventListener('click', () => {
          sidebar.classList.remove('mobile-open');
          mobileBtn.setAttribute('aria-expanded', 'false');
          backdrop.remove();
        });
        document.body.appendChild(backdrop);
      } else {
        $('#mobile-backdrop')?.remove();
      }
    });

    // Restore collapsed state
    if (Security.lsGet('sidebar-collapsed', false)) {
      sidebar?.classList.add('collapsed');
    }
  };

  /* ================================================================== */
  /*  Navigation Event Binding                                            */
  /* ================================================================== */

  const initNavigation = () => {
    // Nav buttons
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        if (view) navigateTo(view);
      });
    });

    // Delegate clicks on data-view buttons (cross-links in dashboard cards)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (btn && !btn.classList.contains('nav-btn') && !btn.classList.contains('map-layer-btn')) {
        const view = btn.dataset.view;
        if (view) navigateTo(view);
      }
    });

    // Keyboard navigation: Escape returns focus
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });
  };

  /* ================================================================== */
  /*  Global Search                                                       */
  /* ================================================================== */

  const initGlobalSearch = () => {
    const input   = $('#global-search');
    const results = $('#search-results');
    if (!input || !results) return;

    const searchData = [
      { label: 'Gate A — Entry',       view: 'queues',  icon: '🚪' },
      { label: 'Gate B — Entry',       view: 'queues',  icon: '🚪' },
      { label: 'North Stand',          view: 'crowd',   icon: '🏟' },
      { label: 'East Stand',           view: 'crowd',   icon: '🏟' },
      { label: 'Food Court N1',        view: 'queues',  icon: '🍕' },
      { label: 'First Aid Center',     view: 'emergency',icon: '🏥' },
      { label: 'Emergency Contacts',   view: 'emergency',icon: '☎' },
      { label: 'Crowd Flow Analysis',  view: 'crowd',   icon: '👥' },
      { label: 'Analytics Dashboard',  view: 'analytics',icon: '📊' },
      { label: 'Accessibility Services',view:'accessibility',icon:'♿' },
    ];

    const handleSearch = debounce((q) => {
      const query = Security.sanitizeText(q, 100).toLowerCase().trim();
      if (!query) { results.hidden = true; return; }

      const matches = searchData.filter(d => d.label.toLowerCase().includes(query)).slice(0, 5);
      results.innerHTML = '';
      results.hidden = !matches.length;

      matches.forEach(match => {
        const item = Security.createElement('div', {
          class: 'search-result-item',
          role: 'option',
          'aria-label': match.label,
          tabindex: '0',
        });
        item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;';
        item.innerHTML = `<span aria-hidden="true">${match.icon}</span><span>${Security.sanitizeText(match.label)}</span>`;
        item.addEventListener('click', () => {
          navigateTo(match.view);
          input.value = '';
          results.hidden = true;
        });
        item.addEventListener('mouseover', () => { item.style.background = 'var(--surface-raised)'; });
        item.addEventListener('mouseout',  () => { item.style.background = ''; });
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter') item.click(); });
        results.appendChild(item);
      });
    }, 250);

    input.addEventListener('input', (e) => handleSearch(e.target.value));
    input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));
    input.addEventListener('focus', (e) => { if (e.target.value) handleSearch(e.target.value); });
  };

  /* ================================================================== */
  /*  Char Counter for Textareas                                          */
  /* ================================================================== */

  const initCharCounters = () => {
    [
      ['broadcast-msg', 'broadcast-msg-count', 500],
      ['quick-msg', 'quick-msg-count', 280],
    ].forEach(([inputId, countId, max]) => {
      const input = $(`#${inputId}`);
      const counter = $(`#${countId}`);
      if (!input || !counter) return;
      input.addEventListener('input', () => {
        const len = input.value.length;
        counter.textContent = `${len}/${max}`;
        counter.style.color = len > max * 0.9 ? 'var(--color-warning)' : '';
      });
    });
  };

  /* ================================================================== */
  /*  Modals                                                              */
  /* ================================================================== */

  const openModal = (overlayId, modalId) => {
    const overlay = $(`#${overlayId}`);
    const modal   = $(`#${modalId}`);
    if (!overlay || !modal) return;
    overlay.hidden = false;
    overlay.removeAttribute('aria-hidden');
    // Focus modal
    setTimeout(() => { modal.focus(); }, 50);
  };

  const closeModal = (overlayId) => {
    const overlay = $(`#${overlayId}`);
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  };

  const closeModals = () => {
    ['a11y-modal-overlay', 'incident-modal-overlay'].forEach(id => closeModal(id));
  };

  const initModals = () => {
    // A11y modal
    $('#a11y-toggle')?.addEventListener('click', () => openModal('a11y-modal-overlay', 'a11y-modal'));
    $('#a11y-modal-close')?.addEventListener('click', () => closeModal('a11y-modal-overlay'));
    $('#a11y-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'a11y-modal-overlay') closeModal('a11y-modal-overlay');
    });

    // Incident modal
    $('#add-incident')?.addEventListener('click', () => openModal('incident-modal-overlay', 'incident-modal'));
    $('#incident-modal-close')?.addEventListener('click', () => closeModal('incident-modal-overlay'));
    $('#cancel-incident')?.addEventListener('click', () => closeModal('incident-modal-overlay'));
    $('#incident-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'incident-modal-overlay') closeModal('incident-modal-overlay');
    });

    // Incident form
    $('#incident-form')?.addEventListener('submit', handleIncidentSubmit);
  };

  const handleIncidentSubmit = (e) => {
    e.preventDefault();
    if (!Security.checkRateLimit('incident-submit', 5, 60000)) {
      showToast({ title: 'Rate Limited', message: 'Too many submissions. Please wait.', type: 'warning' });
      return;
    }
    const form = e.target;
    const { valid, errors } = Security.validateForm(form);
    if (!valid) {
      const firstError = Object.values(errors)[0];
      showToast({ title: 'Validation Error', message: firstError, type: 'warning' });
      return;
    }
    const type     = Security.sanitizeText($('#incident-type')?.value);
    const location = Security.sanitizeText($('#incident-location')?.value);
    const severity = Security.sanitizeText($('#incident-severity')?.value);
    const desc     = Security.sanitizeText($('#incident-desc')?.value);

    const typeIcons = { medical:'🚑', security:'🔒', crowd:'👥', infrastructure:'🔧', fire:'🔥', other:'❗' };
    const newIncident = {
      id: uniqueId('i'),
      type, title: `New ${type} Incident`, location,
      severity, status: 'active',
      desc, time: Date.now(),
      icon: typeIcons[type] || '❗',
    };

    const incidents = DataStore.get('incidents') ?? [];
    DataStore.set('incidents', [newIncident, ...incidents]);

    closeModal('incident-modal-overlay');
    form.reset();
    showToast({ title: 'Incident Reported', message: `${newIncident.title} logged at ${location}`, type: 'danger', duration: 5000 });
    announceToScreenReader(`New incident reported: ${newIncident.title} at ${location}`);
    typeof gtag !== 'undefined' && gtag('event', 'incident_reported', { incident_type: type, severity });
  };

  /* ================================================================== */
  /*  Broadcast Form                                                      */
  /* ================================================================== */

  const initBroadcastForm = () => {
    const form = $('#broadcast-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Security.checkRateLimit('broadcast', 3, 60000)) {
        showToast({ title: 'Rate Limited', message: 'Broadcast limit reached. Wait 1 minute.', type: 'warning' });
        return;
      }
      const { valid, errors } = Security.validateForm(form);
      if (!valid) {
        showToast({ title: 'Validation Error', message: Object.values(errors)[0], type: 'warning' });
        return;
      }
      const type = Security.sanitizeText($('#broadcast-type')?.value);
      const msg  = Security.sanitizeText($('#broadcast-msg')?.value);
      if (!type || !msg) {
        showToast({ title: 'Missing Fields', message: 'Alert type and message are required.', type: 'warning' });
        return;
      }

      showToast({ title: 'Broadcast Sent!', message: `"${msg.slice(0, 40)}..." sent to all zones.`, type: 'success', duration: 5000 });
      announceToScreenReader(`Broadcast sent: ${type} alert — ${msg.slice(0, 60)}`);
      form.reset();
      typeof gtag !== 'undefined' && gtag('event', 'broadcast_sent', { alert_type: type });
    });
  };

  const initQuickBroadcast = () => {
    const form = $('#quick-broadcast-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = Security.sanitizeText($('#quick-msg')?.value);
      if (!msg) return;
      showToast({ title: 'Quick Broadcast Sent', message: msg.slice(0, 60), type: 'success' });
      form.reset();
      $('#quick-msg-count').textContent = '0/280';
    });
  };

  /* ================================================================== */
  /*  Dashboard Refresh / Export                                          */
  /* ================================================================== */

  const initDashboardActions = () => {
    $('#refresh-dashboard')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm" aria-hidden="true"></span> Refreshing...';
      await new Promise(r => setTimeout(r, 800));
      renderDashboard();
      btn.disabled = false;
      btn.innerHTML = '<span aria-hidden="true">↻</span> Refresh';
      showToast({ title: 'Dashboard Updated', message: 'All metrics refreshed from live feed.', type: 'success', duration: 2500 });
    });

    $('#export-report')?.addEventListener('click', () => {
      if (!Security.checkRateLimit('export', 3)) {
        showToast({ title: 'Export Limit', message: 'Please wait before exporting again.', type: 'warning' });
        return;
      }
      exportReportCSV();
    });
  };

  const exportReportCSV = () => {
    const venue = DataStore.get('venue');
    const stats = DataStore.get('stats');
    const queues = DataStore.get('queues');

    const rows = [
      ['VenueIQ Operations Report', new Date().toISOString()],
      [''],
      ['Metric', 'Value'],
      ['Attendance', venue?.currentAttendance],
      ['Capacity', venue?.capacity],
      ['Avg Wait (min)', stats?.avgWaitMinutes],
      ['Satisfaction (%)', stats?.satisfactionPct],
      ['Revenue (₹)', stats?.revenueRupees],
      [''],
      ['Queue Name', 'Category', 'Wait (min)', 'People', 'Status'],
      ...(queues ?? []).map(q => [q.name, q.category, q.waitMin, q.peopleInQueue, q.status]),
    ];

    const csvContent = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `venueiq-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast({ title: 'Report Exported', message: 'CSV report downloaded successfully.', type: 'success' });
    typeof gtag !== 'undefined' && gtag('event', 'report_exported');
  };

  /* ================================================================== */
  /*  Ripple on all buttons                                               */
  /* ================================================================== */

  const initRippleEffects = () => {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (btn) addRipple(e);
    }, { passive: true });
  };

  /* ================================================================== */
  /*  Live Data Subscriptions                                             */
  /* ================================================================== */

  const initLiveSubscriptions = () => {
    DataStore.subscribe('tick', () => {
      const view = DataStore.get('app.currentView');
      if (view === 'dashboard') {
        updateStatCards();
        renderZonesList();
        renderQueueListPreview();
      }
    });

    DataStore.subscribe('zones', () => {
      if (DataStore.get('app.currentView') === 'crowd') {
        window.VenueIQ.CrowdFlow?.updateHeatmap?.();
      }
    });

    DataStore.subscribe('queues', () => {
      if (DataStore.get('app.currentView') === 'queues') {
        window.VenueIQ.QueueManager?.refresh?.();
      }
    });
  };

  /* ================================================================== */
  /*  Register View Initializers                                          */
  /* ================================================================== */

  const registerViewInits = () => {
    _viewInitializers.set('crowd',        () => window.VenueIQ.CrowdFlow?.init?.());
    _viewInitializers.set('queues',       () => window.VenueIQ.QueueManager?.init?.());
    _viewInitializers.set('map',          () => window.VenueIQ.Maps?.init?.());
    _viewInitializers.set('emergency',    () => window.VenueIQ.Emergency?.init?.());
    _viewInitializers.set('analytics',    () => window.VenueIQ.Analytics?.init?.());
    _viewInitializers.set('accessibility',() => window.VenueIQ.Accessibility?.init?.());
    _viewInitializers.set('notifications',() => window.VenueIQ.Notifications?.init?.());
  };

  /* ================================================================== */
  /*  Google Analytics Tracking                                           */
  /* ================================================================== */

  const trackPageView = (viewName) => {
    if (typeof gtag === 'undefined') return;
    gtag('event', 'page_view', {
      page_title: `VenueIQ — ${viewName}`,
      page_location: `${window.location.origin}/#${viewName}`,
    });
  };

  /* ================================================================== */
  /*  Application Bootstrap                                               */
  /* ================================================================== */

  const bootstrap = async () => {
    try {
      // Show loading
      await showLoading();

      // Initialize all modules
      initSidebar();
      initNavigation();
      initThemeToggle();
      initGlobalSearch();
      initCharCounters();
      initModals();
      initBroadcastForm();
      initQuickBroadcast();
      initDashboardActions();
      initRippleEffects();
      registerViewInits();
      startClock();

      // Render initial dashboard
      renderDashboard();

      // Start live subscriptions & simulation
      initLiveSubscriptions();
      DataStore.startSimulation(5000);

      // Mark initialized
      DataStore.set('app.initialized', true);

      // Navigate to default view or URL hash
      const initialHash = window.location.hash.replace('#', '');
      const validViews = ['dashboard','crowd','queues','map','emergency','analytics','accessibility','notifications'];
      navigateTo(validViews.includes(initialHash) ? initialHash : 'dashboard');

      // Show welcome toast
      setTimeout(() => {
        showToast({
          title: 'VenueIQ Live',
          message: 'All systems operational. Live data feed active.',
          type: 'success',
          duration: 5000,
        });
      }, 600);

      // Initialize Firebase (Realtime DB, Auth, Analytics, Perf, Remote Config, FCM)
      window.VenueIQ.FirebaseService?.init?.().then(() => {
        // Log successful app launch to Firebase Analytics
        window.VenueIQ.FirebaseService?.logEvent('venueiq_launched', {
          version: '2.4.1',
          venue: 'MetroArena Stadium',
          view: window.location.hash.replace('#', '') || 'dashboard',
        });
      });

      console.info('[VenueIQ] Application initialized successfully. v2.4.1');

    } catch (error) {
      console.error('[VenueIQ] Bootstrap error:', error);
      const screen = $('#loading-screen');
      const status = $('#loading-status');
      if (status) status.textContent = `Error: ${error.message}. Please refresh.`;
      if (status) status.style.color = 'var(--color-danger)';
    }
  };

  // Expose showToast and announceToScreenReader globally for other modules
  window.VenueIQ.showToast = showToast;
  window.VenueIQ.announceToScreenReader = announceToScreenReader;
  window.VenueIQ.navigateTo = navigateTo;

  // PWA: handle install prompt
  let _deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    console.info('[VenueIQ] PWA install prompt available.');
  });
  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    console.info('[VenueIQ] PWA installed successfully.');
    typeof gtag !== 'undefined' && gtag('event', 'pwa_installed');
  });

  // Global unhandled rejection safety net
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('[VenueIQ] Unhandled promise rejection:', e.reason);
    e.preventDefault();
  });

  // Hash-based routing: restore view from URL hash on load
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    const validViews = ['dashboard','crowd','queues','map','emergency','analytics','accessibility','notifications'];
    if (hash && validViews.includes(hash)) navigateTo(hash);
  });

  // Expose install prompt trigger globally
  window.VenueIQ.promptInstall = async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt = null;
    typeof gtag !== 'undefined' && gtag('event', 'pwa_install_prompt', { outcome });
  };

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  /* ================================================================== */
  /*  Service Worker Registration                                         */
  /* ================================================================== */
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.info('[VenueIQ] Service Worker registered:', reg.scope);

      // Detect when a new SW version is waiting
      const checkForUpdate = (registration) => {
        if (registration.waiting) {
          // New SW is waiting — notify user
          showToast({
            title: '🔄 Update Available',
            message: 'A new version of VenueIQ is ready. Refreshing…',
            type: 'info',
            duration: 4000,
          });
          // Tell the waiting SW to activate immediately
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            checkForUpdate(reg);
          }
        });
      });

      // When the SW controlling this page changes, reload to apply update
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Listen for messages from the SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (!event.data) return;
        switch (event.data.type) {
          case 'DATA_REFRESH_AVAILABLE':
            console.info('[VenueIQ] SW: background data refresh available.');
            break;
          case 'SYNC_COMPLETE':
            console.info('[VenueIQ] SW: background sync complete.');
            break;
          case 'NOTIFICATION_CLICK':
            if (event.data.url) navigateTo(event.data.url.replace(/.*#/, '') || 'dashboard');
            break;
          default:
            break;
        }
      });

      // Register periodic background sync if supported
      if ('periodicSync' in reg) {
        try {
          await reg.periodicSync.register('venueiq-data-refresh', { minInterval: 60 * 60 * 1000 });
          console.info('[VenueIQ] Periodic background sync registered.');
        } catch { /* Permission not granted or not supported */ }
      }

      // Register background sync for offline actions
      if ('sync' in reg) {
        window.VenueIQ.requestBackgroundSync = async () => {
          try { await reg.sync.register('venueiq-background-sync'); }
          catch { /* offline — will sync when online */ }
        };
      }

      // Track installation
      typeof gtag !== 'undefined' && gtag('event', 'sw_registered', { scope: reg.scope });

    } catch (err) {
      console.warn('[VenueIQ] Service Worker registration failed:', err);
    }
  };

  // Register SW after page load to not block initial paint
  window.addEventListener('load', registerServiceWorker);

})();
