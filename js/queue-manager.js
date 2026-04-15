/**
 * VenueIQ — Queue Manager Module
 * Smart queue management with AI-based wait time predictions.
 * @module queue-manager
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.QueueManager = (() => {

  const { Security, DataStore, Utils } = window.VenueIQ;
  const { $, $$, formatNumber, formatDuration, statusToColor, clamp, debounce } = Utils;

  let _isInitialized = false;
  let _activeCategory = 'all';

  const init = () => {
    if (_isInitialized) { refresh(); return; }
    _isInitialized = true;

    updateQueueStats();
    renderQueueGrid('all');
    initTabs();
    initQueueActions();

    DataStore.subscribe('queues', debounce(() => {
      updateQueueStats();
      renderQueueGrid(_activeCategory);
    }, 300));
  };

  const refresh = () => {
    updateQueueStats();
    renderQueueGrid(_activeCategory);
  };

  /* ------------------------------------------------------------------ */
  /*  Top Stats                                                           */
  /* ------------------------------------------------------------------ */
  const updateQueueStats = () => {
    const queues = DataStore.get('queues') ?? [];
    const stats  = DataStore.get('stats') ?? {};

    const avgWait    = queues.reduce((s, q) => s + q.waitMin, 0) / (queues.length || 1);
    const overloaded = queues.filter(q => q.status === 'critical').length;
    const total      = queues.length;

    const setVal = (id, v) => { const el = $(`#${id}`); if (el) el.textContent = v; };
    setVal('avg-wait-display',      formatDuration(avgWait));
    setVal('active-queues-display', total);
    setVal('overloaded-display',    overloaded);
    setVal('served-display',        formatNumber(stats.servedToday));
  };

  /* ------------------------------------------------------------------ */
  /*  Queue Grid                                                          */
  /* ------------------------------------------------------------------ */
  const renderQueueGrid = (category = 'all') => {
    const container = $('#queue-grid');
    if (!container) return;
    container.innerHTML = '';

    const queues = DataStore.get('queues') ?? [];
    const filtered = category === 'all'
      ? queues
      : queues.filter(q => q.category === category);

    if (!filtered.length) {
      const empty = Security.createElement('div', { class: 'empty-state' });
      empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);';
      empty.textContent = 'No queue points in this category.';
      container.appendChild(empty);
      return;
    }

    filtered
      .sort((a, b) => b.waitMin - a.waitMin)
      .forEach(q => container.appendChild(buildQueueCard(q)));
  };

  const buildQueueCard = (q) => {
    const isOverloaded = q.status === 'critical';
    const pct = clamp((q.waitMin / 15) * 100, 0, 100);
    const color = statusToColor(q.status);

    const card = Security.createElement('div', {
      class: `queue-card ${isOverloaded ? 'overloaded' : 'normal'}`,
      role: 'group',
      'aria-label': `${q.name}: ${formatDuration(q.waitMin)} wait, ${q.status} status`,
    });

    // Card inner HTML built securely
    const header = Security.createElement('div', { class: 'queue-card-header' });
    const nameEl = Security.createElement('span', { class: 'queue-card-name', textContent: q.name });
    const typeEl = Security.createElement('span', { class: 'queue-card-type', textContent: q.category });
    header.append(nameEl, typeEl);

    const statsEl = Security.createElement('div', { class: 'queue-card-stats' });
    const stats = [
      { val: formatDuration(q.waitMin), lbl: 'Wait Time', color },
      { val: formatNumber(q.peopleInQueue), lbl: 'In Queue', color: 'var(--text-primary)' },
      { val: q.staffCount, lbl: 'Staff Active', color: 'var(--color-accent-400)' },
      { val: isOverloaded ? '⚠ HIGH' : '✓ OK', lbl: 'Capacity', color },
    ];
    stats.forEach(s => {
      const el = Security.createElement('div', { class: 'qc-stat', 'aria-label': `${s.lbl}: ${s.val}` });
      const val = Security.createElement('span', { class: 'qc-stat-val', textContent: s.val });
      val.style.color = s.color;
      const lbl = Security.createElement('span', { class: 'qc-stat-lbl', textContent: s.lbl });
      el.append(val, lbl);
      statsEl.appendChild(el);
    });

    const progress = Security.createElement('div', { class: 'queue-progress', 'aria-label': `Queue load: ${Math.round(pct)}%` });
    const fill     = Security.createElement('div', { class: 'queue-progress-fill' });
    fill.style.cssText = `width:${pct}%;background:${color};`;
    progress.appendChild(fill);

    // Action buttons
    const actions = Security.createElement('div', { style: 'display:flex;gap:8px;margin-top:12px;' });
    const deployBtn = Security.createElement('button', {
      class: 'btn btn-primary btn-sm',
      'aria-label': `Deploy extra staff to ${q.name}`,
    }, ['+ Deploy Staff']);
    const alertBtn = Security.createElement('button', {
      class: 'btn btn-secondary btn-sm',
      'aria-label': `Send wait time alert for ${q.name}`,
    }, ['📣 Alert']);

    deployBtn.addEventListener('click', () => handleDeployStaff(q));
    alertBtn.addEventListener('click',  () => handleQueueAlert(q));

    actions.append(deployBtn, alertBtn);
    card.append(header, statsEl, progress, actions);
    return card;
  };

  /* ------------------------------------------------------------------ */
  /*  Actions                                                             */
  /* ------------------------------------------------------------------ */
  const handleDeployStaff = (queue) => {
    if (!Security.checkRateLimit(`deploy-${queue.id}`, 3, 30000)) {
      window.VenueIQ.showToast?.({ title: 'Rate Limited', message: 'Staff already deployed recently.', type: 'warning' });
      return;
    }
    const queues = DataStore.get('queues').map(q =>
      q.id === queue.id
        ? { ...q, staffCount: q.staffCount + 1, waitMin: Math.max(0.5, q.waitMin - 2.5) }
        : q
    );
    DataStore.set('queues', queues);
    window.VenueIQ.showToast?.({
      title: 'Staff Deployed',
      message: `Additional staff sent to ${queue.name}. Wait time should reduce by ~2 min.`,
      type: 'success',
      duration: 4000,
    });
    window.VenueIQ.announceToScreenReader?.(`Staff deployed to ${queue.name}`);
    typeof gtag !== 'undefined' && gtag('event', 'staff_deployed', { queue: queue.id });
  };

  const handleQueueAlert = (queue) => {
    window.VenueIQ.showToast?.({
      title: 'Alert Sent',
      message: `Attendees at ${queue.name} notified: ${formatDuration(queue.waitMin)} wait.`,
      type: 'info',
      duration: 3000,
    });
  };

  const handleOptimize = () => {
    if (!Security.checkRateLimit('optimize', 2, 60000)) {
      window.VenueIQ.showToast?.({ title: 'Optimization Running', message: 'Please wait before running again.', type: 'warning' });
      return;
    }
    const btn = $('#optimize-queues');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm" aria-hidden="true"></span> Optimizing...'; }

    setTimeout(() => {
      const queues = DataStore.get('queues').map(q => ({
        ...q,
        waitMin: Math.max(0.5, q.waitMin * 0.75),
        status: q.waitMin * 0.75 > 8 ? 'critical' : q.waitMin * 0.75 > 4 ? 'warning' : 'ok',
      }));
      DataStore.set('queues', queues);

      if (btn) { btn.disabled = false; btn.innerHTML = '🤖 AI Optimize'; }
      window.VenueIQ.showToast?.({
        title: '🤖 AI Optimization Complete',
        message: 'Staff redistributed. Average wait reduced by ~25%.',
        type: 'success',
        duration: 5000,
      });
      window.VenueIQ.announceToScreenReader?.('AI queue optimization complete. Average wait time reduced.');
      // GA4
      typeof gtag !== 'undefined' && gtag('event', 'ai_optimize_queues');
      // Firebase Analytics
      window.VenueIQ.FirebaseService?.logEvent('ai_queue_optimized', {
        queues_count: queues.length,
        avg_wait_before: Math.round(queues.reduce((s, q) => s + q.waitMin / 0.75, 0) / queues.length),
        avg_wait_after:  Math.round(queues.reduce((s, q) => s + q.waitMin, 0) / queues.length),
      });
      // Sync all queue data to Firebase Realtime DB
      queues.forEach(q => {
        window.VenueIQ.FirebaseService?.updateQueueData?.(q.id, q.waitMin, q.status);
      });
    }, 1800);
  };

  /* ------------------------------------------------------------------ */
  /*  Tabs                                                                */
  /* ------------------------------------------------------------------ */
  const initTabs = () => {
    $$('.queue-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.queue-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        _activeCategory = tab.dataset.category;
        renderQueueGrid(_activeCategory);
        window.VenueIQ.announceToScreenReader?.(`Showing ${tab.textContent} queues`);
      });
    });
  };

  const initQueueActions = () => {
    $('#optimize-queues')?.addEventListener('click', handleOptimize);
    $('#add-checkpoint')?.addEventListener('click', () => {
      window.VenueIQ.showToast?.({ title: 'Add Checkpoint', message: 'Feature coming in next sprint.', type: 'info' });
    });
  };

  return Object.freeze({ init, refresh });

})();
