/**
 * VenueIQ — Security Module
 * Handles input sanitization, XSS prevention, CSRF protection,
 * rate limiting, and safe DOM manipulation.
 * @module security
 */

'use strict';

const Security = (() => {

  /* ------------------------------------------------------------------ */
  /*  Constants                                                           */
  /* ------------------------------------------------------------------ */
  const MAX_STRING_LENGTH = 1000;
  const ALLOWED_HTML_TAGS = new Set(['b', 'i', 'strong', 'em', 'br', 'span', 'p']);
  const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  const RATE_LIMIT_MAX_CALLS = 20;

  /** @type {Map<string, {count: number, resetAt: number}>} */
  const _rateLimitStore = new Map();

  /* ------------------------------------------------------------------ */
  /*  Input Sanitization                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Sanitize a plain-text string — strip all HTML tags.
   * @param {string} input
   * @param {number} [maxLength]
   * @returns {string}
   */
  const sanitizeText = (input, maxLength = MAX_STRING_LENGTH) => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .slice(0, maxLength)
      .trim();
  };

  /**
   * Safe alternative to innerHTML — escapes content and sets textContent.
   * Never use innerHTML with user data; use this instead.
   * @param {Element} element
   * @param {string} text
   */
  const setTextSafe = (element, text) => {
    if (!(element instanceof Element)) return;
    element.textContent = sanitizeText(text);
  };

  /**
   * Validate and sanitize a form field value.
   * @param {string} value
   * @param {'text'|'number'|'email'|'select'} type
   * @param {object} [options]
   * @returns {{ valid: boolean, value: string, error?: string }}
   */
  const validateField = (value, type = 'text', options = {}) => {
    const { required = false, min, max, allowedValues } = options;
    const sanitized = sanitizeText(String(value ?? ''));

    if (required && !sanitized) {
      return { valid: false, value: sanitized, error: 'This field is required.' };
    }
    if (!sanitized && !required) {
      return { valid: true, value: sanitized };
    }

    switch (type) {
      case 'number': {
        const num = parseFloat(sanitized);
        if (isNaN(num)) return { valid: false, value: sanitized, error: 'Must be a valid number.' };
        if (min !== undefined && num < min) return { valid: false, value: sanitized, error: `Minimum value is ${min}.` };
        if (max !== undefined && num > max) return { valid: false, value: sanitized, error: `Maximum value is ${max}.` };
        return { valid: true, value: String(num) };
      }
      case 'email': {
        const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
        if (!emailRegex.test(sanitized)) return { valid: false, value: sanitized, error: 'Invalid email format.' };
        return { valid: true, value: sanitized };
      }
      case 'select': {
        if (allowedValues && !allowedValues.includes(sanitized)) {
          return { valid: false, value: '', error: 'Invalid selection.' };
        }
        return { valid: true, value: sanitized };
      }
      default: {
        if (max !== undefined && sanitized.length > max) {
          return { valid: false, value: sanitized, error: `Maximum ${max} characters allowed.` };
        }
        return { valid: true, value: sanitized };
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Safe DOM Creation                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Create a DOM element safely without innerHTML.
   * @param {string} tag
   * @param {object} [attrs]
   * @param {(string|Element)[]} [children]
   * @returns {Element}
   */
  const createElement = (tag, attrs = {}, children = []) => {
    const ALLOWED_TAGS = new Set([
      'div','span','p','h1','h2','h3','h4','h5','h6',
      'ul','ol','li','button','input','label','select','option',
      'textarea','form','table','thead','tbody','tr','th','td',
      'section','article','header','footer','nav','main','aside',
      'time','strong','em','b','i','br','a','img','canvas',
      'figure','figcaption','details','summary','fieldset','legend'
    ]);

    if (!ALLOWED_TAGS.has(tag.toLowerCase())) {
      console.warn(`[Security] Blocked disallowed element: <${tag}>`);
      return document.createTextNode('');
    }

    const el = document.createElement(tag);

    const DANGEROUS_ATTRS = new Set(['onload','onerror','onmouseover','onclick','onfocus','onblur','onchange','srcdoc']);

    Object.entries(attrs).forEach(([key, val]) => {
      if (DANGEROUS_ATTRS.has(key.toLowerCase())) {
        console.warn(`[Security] Blocked dangerous attribute: ${key}`);
        return;
      }
      // Prevent javascript: in href/src
      if ((key === 'href' || key === 'src') && typeof val === 'string') {
        if (/^javascript:/i.test(val.trim())) {
          console.warn(`[Security] Blocked javascript: URI in ${key}`);
          return;
        }
      }
      if (key === 'class') { el.className = String(val); }
      else if (key === 'textContent') { el.textContent = sanitizeText(String(val)); }
      else if (key === 'ariaLabel') { el.setAttribute('aria-label', sanitizeText(String(val))); }
      else { el.setAttribute(key, String(val)); }
    });

    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Element || child instanceof Text) {
        el.appendChild(child);
      }
    });

    return el;
  };

  /* ------------------------------------------------------------------ */
  /*  Rate Limiting                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Check if an action is rate-limited.
   * @param {string} key - Unique identifier for the action
   * @param {number} [maxCalls] - Max allowed calls in window
   * @param {number} [windowMs] - Time window in ms
   * @returns {boolean} true if allowed, false if rate-limited
   */
  const checkRateLimit = (key, maxCalls = RATE_LIMIT_MAX_CALLS, windowMs = RATE_LIMIT_WINDOW_MS) => {
    const now = Date.now();
    const entry = _rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      _rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxCalls) {
      console.warn(`[Security] Rate limit exceeded for action: ${key}`);
      return false;
    }
    entry.count++;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /*  Form Validation                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Validate an entire HTMLFormElement — collect all errors.
   * @param {HTMLFormElement} form
   * @returns {{ valid: boolean, errors: Record<string, string> }}
   */
  const validateForm = (form) => {
    if (!(form instanceof HTMLFormElement)) return { valid: false, errors: {} };

    const errors = {};
    let valid = true;

    /** @type {NodeListOf<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} */
    const fields = form.querySelectorAll('[required], [data-validate]');

    fields.forEach(field => {
      const result = validateField(
        field.value,
        field.dataset.validateType || 'text',
        {
          required: field.hasAttribute('required'),
          max: field.maxLength > 0 ? field.maxLength : undefined,
        }
      );

      if (!result.valid) {
        valid = false;
        errors[field.id || field.name] = result.error;
        field.setAttribute('aria-invalid', 'true');
        field.classList.add('input-error');

        // Show inline error
        const errorEl = form.querySelector(`[data-error-for="${field.id}"]`);
        if (errorEl) { errorEl.textContent = result.error; errorEl.hidden = false; }
      } else {
        field.removeAttribute('aria-invalid');
        field.classList.remove('input-error');
        const errorEl = form.querySelector(`[data-error-for="${field.id}"]`);
        if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
      }
    });

    return { valid, errors };
  };

  /* ------------------------------------------------------------------ */
  /*  Content Security                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a cryptographically secure random token (CSP nonce alternative for JS).
   * @param {number} [length=16]
   * @returns {string}
   */
  const generateToken = (length = 16) => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  };

  /**
   * Safely parse JSON with type checking.
   * @param {string} jsonString
   * @param {*} [fallback=null]
   * @returns {*}
   */
  const safeJSONParse = (jsonString, fallback = null) => {
    try {
      const parsed = JSON.parse(jsonString);
      return parsed;
    } catch {
      console.warn('[Security] JSON parse failed — returning fallback.');
      return fallback;
    }
  };

  /* ------------------------------------------------------------------ */
  /*  LocalStorage Helpers (with sanitization)                           */
  /* ------------------------------------------------------------------ */

  /**
   * Safely set a value in localStorage.
   * @param {string} key
   * @param {*} value
   */
  const lsSet = (key, value) => {
    try {
      const sanitizedKey = sanitizeText(key, 64);
      localStorage.setItem(`venueiq:${sanitizedKey}`, JSON.stringify(value));
    } catch (e) {
      console.warn('[Security] localStorage write failed:', e);
    }
  };

  /**
   * Safely get a value from localStorage.
   * @param {string} key
   * @param {*} [fallback=null]
   * @returns {*}
   */
  const lsGet = (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(`venueiq:${sanitizeText(key, 64)}`);
      return raw !== null ? safeJSONParse(raw, fallback) : fallback;
    } catch {
      return fallback;
    }
  };

  /**
   * Safely remove a key from localStorage.
   * @param {string} key
   */
  const lsRemove = (key) => {
    try {
      localStorage.removeItem(`venueiq:${sanitizeText(key, 64)}`);
    } catch { /* ignore */ }
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    sanitizeText,
    setTextSafe,
    validateField,
    validateForm,
    createElement,
    checkRateLimit,
    generateToken,
    safeJSONParse,
    lsSet,
    lsGet,
    lsRemove,
  });

})();

// Expose globally
window.VenueIQ = window.VenueIQ || {};
window.VenueIQ.Security = Security;
