/**
 * VenueIQ — Maps Module
 * Google Maps integration with venue overlays and navigation.
 * @module maps
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.Maps = (() => {

  const { Security, DataStore, Utils } = window.VenueIQ;
  const { $, $$, debounce } = Utils;

  let _map = null;
  let _markers = [];
  let _isInitialized = false;
  let _activeLayer = 'crowd';

  const QUICK_LINKS = [
    { icon: '🚪', label: 'Gate A',       lat: 12.9730, lng: 77.5936 },
    { icon: '🚪', label: 'Gate B',       lat: 12.9702, lng: 77.5936 },
    { icon: '🍕', label: 'Food Court N', lat: 12.9726, lng: 77.5946 },
    { icon: '🏥', label: 'First Aid',    lat: 12.9716, lng: 77.5960 },
    { icon: '🅿', label: 'Parking A',    lat: 12.9700, lng: 77.5920 },
    { icon: '♿', label: 'Accessible',   lat: 12.9716, lng: 77.5936 },
  ];

  const init = () => {
    if (_isInitialized) return;
    _isInitialized = true;

    renderQuickLinks();
    initMapSearch();
    initLayerControls();
    renderNearbyServices();
    initRouteInfo();
    initActions();

    // Try to init Google Maps, fall back to canvas map
    if (typeof google !== 'undefined' && google.maps) {
      initGoogleMap();
    } else {
      initCanvasMap();
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Google Maps                                                         */
  /* ------------------------------------------------------------------ */
  const initGoogleMap = () => {
    const cfg  = window.VENUEIQ_CONFIG;
    const el   = $('#google-map');
    if (!el) return;

    _map = new google.maps.Map(el, {
      center: { lat: cfg.VENUE_LAT, lng: cfg.VENUE_LNG },
      zoom: 16,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      styles: _darkMapStyle(),
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    // Venue marker
    const venueMarker = new google.maps.Marker({
      position: { lat: cfg.VENUE_LAT, lng: cfg.VENUE_LNG },
      map: _map,
      title: cfg.VENUE_NAME,
      label: { text: '🏟', fontSize: '24px' },
    });
    _markers.push(venueMarker);

    // Gate markers
    QUICK_LINKS.forEach(link => {
      const marker = new google.maps.Marker({
        position: { lat: link.lat, lng: link.lng },
        map: _map,
        title: link.label,
        label: { text: link.icon, fontSize: '16px' },
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="color:#333;font-family:Inter,sans-serif"><strong>${link.label}</strong><br>Click for directions</div>`,
      });
      marker.addListener('click', () => {
        infoWindow.open(_map, marker);
        showRouteInfo(link.label);
      });
      _markers.push(marker);
    });

    // Track GA
    typeof gtag !== 'undefined' && gtag('event', 'map_view', { map_provider: 'google' });
  };

  /* ------------------------------------------------------------------ */
  /*  Canvas Fallback Map                                                 */
  /* ------------------------------------------------------------------ */
  const initCanvasMap = () => {
    const container = $('#google-map');
    if (!container) return;

    const canvas = Security.createElement('canvas', {
      id: 'venue-canvas-map',
      'aria-label': 'MetroArena Stadium venue map showing gates, facilities, and current crowd density',
      role: 'img',
    });
    canvas.width  = container.offsetWidth  || 800;
    canvas.height = container.offsetHeight || 560;
    canvas.style.cssText = 'width:100%;height:100%;border-radius:var(--radius-xl);';
    container.appendChild(canvas);
    drawVenueMap(canvas);

    // Redraw on click to show hover states
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      handleMapClick(x, y, canvas.width / rect.width);
    });

    // Make keyboard-accessible
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        window.VenueIQ.showToast?.({ title: 'Map', message: 'Use find location search to navigate venues.', type: 'info' });
      }
    });
  };

  const drawVenueMap = (canvas) => {
    const { Charts } = window.VenueIQ;
    const zones = DataStore.get('zones') ?? [];
    const grid = Charts.generateDensityGrid(zones, 30, 50);
    Charts.drawHeatmap(canvas, grid, { showAnnotations: true });

    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;

    // Draw gate labels
    const gates = [
      { label: 'A', x: cx,      y: cy - h * 0.38, color: '#00D4AA' },
      { label: 'B', x: cx,      y: cy + h * 0.38, color: '#ff6b6b' },
      { label: 'C', x: cx + w * 0.38, y: cy,      color: '#6C63FF' },
      { label: 'D', x: cx - w * 0.38, y: cy,      color: '#00D4AA' },
    ];

    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    gates.forEach(g => {
      ctx.beginPath();
      ctx.arc(g.x, g.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = g.color;
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText(`G${g.label}`, g.x, g.y);
    });

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Interactive venue map • Google Maps integration requires API key', cx, h - 12);
  };

  const handleMapClick = (x, y, scale) => {
    // Simple interaction — show toast with nearby info
    window.VenueIQ.showToast?.({
      title: '📍 Location Selected',
      message: 'Nearest: Gate A (120m), Food Court N1 (80m), Restroom (45m)',
      type: 'info',
      duration: 4000,
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Layer Controls                                                      */
  /* ------------------------------------------------------------------ */
  const initLayerControls = () => {
    $$('.map-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.map-layer-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        _activeLayer = btn.dataset.layer;

        window.VenueIQ.announceToScreenReader?.(`Map layer changed to ${btn.textContent}`);
        window.VenueIQ.showToast?.({
          title: 'Layer Active',
          message: `Showing ${btn.textContent} overlay`,
          type: 'info',
          duration: 2000,
        });
        typeof gtag !== 'undefined' && gtag('event', 'map_layer_change', { layer: _activeLayer });
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Quick Links                                                         */
  /* ------------------------------------------------------------------ */
  const renderQuickLinks = () => {
    const container = $('#quick-links-grid');
    if (!container) return;
    container.innerHTML = '';

    QUICK_LINKS.forEach(link => {
      const btn = Security.createElement('button', {
        class: 'quick-link-btn',
        'aria-label': `Navigate to ${link.label}`,
      });
      const iconEl  = Security.createElement('span', { class: 'quick-link-icon', 'aria-hidden': 'true' }, [link.icon]);
      const labelEl = Security.createElement('span', { textContent: link.label });
      btn.append(iconEl, labelEl);
      btn.addEventListener('click', () => {
        showRouteInfo(link.label);
        if (_map && typeof google !== 'undefined') {
          _map.panTo({ lat: link.lat, lng: link.lng });
          _map.setZoom(18);
        }
      });
      container.appendChild(btn);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Map Search                                                          */
  /* ------------------------------------------------------------------ */
  const initMapSearch = () => {
    const btn   = $('#map-search-btn');
    const input = $('#map-search-input');
    if (!btn || !input) return;

    const doSearch = () => {
      const query = Security.sanitizeText(input.value, 100).toLowerCase().trim();
      if (!query) return;

      const match = QUICK_LINKS.find(l => l.label.toLowerCase().includes(query));
      if (match) {
        showRouteInfo(match.label);
        if (_map && typeof google !== 'undefined') {
          _map.panTo({ lat: match.lat, lng: match.lng });
        }
        window.VenueIQ.showToast?.({ title: 'Found!', message: `Showing route to ${match.label}`, type: 'success', duration: 3000 });
      } else {
        window.VenueIQ.showToast?.({ title: 'Not Found', message: `No results for "${query}"`, type: 'warning', duration: 3000 });
      }
      typeof gtag !== 'undefined' && gtag('event', 'map_search', { query });
    };

    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  };

  /* ------------------------------------------------------------------ */
  /*  Route Info                                                          */
  /* ------------------------------------------------------------------ */
  const initRouteInfo = () => {
    const container = $('#route-info');
    if (!container) return;

    const el = Security.createElement('div', { 'aria-label': 'Route information panel' });
    el.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px">🗺</div>
        <div style="font-size:var(--text-sm);">Select a location to see route info</div>
      </div>`;
    container.appendChild(el);
  };

  const showRouteInfo = (locationName) => {
    const container = $('#route-info');
    if (!container) return;

    const info = {
      'Gate A':       { dist: '120m', time: '2 min', crowd: 'Low',    route: 'Via North Concourse' },
      'Gate B':       { dist: '340m', time: '5 min', crowd: 'High',   route: 'Via South Plaza — caution: crowd' },
      'Food Court N': { dist: '80m',  time: '1 min', crowd: 'Medium', route: 'Via Inner Concourse' },
      'First Aid':    { dist: '180m', time: '3 min', crowd: 'Low',    route: 'Via East Wing' },
      'Parking A':    { dist: '450m', time: '6 min', crowd: 'Medium', route: 'Via Exit Route D' },
      'Accessible':   { dist: '90m',  time: '2 min', crowd: 'Low',    route: 'Via Accessible path — Priority lane' },
    };

    const data = info[locationName] || { dist: '—', time: '—', crowd: '—', route: '—' };
    const crowdColor = data.crowd === 'High' ? 'var(--color-danger)' : data.crowd === 'Medium' ? 'var(--color-warning)' : 'var(--color-success)';

    container.innerHTML = '';
    const el = Security.createElement('div');
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="font-weight:700;color:var(--text-primary);font-size:var(--text-md);">📍 ${Security.sanitizeText(locationName)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--surface-raised);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:1.2rem;font-weight:700;color:var(--color-accent-400);">${data.dist}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);">Distance</div>
          </div>
          <div style="background:var(--surface-raised);border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:1.2rem;font-weight:700;color:var(--color-accent-400);">${data.time}</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);">Walk time</div>
          </div>
        </div>
        <div style="background:var(--surface-raised);border-radius:8px;padding:10px;">
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px;">Crowd Level</div>
          <div style="font-weight:700;color:${crowdColor};">${data.crowd}</div>
        </div>
        <div style="background:var(--surface-raised);border-radius:8px;padding:10px;">
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:4px;">Best Route</div>
          <div style="font-size:var(--text-sm);color:var(--text-primary);">${Security.sanitizeText(data.route)}</div>
        </div>
      </div>`;
    container.appendChild(el);
    window.VenueIQ.announceToScreenReader?.(`Route to ${locationName}: ${data.dist}, ${data.time} walk, crowd level ${data.crowd}`);
  };

  /* ------------------------------------------------------------------ */
  /*  Nearby Services                                                     */
  /* ------------------------------------------------------------------ */
  const renderNearbyServices = () => {
    const container = $('#nearby-list');
    if (!container) return;
    container.innerHTML = '';

    const nearby = [
      { icon: '🚻', name: 'Restroom Block N', dist: '45m' },
      { icon: '🍕', name: 'Food Stall #3',    dist: '68m' },
      { icon: '🏥', name: 'First Aid Point',  dist: '120m' },
      { icon: '🅿', name: 'Wheelchair Bay',   dist: '30m' },
      { icon: '🛒', name: 'Merchandise Store',dist: '95m' },
    ];

    nearby.forEach(item => {
      const el = Security.createElement('div', { class: 'nearby-item', role: 'listitem',
        'aria-label': `${item.name}: ${item.dist} away` });
      const icon = Security.createElement('span', { class: 'nearby-icon', 'aria-hidden': 'true' }, [item.icon]);
      const name = Security.createElement('span', { class: 'nearby-name', textContent: item.name });
      const dist = Security.createElement('span', { class: 'nearby-dist', textContent: item.dist });
      el.append(icon, name, dist);
      container.appendChild(el);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Google Maps Dark Style                                              */
  /* ------------------------------------------------------------------ */
  const _darkMapStyle = () => [
    { elementType: 'geometry', stylers: [{ color: '#0d1520' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1520' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#192232' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#202c3e' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ color: '#2f3948' }] },
  ];

  /* ------------------------------------------------------------------ */
  /*  Actions                                                             */
  /* ------------------------------------------------------------------ */
  const initActions = () => {
    $('#find-route')?.addEventListener('click', () => {
      window.VenueIQ.showToast?.({ title: 'Seat Finder', message: 'Enter your ticket number to find your seat path.', type: 'info' });
    });
    $('#open-directions')?.addEventListener('click', () => {
      const cfg = window.VENUEIQ_CONFIG;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${cfg.VENUE_LAT},${cfg.VENUE_LNG}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
      typeof gtag !== 'undefined' && gtag('event', 'get_directions');
    });
  };

  return Object.freeze({ init });

})();
