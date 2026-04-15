/**
 * VenueIQ — Accessibility Module
 * WCAG 2.1 AA+ compliance tools, preference management, service requests.
 * @module accessibility
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.Accessibility = (() => {

  const { Security, DataStore, Charts, Utils } = window.VenueIQ;
  const { $, $$, formatRelativeTime } = Utils;

  let _isInitialized = false;

  // User preferences stored in localStorage
  const PREFS_KEY = 'a11y-prefs';
  let _prefs = Security.lsGet(PREFS_KEY, {
    highContrast:  false,
    largeText:     false,
    reduceMotion:  false,
    dyslexiaMode:  false,
    colorBlind:    false,
    keyboardNav:   false,
  });

  const init = () => {
    if (_isInitialized) return;
    _isInitialized = true;

    applyPreferences(_prefs);
    renderA11yServices();
    renderA11yRequests();
    renderA11yChart();
    renderA11ySettings();
    initModalContent();
  };

  /* ------------------------------------------------------------------ */
  /*  Apply Preferences                                                   */
  /* ------------------------------------------------------------------ */
  const applyPreferences = (prefs) => {
    const body = document.body;
    body.classList.toggle('high-contrast', !!prefs.highContrast);
    body.classList.toggle('large-text',    !!prefs.largeText);
    body.classList.toggle('reduce-motion', !!prefs.reduceMotion);
    body.classList.toggle('dyslexia-mode', !!prefs.dyslexiaMode);
    body.classList.toggle('colorblind-mode',!!prefs.colorBlind);
    body.classList.toggle('keyboard-nav',  !!prefs.keyboardNav);
    Security.lsSet(PREFS_KEY, prefs);
  };

  const togglePref = (key) => {
    _prefs[key] = !_prefs[key];
    applyPreferences(_prefs);
    window.VenueIQ.announceToScreenReader?.(`${key} ${_prefs[key] ? 'enabled' : 'disabled'}`);
    typeof gtag !== 'undefined' && gtag('event', 'a11y_preference', { setting: key, enabled: _prefs[key] });
  };

  /* ------------------------------------------------------------------ */
  /*  Services List                                                       */
  /* ------------------------------------------------------------------ */
  const renderA11yServices = () => {
    const container = $('#a11y-services');
    if (!container) return;
    container.innerHTML = '';
    const services = DataStore.get('a11y.services') ?? [];

    services.forEach(svc => {
      const item = Security.createElement('div', { class: 'a11y-service-item', role: 'listitem',
        'aria-label': `${svc.name}: ${svc.desc}` });
      const icon  = Security.createElement('span', { class: 'a11y-service-icon', 'aria-hidden': 'true' }, [svc.icon]);
      const info  = Security.createElement('div', { class: 'a11y-service-info' });
      const name  = Security.createElement('div', { class: 'a11y-service-name', textContent: svc.name });
      const desc  = Security.createElement('div', { class: 'a11y-service-desc', textContent: svc.desc });
      const count = Security.createElement('div', { class: 'a11y-service-count', textContent: svc.count,
        'aria-label': `${svc.count} available` });
      const reqBtn = Security.createElement('button', {
        class: 'btn btn-secondary btn-sm',
        'aria-label': `Request ${svc.name}`,
        style: 'margin-top:6px;',
      }, ['Request']);
      reqBtn.addEventListener('click', () => requestService(svc));
      info.append(name, desc, reqBtn);
      item.append(icon, info, count);
      container.appendChild(item);
    });
  };

  const requestService = (svc) => {
    if (!Security.checkRateLimit(`a11y-req-${svc.name}`, 2, 60000)) {
      window.VenueIQ.showToast?.({ title: 'Request Submitted', message: 'Your request is already being processed.', type: 'info' });
      return;
    }
    const newReq = {
      icon: svc.icon,
      type: svc.name,
      location: 'Your current section',
      status: 'pending',
      time: Date.now(),
    };
    const requests = DataStore.get('a11y.requests') ?? [];
    DataStore.set('a11y.requests', [newReq, ...requests]);
    renderA11yRequests();
    window.VenueIQ.showToast?.({
      title: '♿ Service Requested',
      message: `${svc.name} requested. Staff will arrive in ~5 minutes.`,
      type: 'success',
      duration: 5000,
    });
    window.VenueIQ.announceToScreenReader?.(`Accessibility service requested: ${svc.name}. Staff will arrive shortly.`);
    typeof gtag !== 'undefined' && gtag('event', 'a11y_service_request', { service: svc.name });
  };

  /* ------------------------------------------------------------------ */
  /*  Active Requests                                                     */
  /* ------------------------------------------------------------------ */
  const renderA11yRequests = () => {
    const container = $('#a11y-requests');
    if (!container) return;
    container.innerHTML = '';
    const requests = DataStore.get('a11y.requests') ?? [];

    requests.forEach(req => {
      const item = Security.createElement('div', { class: 'request-item', role: 'listitem',
        'aria-label': `${req.type} — Status: ${req.status}` });
      const icon   = Security.createElement('span', { class: 'request-icon', 'aria-hidden': 'true' }, [req.icon]);
      const info   = Security.createElement('div', { class: 'request-info' });
      const type   = Security.createElement('div', { class: 'request-type', textContent: req.type });
      const loc    = Security.createElement('div', { class: 'request-loc',  textContent: `📍 ${req.location}` });
      const time   = Security.createElement('div', { class: 'request-loc',  textContent: formatRelativeTime(req.time) });
      const status = Security.createElement('span', {
        class: `request-status status-${req.status.replace(' ', '-')}`,
        textContent: req.status.charAt(0).toUpperCase() + req.status.slice(1),
      });
      info.append(type, loc, time);
      item.append(icon, info, status);
      container.appendChild(item);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  A11y Chart                                                          */
  /* ------------------------------------------------------------------ */
  const renderA11yChart = () => {
    const canvas = $('#a11y-chart');
    if (!canvas) return;
    Charts.drawBarChart(canvas, {
      labels: ['Wheelchair', 'Visual', 'Hearing', 'Service Animal', 'Elevator', 'Parking'],
      datasets: [
        { label: 'Requests Today', values: [24, 8, 0, 6, 18, 45], color: '#6C63FF' },
        { label: 'Served',         values: [22, 8, 0, 6, 16, 43], color: '#00D4AA' },
      ],
    }, { showGrid: true });
  };

  /* ------------------------------------------------------------------ */
  /*  Settings Panel                                                      */
  /* ------------------------------------------------------------------ */
  const SETTINGS = [
    { key: 'highContrast', label: 'High Contrast Mode',     sub: 'Maximizes text/background contrast for visual clarity' },
    { key: 'largeText',    label: 'Large Text Mode',         sub: 'Increases base font size to 18px' },
    { key: 'reduceMotion', label: 'Reduce Motion',           sub: 'Disables non-essential animations' },
    { key: 'dyslexiaMode', label: 'Dyslexia-Friendly Font',  sub: 'Uses dyslexia-optimized typeface with wider spacing' },
    { key: 'colorBlind',   label: 'Color Blind Mode',        sub: 'Replaces red/green with universally distinct colors' },
    { key: 'keyboardNav',  label: 'Enhanced Keyboard Nav',   sub: 'Shows stronger focus indicators for keyboard users' },
  ];

  const renderA11ySettings = () => {
    const container = $('#a11y-settings');
    if (!container) return;
    container.innerHTML = '';
    _renderSettingRows(container);
  };

  const _renderSettingRows = (container) => {
    SETTINGS.forEach(setting => {
      const row = Security.createElement('div', { class: 'a11y-setting-row' });
      const labelGroup = Security.createElement('div');
      const label = Security.createElement('div', { class: 'a11y-setting-label', textContent: setting.label });
      const sub   = Security.createElement('div', { class: 'a11y-setting-sub',   textContent: setting.sub });
      labelGroup.append(label, sub);

      const toggleLabel = Security.createElement('label', { class: 'toggle-switch' });
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id   = `a11y-toggle-${setting.key}`;
      input.checked = !!_prefs[setting.key];
      input.setAttribute('aria-label', setting.label);
      input.addEventListener('change', () => togglePref(setting.key));
      const track = Security.createElement('span', { class: 'toggle-track', 'aria-hidden': 'true' });
      toggleLabel.append(input, track);
      row.append(labelGroup, toggleLabel);
      container.appendChild(row);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Modal Content (same settings in modal)                              */
  /* ------------------------------------------------------------------ */
  const initModalContent = () => {
    const modal = $('#a11y-modal-content');
    if (!modal) return;

    const container = Security.createElement('div', { class: 'a11y-settings' });
    _renderSettingRows(container);

    const footer = Security.createElement('div', { style: 'margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle);' });
    const resetBtn = Security.createElement('button', {
      class: 'btn btn-secondary',
      'aria-label': 'Reset all accessibility preferences to defaults',
    }, ['Reset to Defaults']);
    resetBtn.addEventListener('click', () => {
      _prefs = { highContrast:false, largeText:false, reduceMotion:false, dyslexiaMode:false, colorBlind:false, keyboardNav:false };
      applyPreferences(_prefs);
      modal.innerHTML = '';
      initModalContent();
      window.VenueIQ.showToast?.({ title: 'Preferences Reset', message: 'All settings restored to defaults.', type: 'success' });
      window.VenueIQ.announceToScreenReader?.('Accessibility preferences reset to defaults.');
    });
    footer.appendChild(resetBtn);
    modal.append(container, footer);
  };

  /* ------------------------------------------------------------------ */
  /*  Auto-detect system preferences                                      */
  /* ------------------------------------------------------------------ */
  const detectSystemPreferences = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !_prefs.reduceMotion) {
      _prefs.reduceMotion = true;
      applyPreferences(_prefs);
    }
    if (window.matchMedia('(prefers-contrast: more)').matches && !_prefs.highContrast) {
      _prefs.highContrast = true;
      applyPreferences(_prefs);
    }
  };

  // Run on load
  detectSystemPreferences();
  // Apply any saved preferences immediately
  applyPreferences(_prefs);

  return Object.freeze({ init, applyPreferences, togglePref });

})();
