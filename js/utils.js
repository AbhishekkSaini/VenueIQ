/**
 * VenueIQ — Utilities Module
 * General-purpose helper functions used across the platform.
 * @module utils
 */

'use strict';

const Utils = (() => {

  /* ------------------------------------------------------------------ */
  /*  DOM Helpers                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Shorthand querySelector with null-safety.
   * @param {string} selector
   * @param {Element|Document} [ctx=document]
   * @returns {Element|null}
   */
  const $ = (selector, ctx = document) => {
    try { return ctx.querySelector(selector); }
    catch { return null; }
  };

  /**
   * Shorthand querySelectorAll returning real Array.
   * @param {string} selector
   * @param {Element|Document} [ctx=document]
   * @returns {Element[]}
   */
  const $$ = (selector, ctx = document) => {
    try { return Array.from(ctx.querySelectorAll(selector)); }
    catch { return []; }
  };

  /**
   * Add multiple event listeners at once.
   * @param {Element|Window|Document} el
   * @param {string[]} events
   * @param {EventListenerOrEventListenerObject} handler
   * @param {AddEventListenerOptions} [opts]
   */
  const addEventListeners = (el, events, handler, opts) => {
    events.forEach(ev => el.addEventListener(ev, handler, opts));
  };

  /**
   * Remove multiple event listeners at once.
   * @param {Element} el
   * @param {string[]} events
   * @param {EventListenerOrEventListenerObject} handler
   */
  const removeEventListeners = (el, events, handler) => {
    events.forEach(ev => el.removeEventListener(ev, handler));
  };

  /**
   * Toggle element visibility with aria-hidden and hidden attribute.
   * @param {Element} el
   * @param {boolean} visible
   */
  const toggleVisibility = (el, visible) => {
    if (!el) return;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', String(!visible));
  };

  /* ------------------------------------------------------------------ */
  /*  Formatting                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Format a number with locale-aware thousands separators.
   * @param {number} n
   * @param {string} [locale='en-IN']
   * @returns {string}
   */
  const formatNumber = (n, locale = 'en-IN') =>
    typeof n === 'number' && !isNaN(n)
      ? n.toLocaleString(locale)
      : '—';

  /**
   * Format minutes into readable duration.
   * @param {number} minutes
   * @returns {string}
   */
  const formatDuration = (minutes) => {
    if (isNaN(minutes) || minutes < 0) return '—';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  /**
   * Format a percentage value.
   * @param {number} value - 0-100
   * @param {number} [decimals=1]
   * @returns {string}
   */
  const formatPercent = (value, decimals = 1) =>
    isNaN(value) ? '—' : `${value.toFixed(decimals)}%`;

  /**
   * Format currency in Indian Rupees.
   * @param {number} amount - in rupees
   * @returns {string}
   */
  const formatCurrency = (amount) => {
    if (isNaN(amount)) return '—';
    if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
    if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  /**
   * Format a Date or timestamp as a readable time.
   * @param {Date|number|string} dateInput
   * @returns {string}
   */
  const formatTime = (dateInput) => {
    try {
      const date = new Date(dateInput);
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  /**
   * Format a Date as relative time (e.g., "2 min ago").
   * @param {Date|number} dateInput
   * @returns {string}
   */
  const formatRelativeTime = (dateInput) => {
    const diff = Date.now() - new Date(dateInput).getTime();
    if (diff < 60_000)  return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return formatTime(dateInput);
  };

  /* ------------------------------------------------------------------ */
  /*  Data Utilities                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Clamp a number between min and max.
   * @param {number} val
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  /**
   * Linear interpolation.
   * @param {number} a
   * @param {number} b
   * @param {number} t - 0..1
   * @returns {number}
   */
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

  /**
   * Map a value from one range to another.
   * @param {number} val
   * @param {number} inMin
   * @param {number} inMax
   * @param {number} outMin
   * @param {number} outMax
   * @returns {number}
   */
  const mapRange = (val, inMin, inMax, outMin, outMax) => {
    const ratio = (val - inMin) / (inMax - inMin);
    return outMin + ratio * (outMax - outMin);
  };

  /**
   * Generate a random float in [min, max].
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  const randFloat = (min, max) => Math.random() * (max - min) + min;

  /**
   * Generate a random integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  const randInt = (min, max) => Math.floor(randFloat(min, max + 1));

  /**
   * Shuffle array in-place using Fisher-Yates.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}
   */
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /**
   * Deep clone a plain object (no functions, no Date, no circular refs).
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  /**
   * Group an array of objects by a key.
   * @template T
   * @param {T[]} arr
   * @param {keyof T} key
   * @returns {Record<string, T[]>}
   */
  const groupBy = (arr, key) =>
    arr.reduce((acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});

  /* ------------------------------------------------------------------ */
  /*  Async Utilities                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Debounce — delay function execution until after a quiet period.
   * @param {function} fn
   * @param {number} delay - ms
   * @returns {function}
   */
  const debounce = (fn, delay) => {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  /**
   * Throttle — limit function calls to at most once per interval.
   * @param {function} fn
   * @param {number} interval - ms
   * @returns {function}
   */
  const throttle = (fn, interval) => {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= interval) {
        last = now;
        return fn.apply(this, args);
      }
    };
  };

  /**
   * Sleep for ms milliseconds.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Retry an async function up to N times with exponential backoff.
   * @param {function(): Promise} fn
   * @param {number} [maxRetries=3]
   * @param {number} [baseDelayMs=500]
   * @returns {Promise}
   */
  const retry = async (fn, maxRetries = 3, baseDelayMs = 500) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          await sleep(baseDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw lastError;
  };

  /* ------------------------------------------------------------------ */
  /*  Animation Helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Animate a number from start to end, calling onUpdate each frame.
   * @param {number} from
   * @param {number} to
   * @param {number} duration - ms
   * @param {function(number): void} onUpdate
   * @param {function(): void} [onDone]
   */
  const animateNumber = (from, to, duration, onUpdate, onDone) => {
    const start = performance.now();
    const range = to - from;

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      onUpdate(from + range * eased);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        onUpdate(to);
        if (typeof onDone === 'function') onDone();
      }
    };
    requestAnimationFrame(step);
  };

  /**
   * Add a ripple effect to a button click.
   * @param {MouseEvent} event
   */
  const addRipple = (event) => {
    const btn = event.currentTarget;
    const circle = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    circle.className = 'ripple';
    circle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${event.clientX - rect.left - size / 2}px;
      top: ${event.clientY - rect.top - size / 2}px;
    `;
    btn.appendChild(circle);
    circle.addEventListener('animationend', () => circle.remove(), { once: true });
  };

  /* ------------------------------------------------------------------ */
  /*  Date/Time                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Format a Date for display: "Tuesday, 15 April 2026 • 11:30 AM"
   * @param {Date} [date=new Date()]
   * @returns {string}
   */
  const formatFullDateTime = (date = new Date()) => {
    const dateStr = date.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} • ${timeStr}`;
  };

  /**
   * Return current date as ISO string for datetime attributes.
   * @returns {string}
   */
  const isoDate = () => new Date().toISOString().slice(0, 10);

  /* ------------------------------------------------------------------ */
  /*  Color Utilities                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Get an HSL color string for a density value 0–1.
   * 0=blue (empty), 0.5=green, 0.75=yellow, 1=red (full).
   * @param {number} density - 0..1
   * @returns {string}
   */
  const densityToColor = (density) => {
    const h = clamp((1 - density) * 240, 0, 240);
    const s = 90 + density * 10;
    const l = 45 + density * 5;
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  /**
   * Get a CSS color for a status string.
   * @param {'ok'|'warning'|'critical'|'info'} status
   * @returns {string}
   */
  const statusToColor = (status) => {
    const MAP = {
      ok: 'var(--color-success)',
      warning: 'var(--color-warning)',
      critical: 'var(--color-danger)',
      info: 'var(--color-info)',
    };
    return MAP[status] ?? 'var(--text-muted)';
  };

  /* ------------------------------------------------------------------ */
  /*  Unique ID                                                           */
  /* ------------------------------------------------------------------ */

  let _idCounter = 0;
  /**
   * Generate a unique ID string.
   * @param {string} [prefix='viq']
   * @returns {string}
   */
  const uniqueId = (prefix = 'viq') => `${prefix}-${++_idCounter}-${Date.now().toString(36)}`;

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    $, $$,
    addEventListeners, removeEventListeners, toggleVisibility,
    formatNumber, formatDuration, formatPercent, formatCurrency,
    formatTime, formatRelativeTime, formatFullDateTime, isoDate,
    clamp, lerp, mapRange, randFloat, randInt, shuffle, deepClone, groupBy,
    debounce, throttle, sleep, retry,
    animateNumber, addRipple,
    densityToColor, statusToColor,
    uniqueId,
  });

})();

window.VenueIQ = window.VenueIQ || {};
window.VenueIQ.Utils = Utils;
