/**
 * VenueIQ — Crowd Flow Module
 * Real-time crowd density visualization and AI movement predictions.
 * @module crowd-flow
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.CrowdFlow = (() => {

  const { Security, DataStore, Charts, Utils } = window.VenueIQ;
  const { $, $$ } = Utils;
  const { formatNumber, formatPercent, statusToColor, throttle } = Utils;

  let _animFrame = null;
  let _isInitialized = false;
  let _zoom = 1;
  let _showHeatmap = true;
  let _showArrows  = true;

  const PREDICTIONS = [
    { time: '+10 min', text: 'Concourse C will reach 85% capacity after half-time break.', confidence: 92 },
    { time: '+20 min', text: 'Gate B queue will reduce to < 3 min as latecomers finish entering.', confidence: 87 },
    { time: '+30 min', text: 'North Stand movement surge expected at end of next innings.', confidence: 78 },
    { time: '+45 min', text: 'East Side food courts will see peak demand spike.', confidence: 84 },
    { time: '+60 min', text: 'Gradual crowd dispersal begins. South exits will be busiest.', confidence: 91 },
  ];

  const init = () => {
    if (_isInitialized) { updateHeatmap(); return; }
    _isInitialized = true;

    renderCriticalZones();
    renderPredictions();
    renderFlowChart();
    updateHeatmap();
    initControls();
    startAnimationLoop();

    // Re-render on zone data changes
    DataStore.subscribe('zones', throttle(updateHeatmap, 2000));
  };

  const updateHeatmap = () => {
    const canvas = $('#crowd-heatmap-main');
    if (!canvas) return;
    const zones = DataStore.get('zones') ?? [];
    const grid = Charts.generateDensityGrid(zones, 30, 50);
    Charts.drawHeatmap(canvas, grid, { showAnnotations: _showHeatmap });
    renderCriticalZones();
  };

  const startAnimationLoop = () => {
    const animate = () => {
      _animFrame = requestAnimationFrame(animate);
    };
    animate();
  };

  const renderCriticalZones = () => {
    const container = $('#critical-zones-list');
    if (!container) return;
    container.innerHTML = '';
    const zones = DataStore.get('zones') ?? [];
    const sorted = [...zones].sort((a, b) => (b.current / b.capacity) - (a.current / a.capacity));

    sorted.forEach(zone => {
      const pct = zone.current / zone.capacity;
      const level = pct > 0.95 ? 'high' : pct > 0.78 ? 'medium' : 'low';

      const item = Security.createElement('div', {
        class: `critical-zone-item ${level}`,
        role: 'listitem',
        'aria-label': `${zone.name}: ${Math.round(pct*100)}% capacity — ${level} density`,
      });

      const nameEl = Security.createElement('span', { class: 'zone-name', textContent: zone.name });
      nameEl.style.cssText = 'flex:1;font-size:var(--text-xs);font-weight:600;';

      const bar  = Security.createElement('div', { class: 'zone-density-bar' });
      const fill = Security.createElement('div', { class: `zone-density-fill density-${level}` });
      fill.style.width = `${Math.min(pct * 100, 100)}%`;
      bar.appendChild(fill);

      const pctEl = Security.createElement('span', {
        class: `zone-pct`,
        textContent: `${Math.round(pct * 100)}%`,
      });
      pctEl.style.color = statusToColor(zone.status);

      item.append(nameEl, bar, pctEl);
      container.appendChild(item);
    });
  };

  const renderPredictions = () => {
    const container = $('#prediction-list');
    if (!container) return;
    container.innerHTML = '';

    PREDICTIONS.forEach(pred => {
      const item = Security.createElement('div', { class: 'prediction-item', role: 'listitem' });
      const timeEl = Security.createElement('div', { class: 'prediction-time', textContent: `Predicted ${pred.time}` });
      const textEl = Security.createElement('div', { class: 'prediction-text', textContent: pred.text });
      const confEl = Security.createElement('div', { class: 'prediction-confidence', textContent: `Confidence: ${pred.confidence}%` });
      item.append(timeEl, textEl, confEl);
      container.appendChild(item);
    });
  };

  const renderFlowChart = () => {
    const canvas = $('#flow-chart');
    if (!canvas) return;

    Charts.drawBarChart(canvas, {
      labels: ['10AM', '11AM', '12PM', '1PM', '2PM', '3PM'],
      datasets: [
        { label: 'Entry', values: [1200, 3400, 5600, 8900, 4200, 1800], color: '#6C63FF' },
        { label: 'Exit',  values: [200,  400,  800, 2100, 6800, 9200], color: '#00D4AA' },
      ],
    }, { showGrid: true });
  };

  const initControls = () => {
    const toggleHeatmapBtn = $('#toggle-heatmap');
    const toggleArrowsBtn  = $('#toggle-flow-arrows');
    const zoomInBtn        = $('#zoom-in');
    const zoomOutBtn       = $('#zoom-out');
    const zoomResetBtn     = $('#zoom-reset');
    const timeSelect       = $('#heatmap-time');
    const exportBtn        = $('#export-crowd-data');

    toggleHeatmapBtn?.addEventListener('click', () => {
      _showHeatmap = !_showHeatmap;
      toggleHeatmapBtn.textContent = `Heatmap ${_showHeatmap ? 'On' : 'Off'}`;
      toggleHeatmapBtn.setAttribute('aria-pressed', String(_showHeatmap));
      updateHeatmap();
    });

    toggleArrowsBtn?.addEventListener('click', () => {
      _showArrows = !_showArrows;
      toggleArrowsBtn.textContent = `Flow Arrows ${_showArrows ? 'On' : 'Off'}`;
      toggleArrowsBtn.setAttribute('aria-pressed', String(_showArrows));
    });

    zoomInBtn?.addEventListener('click',    () => { _zoom = Math.min(2, _zoom + 0.25); applyZoom(); });
    zoomOutBtn?.addEventListener('click',   () => { _zoom = Math.max(0.5, _zoom - 0.25); applyZoom(); });
    zoomResetBtn?.addEventListener('click', () => { _zoom = 1; applyZoom(); });

    timeSelect?.addEventListener('change', (e) => {
      window.VenueIQ.showToast?.({ title: 'View Updated', message: `Showing ${e.target.options[e.target.selectedIndex].text}`, type: 'info', duration: 2000 });
    });

    exportBtn?.addEventListener('click', () => {
      if (!Security.checkRateLimit('crowd-export', 3)) return;
      const csv = generateCrowdCSV();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'crowd-data.csv'; a.click();
      URL.revokeObjectURL(url);
      window.VenueIQ.showToast?.({ title: 'Exported', message: 'Crowd data CSV downloaded.', type: 'success' });
    });
  };

  const applyZoom = () => {
    const wrapper = $('#crowd-heatmap-wrapper');
    if (wrapper) {
      wrapper.style.transform = `scale(${_zoom})`;
      wrapper.style.transformOrigin = 'center center';
    }
  };

  const generateCrowdCSV = () => {
    const zones = DataStore.get('zones') ?? [];
    const rows = [
      ['Zone', 'Current', 'Capacity', 'Density %', 'Status'],
      ...zones.map(z => [z.name, z.current, z.capacity, Math.round(z.current/z.capacity*100), z.status]),
    ];
    return rows.map(r => r.join(',')).join('\n');
  };

  const destroy = () => {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    _isInitialized = false;
  };

  return Object.freeze({ init, updateHeatmap, destroy });

})();
