/**
 * VenueIQ — Data Store Module
 * Centralized reactive state management with pub/sub pattern.
 * All application data flows through this module.
 * @module data-store
 */

'use strict';

const DataStore = (() => {

  /* ------------------------------------------------------------------ */
  /*  Initial State                                                       */
  /* ------------------------------------------------------------------ */

  /** @type {Record<string, Set<function>>} */
  const _subscribers = {};

  /** @type {object} Application state */
  let _state = {
    app: {
      initialized: false,
      currentView: 'dashboard',
      theme: 'dark',
      lastUpdated: null,
    },
    venue: {
      name: 'MetroArena Stadium',
      capacity: 85_000,
      currentAttendance: 72_340,
      gatesOpen: 18,
      gatesTotal: 24,
      event: 'IPL T20 — Mumbai vs Bangalore',
      eventDate: '2026-04-15',
      weather: { temp: 28, condition: 'Partly Cloudy', humidity: 62, windKmh: 14, feelsLike: 30 },
    },
    stats: {
      avgWaitMinutes: 4.2,
      activeIncidents: 3,
      satisfactionPct: 94.7,
      revenueRupees: 2840000,
      servedToday: 18340,
    },
    zones: [
      { id: 'north',    name: 'North Stand',    capacity: 22000, current: 20900, status: 'warning' },
      { id: 'south',    name: 'South Stand',    capacity: 22000, current: 16500, status: 'ok' },
      { id: 'east',     name: 'East Stand',     capacity: 18000, current: 17800, status: 'critical' },
      { id: 'west',     name: 'West Stand',     capacity: 18000, current: 14200, status: 'ok' },
      { id: 'vip',      name: 'VIP Lounge',     capacity: 2000,  current: 1680,  status: 'ok' },
      { id: 'concourse',name: 'Concourse',      capacity: 3000,  current: 1260,  status: 'ok' },
    ],
    queues: [
      { id: 'gate-a',   name: 'Gate A Entry',       category: 'entry',    waitMin: 2.1, peopleInQueue: 145, staffCount: 4, status: 'ok' },
      { id: 'gate-b',   name: 'Gate B Entry',       category: 'entry',    waitMin: 8.4, peopleInQueue: 580, staffCount: 2, status: 'critical' },
      { id: 'gate-c',   name: 'Gate C Entry',       category: 'entry',    waitMin: 3.8, peopleInQueue: 220, staffCount: 3, status: 'warning' },
      { id: 'gate-d',   name: 'Gate D Entry',       category: 'entry',    waitMin: 1.5, peopleInQueue: 90,  staffCount: 4, status: 'ok' },
      { id: 'food-1',   name: 'Food Court N1',      category: 'food',     waitMin: 6.2, peopleInQueue: 340, staffCount: 3, status: 'warning' },
      { id: 'food-2',   name: 'Food Court N2',      category: 'food',     waitMin: 11.8,peopleInQueue: 620, staffCount: 2, status: 'critical' },
      { id: 'food-3',   name: 'Food Court S1',      category: 'food',     waitMin: 3.4, peopleInQueue: 180, staffCount: 4, status: 'warning' },
      { id: 'food-4',   name: 'Snack Bar E1',       category: 'food',     waitMin: 2.0, peopleInQueue: 95,  staffCount: 3, status: 'ok' },
      { id: 'rest-1',   name: 'Restroom Block N',   category: 'restroom', waitMin: 4.5, peopleInQueue: 85,  staffCount: 1, status: 'warning' },
      { id: 'rest-2',   name: 'Restroom Block S',   category: 'restroom', waitMin: 2.1, peopleInQueue: 42,  staffCount: 1, status: 'ok' },
      { id: 'rest-3',   name: 'Restroom Block E',   category: 'restroom', waitMin: 7.8, peopleInQueue: 148, staffCount: 1, status: 'critical' },
      { id: 'merch-1',  name: 'Merch Store Main',   category: 'merch',    waitMin: 5.1, peopleInQueue: 210, staffCount: 3, status: 'warning' },
      { id: 'merch-2',  name: 'Merch Kiosk E',      category: 'merch',    waitMin: 2.8, peopleInQueue: 88,  staffCount: 2, status: 'ok' },
      { id: 'medical-1',name: 'First Aid Center',   category: 'medical',  waitMin: 0.5, peopleInQueue: 3,   staffCount: 5, status: 'ok' },
      { id: 'medical-2',name: 'Medical Bay South',  category: 'medical',  waitMin: 0.3, peopleInQueue: 1,   staffCount: 3, status: 'ok' },
    ],
    alerts: [
      { id: 'a1', type: 'critical', title: 'Gate B Overcrowding', desc: 'Queue at Gate B exceeds safe threshold. 580+ people waiting. Deploy 2 additional staff immediately.', time: Date.now() - 240000, zone: 'gate-b', icon: '🔴' },
      { id: 'a2', type: 'warning',  title: 'East Stand Near Capacity', desc: 'East Stand at 98.9% occupancy. Monitor crowd movement. Redirect attendees to West Stand.', time: Date.now() - 900000, zone: 'east',   icon: '⚠' },
      { id: 'a3', type: 'warning',  title: 'Food Court N2 Delay', desc: 'Food Court N2 wait time exceeds 11 minutes. Consider opening backup stall.', time: Date.now() - 1200000, zone: 'food-2', icon: '🍔' },
    ],
    incidents: [
      { id: 'i1', type: 'medical',  title: 'Medical Assistance Needed', location: 'Section E-12, Row 22', severity: 'high',   status: 'active', time: Date.now() - 180000, icon: '🚑' },
      { id: 'i2', type: 'security', title: 'Unauthorized Area Access',  location: 'Gate B Staff Entrance', severity: 'medium', status: 'active', time: Date.now() - 420000, icon: '🔒' },
      { id: 'i3', type: 'crowd',    title: 'Crowd Bottleneck',          location: 'Concourse C Junction', severity: 'critical',status: 'active', time: Date.now() - 120000, icon: '👥' },
    ],
    staff: [
      { area: 'Entry Gates', count: 32, status: 'ok', icon: '🚪' },
      { area: 'Concourse',   count: 18, status: 'ok', icon: '🏃' },
      { area: 'Food & Bev',  count: 45, status: 'ok', icon: '🍕' },
      { area: 'Security',    count: 28, status: 'ok', icon: '🛡' },
      { area: 'Medical',     count: 12, status: 'ok', icon: '🏥' },
      { area: 'VIP Areas',   count: 8,  status: 'ok', icon: '⭐' },
    ],
    notifications: [
      { id: 'n1', title: 'Match Starting', body: 'The match begins in 15 minutes. Please take your seats.', channel: 'App', time: Date.now() - 900000, read: false, icon: '⚽' },
      { id: 'n2', title: 'Gate B Update',  body: 'Additional staff deployed at Gate B. Wait times expected to normalize in 5 minutes.', channel: 'App', time: Date.now() - 600000, read: false, icon: '🚪' },
      { id: 'n3', title: 'Food Promo',     body: 'Happy Hour at Food Courts opens in 10 minutes! 20% off all beverages.', channel: 'Screen', time: Date.now() - 300000, read: true, icon: '🍻' },
      { id: 'n4', title: 'Weather Alert',  body: 'Light drizzle expected at 9PM. Covered sections recommended.', channel: 'App', time: Date.now() - 1800000, read: true, icon: '🌧' },
      { id: 'n5', title: 'Parking Update', body: 'Parking Zone A is full. Use Zone B or Zone C. Shuttle available every 10 min.', channel: 'SMS', time: Date.now() - 3600000, read: true, icon: '🅿' },
    ],
    a11y: {
      services: [
        { icon: '♿', name: 'Wheelchair Assistance', desc: 'Push service and accessible seating', count: 24 },
        { icon: '👁', name: 'Visual Assistance',    desc: 'Guide service and audio descriptions', count: 8 },
        { icon: '👂', name: 'Hearing Loop',         desc: 'Induction loop in all public areas', count: '+All' },
        { icon: '🐕', name: 'Service Animals',      desc: 'Designated relief areas — Gate F', count: 6 },
        { icon: '🛗', name: 'Priority Elevators',   desc: '6 accessible elevators all floors', count: 6 },
        { icon: '🅿', name: 'Accessible Parking',   desc: 'Zones D & E — 200m from Gate A', count: 45 },
      ],
      requests: [
        { icon: '♿', type: 'Wheelchair Push Service', location: 'Gate A — Seat 12E', status: 'en-route', time: Date.now() - 120000 },
        { icon: '👁', type: 'Visual Guide Assistance', location: 'Main Entrance — Awaiting', status: 'pending', time: Date.now() - 60000 },
        { icon: '🛗', type: 'Elevator Priority Access', location: 'Level 3 North', status: 'completed', time: Date.now() - 600000 },
      ],
    },
    emergencyContacts: [
      { icon: '👮', name: 'Police Control Room', role: 'Law Enforcement', phone: '100' },
      { icon: '🚒', name: 'Fire Brigade',        role: 'Fire Emergency', phone: '101' },
      { icon: '🚑', name: 'Ambulance',           role: 'Medical Emergency', phone: '108' },
      { icon: '🏥', name: 'Venue Medical Center',role: 'On-site Medical', phone: '+91-80-2345-6789' },
      { icon: '🛡', name: 'Venue Security Head', role: 'Chief Security Officer', phone: '+91-98765-43210' },
      { icon: '👷', name: 'Operations Manager',  role: 'Event Operations', phone: '+91-98765-11111' },
    ],
  };

  /* ------------------------------------------------------------------ */
  /*  Pub/Sub                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Subscribe to state changes on a key path.
   * @param {string} key - e.g. 'zones', 'stats.avgWaitMinutes'
   * @param {function(any): void} callback
   * @returns {function} Unsubscribe function
   */
  const subscribe = (key, callback) => {
    if (!_subscribers[key]) _subscribers[key] = new Set();
    _subscribers[key].add(callback);
    return () => _subscribers[key].delete(callback);
  };

  /**
   * Notify all subscribers of a key.
   * @param {string} key
   * @param {*} value
   */
  const _notify = (key, value) => {
    (_subscribers[key] || new Set()).forEach(cb => {
      try { cb(value); }
      catch (e) { console.error(`[DataStore] Subscriber error for ${key}:`, e); }
    });
    // Also notify wildcard subscribers
    (_subscribers['*'] || new Set()).forEach(cb => {
      try { cb({ key, value }); }
      catch (e) { /* ignore */ }
    });
  };

  /* ------------------------------------------------------------------ */
  /*  State Access & Update                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Get a deep clone of a state value by dot-notation path.
   * @param {string} path - e.g. 'venue.currentAttendance'
   * @returns {*}
   */
  const get = (path) => {
    const parts = path.split('.');
    let val = _state;
    for (const part of parts) {
      if (val == null) return undefined;
      val = val[part];
    }
    // Return deep clone to prevent mutation
    try { return JSON.parse(JSON.stringify(val)); }
    catch { return val; }
  };

  /**
   * Update a state value by dot-notation path and notify subscribers.
   * @param {string} path
   * @param {*} value
   */
  const set = (path, value) => {
    const parts = path.split('.');
    let obj = _state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj[parts[i]] == null) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    _state.app.lastUpdated = Date.now();
    _notify(path, value);
    _notify(parts[0], get(parts[0])); // Notify top-level key too
  };

  /**
   * Merge an object into a state path (shallow merge).
   * @param {string} path
   * @param {object} updates
   */
  const merge = (path, updates) => {
    const current = get(path) ?? {};
    set(path, { ...current, ...updates });
  };

  /* ------------------------------------------------------------------ */
  /*  Simulation: Live Data Updates                                       */
  /* ------------------------------------------------------------------ */

  let _simInterval = null;

  /**
   * Start simulating live data updates.
   * @param {number} [intervalMs=5000]
   */
  const startSimulation = (intervalMs = 5000) => {
    if (_simInterval) return;

    _simInterval = setInterval(() => {
      _simulateUpdate();
    }, intervalMs);

    console.info('[DataStore] Live simulation started.');
  };

  /**
   * Stop simulation.
   */
  const stopSimulation = () => {
    clearInterval(_simInterval);
    _simInterval = null;
  };

  /** Internal: apply random realistic deltas to key metrics */
  const _simulateUpdate = () => {
    const { randInt, randFloat, clamp } = window.VenueIQ.Utils;

    // Attendance fluctuation ±50
    const att = clamp(_state.venue.currentAttendance + randInt(-50, 50), 65000, 85000);
    set('venue.currentAttendance', att);

    // Avg wait time fluctuation ±0.3
    const wait = clamp(_state.stats.avgWaitMinutes + randFloat(-0.3, 0.3), 1, 15);
    set('stats.avgWaitMinutes', parseFloat(wait.toFixed(1)));

    // Satisfaction fluctuation ±0.2
    const sat = clamp(_state.stats.satisfactionPct + randFloat(-0.2, 0.2), 85, 99);
    set('stats.satisfactionPct', parseFloat(sat.toFixed(1)));

    // Revenue increase
    const rev = _state.stats.revenueRupees + randInt(0, 5000);
    set('stats.revenueRupees', rev);

    // Served count increase
    set('stats.servedToday', _state.stats.servedToday + randInt(0, 15));

    // Zone occupancy fluctuation
    const zones = _state.zones.map(z => {
      const delta = randInt(-30, 40);
      const newCurrent = clamp(z.current + delta, 0, z.capacity);
      const pct = newCurrent / z.capacity;
      const status = pct > 0.95 ? 'critical' : pct > 0.80 ? 'warning' : 'ok';
      return { ...z, current: newCurrent, status };
    });
    set('zones', zones);

    // Queue wait time fluctuation
    const queues = _state.queues.map(q => {
      const delta = randFloat(-0.8, 1.2);
      const newWait = clamp(q.waitMin + delta, 0.3, 20);
      const newPeople = clamp(q.peopleInQueue + randInt(-20, 30), 0, 1000);
      const status = newWait > 8 ? 'critical' : newWait > 4 ? 'warning' : 'ok';
      return { ...q, waitMin: parseFloat(newWait.toFixed(1)), peopleInQueue: newPeople, status };
    });
    set('queues', queues);

    // Update timestamp display
    _notify('tick', Date.now());
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    get,
    set,
    merge,
    subscribe,
    startSimulation,
    stopSimulation,
  });

})();

window.VenueIQ = window.VenueIQ || {};
window.VenueIQ.DataStore = DataStore;
