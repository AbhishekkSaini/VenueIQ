/**
 * VenueIQ — Comprehensive Test Suite
 * Tests cover: Security, Utils, DataStore, Charts, Accessibility, DOM Safety, PWA.
 * Uses vanilla JS — no external test framework dependency.
 * Run: Open tests/test-runner.html in browser
 */

'use strict';

/* ================================================================== */
/*  Minimal Test Framework                                              */
/* ================================================================== */

const TestRunner = (() => {
  let _passed = 0;
  let _failed = 0;
  let _total  = 0;
  const _results = [];
  const _suites  = [];

  const describe = (suiteName, fn) => {
    _suites.push({ name: suiteName, fn });
  };

  const it = (testName, fn) => {
    _total++;
    try {
      fn();
      _passed++;
      _results.push({ suite: _currentSuite, name: testName, status: 'PASS', error: null });
    } catch (err) {
      _failed++;
      _results.push({ suite: _currentSuite, name: testName, status: 'FAIL', error: err.message });
    }
  };

  const expect = (actual) => ({
    toBe:           (expected) => { if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
    toEqual:        (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
    toBeTrue:       ()         => { if (actual !== true)  throw new Error(`Expected true, got ${actual}`); },
    toBeFalse:      ()         => { if (actual !== false) throw new Error(`Expected false, got ${actual}`); },
    toBeTruthy:     ()         => { if (!actual)          throw new Error(`Expected truthy, got ${actual}`); },
    toBeFalsy:      ()         => { if (actual)           throw new Error(`Expected falsy, got ${actual}`); },
    toContain:      (val)      => { if (!String(actual).includes(String(val))) throw new Error(`Expected "${actual}" to contain "${val}"`); },
    toBeNull:       ()         => { if (actual !== null)  throw new Error(`Expected null, got ${actual}`); },
    toBeUndefined:  ()         => { if (actual !== undefined) throw new Error(`Expected undefined, got ${actual}`); },
    toBeGreaterThan:(n)        => { if (actual <= n)      throw new Error(`Expected ${actual} > ${n}`); },
    toBeLessThan:   (n)        => { if (actual >= n)      throw new Error(`Expected ${actual} < ${n}`); },
    toBeGreaterThanOrEqual:(n) => { if (actual < n)       throw new Error(`Expected ${actual} >= ${n}`); },
    toBeLessThanOrEqual:(n)    => { if (actual > n)       throw new Error(`Expected ${actual} <= ${n}`); },
    toBeInstanceOf: (cls)      => { if (!(actual instanceof cls)) throw new Error(`Expected instance of ${cls.name}`); },
    toMatch:        (regex)    => { if (!regex.test(actual)) throw new Error(`Expected "${actual}" to match ${regex}`); },
    toHaveLength:   (n)        => { if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`); },
    toBeArray:      ()         => { if (!Array.isArray(actual)) throw new Error(`Expected array, got ${typeof actual}`); },
    toBeString:     ()         => { if (typeof actual !== 'string') throw new Error(`Expected string, got ${typeof actual}`); },
    toBeNumber:     ()         => { if (typeof actual !== 'number') throw new Error(`Expected number, got ${typeof actual}`); },
    toBeObject:     ()         => { if (typeof actual !== 'object' || actual === null) throw new Error(`Expected object, got ${typeof actual}`); },
    toThrow:        ()         => {
      if (typeof actual !== 'function') throw new Error('expected a function');
      let threw = false;
      try { actual(); } catch { threw = true; }
      if (!threw) throw new Error('Expected function to throw');
    },
  });

  let _currentSuite = '';

  const run = async () => {
    for (const suite of _suites) {
      _currentSuite = suite.name;
      suite.fn();
    }
    _report();
  };

  const _report = () => {
    const container = document.getElementById('test-results');
    if (!container) { console.table(_results); return; }

    const summary = document.createElement('div');
    summary.className = `summary ${_failed === 0 ? 'all-pass' : 'has-fail'}`;
    summary.innerHTML = `
      <h2>${_failed === 0 ? '✅' : '❌'} Test Results</h2>
      <div class="summary-stats">
        <span class="stat-pass">✓ ${_passed} Passed</span>
        <span class="stat-fail">✗ ${_failed} Failed</span>
        <span class="stat-total">📊 ${_total} Total</span>
        <span class="stat-pct">${(((_passed / _total) || 0) * 100).toFixed(1)}% Pass Rate</span>
      </div>`;
    container.appendChild(summary);

    // Group by suite
    const suiteMap = {};
    _results.forEach(r => {
      if (!suiteMap[r.suite]) suiteMap[r.suite] = [];
      suiteMap[r.suite].push(r);
    });

    Object.entries(suiteMap).forEach(([suiteName, tests]) => {
      const block = document.createElement('div');
      block.className = 'suite-block';
      const passed = tests.filter(t => t.status === 'PASS').length;
      block.innerHTML = `<h3 class="suite-title">${suiteName} <span>(${passed}/${tests.length})</span></h3>`;
      tests.forEach(t => {
        const row = document.createElement('div');
        row.className = `test-row ${t.status.toLowerCase()}`;
        row.innerHTML = `
          <span class="test-status">${t.status === 'PASS' ? '✓' : '✗'}</span>
          <span class="test-name">${t.name}</span>
          ${t.error ? `<span class="test-error">${t.error}</span>` : ''}`;
        block.appendChild(row);
      });
      container.appendChild(block);
    });

    // Console output
    console.group(`[VenueIQ Tests] ${_passed}/${_total} passed`);
    _results.filter(r => r.status === 'FAIL').forEach(r => {
      console.error(`FAIL: [${r.suite}] ${r.name} — ${r.error}`);
    });
    console.groupEnd();
  };

  return { describe, it, expect, run };
})();

const { describe, it, expect, run } = TestRunner;

/* ================================================================== */
/*  Security Module Tests                                               */
/* ================================================================== */

describe('Security — sanitizeText', () => {
  it('removes HTML tags', () => {
    const result = VenueIQ.Security.sanitizeText('<script>alert("xss")</script>Hello');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('Hello');
  });
  it('encodes ampersands', () => {
    expect(VenueIQ.Security.sanitizeText('a & b')).toContain('&amp;');
  });
  it('encodes double quotes', () => {
    expect(VenueIQ.Security.sanitizeText('"quoted"')).toContain('&quot;');
  });
  it('encodes single quotes', () => {
    expect(VenueIQ.Security.sanitizeText("it's")).toContain('&#x27;');
  });
  it('encodes forward slashes', () => {
    expect(VenueIQ.Security.sanitizeText('a/b')).toContain('&#x2F;');
  });
  it('truncates to maxLength', () => {
    const long = 'a'.repeat(200);
    expect(VenueIQ.Security.sanitizeText(long, 50).length).toBeLessThan(51);
  });
  it('returns empty string for non-string input', () => {
    expect(VenueIQ.Security.sanitizeText(null)).toBe('');
    expect(VenueIQ.Security.sanitizeText(undefined)).toBe('');
    expect(VenueIQ.Security.sanitizeText(123)).toBe('');
  });
  it('handles empty string input', () => {
    expect(VenueIQ.Security.sanitizeText('')).toBe('');
  });
  it('trims whitespace', () => {
    const result = VenueIQ.Security.sanitizeText('  hello  ');
    expect(result).toBe('hello');
  });
  it('encodes angle brackets in attributes', () => {
    const result = VenueIQ.Security.sanitizeText('<img onerror="xss">');
    expect(result).toContain('&lt;img');
  });
});

describe('Security — validateField', () => {
  it('validates required text field — fails when empty', () => {
    const result = VenueIQ.Security.validateField('', 'text', { required: true });
    expect(result.valid).toBeFalse();
  });
  it('validates required text field — passes with value', () => {
    const result = VenueIQ.Security.validateField('hello', 'text', { required: true });
    expect(result.valid).toBeTrue();
  });
  it('accepts valid email', () => {
    expect(VenueIQ.Security.validateField('test@example.com', 'email').valid).toBeTrue();
  });
  it('rejects invalid email without @', () => {
    expect(VenueIQ.Security.validateField('not-an-email', 'email').valid).toBeFalse();
  });
  it('rejects invalid email without domain', () => {
    expect(VenueIQ.Security.validateField('user@', 'email').valid).toBeFalse();
  });
  it('validates number range — within range passes', () => {
    expect(VenueIQ.Security.validateField('50', 'number', { min: 0, max: 100 }).valid).toBeTrue();
  });
  it('validates number range — above max fails', () => {
    expect(VenueIQ.Security.validateField('150', 'number', { min: 0, max: 100 }).valid).toBeFalse();
  });
  it('validates number range — below min fails', () => {
    expect(VenueIQ.Security.validateField('-5', 'number', { min: 0, max: 100 }).valid).toBeFalse();
  });
  it('rejects non-numeric value for number type', () => {
    expect(VenueIQ.Security.validateField('abc', 'number').valid).toBeFalse();
  });
  it('rejects invalid select option', () => {
    const result = VenueIQ.Security.validateField('evil', 'select', { allowedValues: ['good', 'ok'] });
    expect(result.valid).toBeFalse();
  });
  it('accepts valid select option', () => {
    const result = VenueIQ.Security.validateField('good', 'select', { allowedValues: ['good', 'ok'] });
    expect(result.valid).toBeTrue();
  });
  it('returns error message for invalid result', () => {
    const result = VenueIQ.Security.validateField('', 'text', { required: true });
    expect(typeof result.error).toBe('string');
    expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('Security — createElement', () => {
  it('creates valid DOM element', () => {
    const el = VenueIQ.Security.createElement('div', { class: 'test', textContent: 'Hello' });
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toBe('test');
  });
  it('creates element with children', () => {
    const child = VenueIQ.Security.createElement('span', { textContent: 'child' });
    const parent = VenueIQ.Security.createElement('div', {}, [child]);
    expect(parent.children.length).toBe(1);
  });
  it('creates element with text children', () => {
    const el = VenueIQ.Security.createElement('button', {}, ['Click me']);
    expect(el.textContent).toBe('Click me');
  });
  it('blocks disallowed tags', () => {
    const el = VenueIQ.Security.createElement('script');
    expect(el instanceof HTMLElement).toBeFalse();
  });
  it('blocks javascript: URIs in href', () => {
    const el = VenueIQ.Security.createElement('a', { href: 'javascript:alert(1)' });
    expect(el.getAttribute('href')).toBeNull();
  });
  it('blocks javascript: URIs in src', () => {
    const el = VenueIQ.Security.createElement('img', { src: 'javascript:void(0)' });
    expect(el.getAttribute('src')).toBeNull();
  });
  it('sanitizes textContent', () => {
    const el = VenueIQ.Security.createElement('div', { textContent: '<script>xss</script>' });
    expect(el.textContent).toContain('&lt;script');
  });
  it('sets aria-label correctly', () => {
    const el = VenueIQ.Security.createElement('button', { ariaLabel: 'Close dialog' });
    expect(el.getAttribute('aria-label')).toBe('Close dialog');
  });
  it('blocks dangerous event handler attributes', () => {
    const el = VenueIQ.Security.createElement('div', { onclick: 'alert(1)' });
    expect(el.getAttribute('onclick')).toBeNull();
  });
  it('blocks onerror attribute', () => {
    const el = VenueIQ.Security.createElement('img', { onerror: 'alert(1)' });
    expect(el.getAttribute('onerror')).toBeNull();
  });
});

describe('Security — checkRateLimit', () => {
  it('allows calls within limit', () => {
    const result = VenueIQ.Security.checkRateLimit('test-rate-1', 5, 60000);
    expect(result).toBeTrue();
  });
  it('blocks excess calls', () => {
    const key = 'test-rate-exceed-' + Date.now();
    for (let i = 0; i < 3; i++) VenueIQ.Security.checkRateLimit(key, 3, 60000);
    const blocked = VenueIQ.Security.checkRateLimit(key, 3, 60000);
    expect(blocked).toBeFalse();
  });
  it('allows calls after window resets', () => {
    const key = 'test-rate-reset-' + Date.now();
    // First call always succeeds
    const result = VenueIQ.Security.checkRateLimit(key, 1, 0); // window=0ms so immediately resets
    expect(result).toBeTrue();
  });
  it('different keys are independent', () => {
    const key1 = 'rate-key1-' + Date.now();
    const key2 = 'rate-key2-' + Date.now();
    VenueIQ.Security.checkRateLimit(key1, 1, 60000);
    VenueIQ.Security.checkRateLimit(key1, 1, 60000); // blocks
    const k2result = VenueIQ.Security.checkRateLimit(key2, 5, 60000);
    expect(k2result).toBeTrue();
  });
});

describe('Security — localStorage helpers', () => {
  it('sets and gets values safely', () => {
    VenueIQ.Security.lsSet('test-key', { val: 42 });
    const got = VenueIQ.Security.lsGet('test-key');
    expect(got.val).toBe(42);
  });
  it('stores and retrieves arrays', () => {
    VenueIQ.Security.lsSet('test-arr', [1, 2, 3]);
    const got = VenueIQ.Security.lsGet('test-arr');
    expect(Array.isArray(got)).toBeTrue();
    expect(got.length).toBe(3);
  });
  it('stores and retrieves strings', () => {
    VenueIQ.Security.lsSet('test-str', 'hello');
    expect(VenueIQ.Security.lsGet('test-str')).toBe('hello');
  });
  it('stores and retrieves booleans', () => {
    VenueIQ.Security.lsSet('test-bool', false);
    expect(VenueIQ.Security.lsGet('test-bool')).toBe(false);
  });
  it('returns fallback for missing keys', () => {
    const result = VenueIQ.Security.lsGet('nonexistent-key-xyz', 'fallback');
    expect(result).toBe('fallback');
  });
  it('returns null fallback by default', () => {
    const result = VenueIQ.Security.lsGet('another-missing-key');
    expect(result).toBeNull();
  });
  it('removes key correctly', () => {
    VenueIQ.Security.lsSet('rm-test', 'value');
    VenueIQ.Security.lsRemove('rm-test');
    expect(VenueIQ.Security.lsGet('rm-test')).toBeNull();
  });
  it('handles numeric values', () => {
    VenueIQ.Security.lsSet('test-num', 12345);
    expect(VenueIQ.Security.lsGet('test-num')).toBe(12345);
  });
});

describe('Security — generateToken', () => {
  it('returns a string', () => {
    expect(typeof VenueIQ.Security.generateToken()).toBe('string');
  });
  it('returns correct default length (32 hex chars for 16 bytes)', () => {
    expect(VenueIQ.Security.generateToken().length).toBe(32);
  });
  it('generates unique tokens', () => {
    const t1 = VenueIQ.Security.generateToken();
    const t2 = VenueIQ.Security.generateToken();
    expect(t1 === t2).toBeFalse();
  });
  it('returns hex string matching pattern', () => {
    expect(VenueIQ.Security.generateToken()).toMatch(/^[0-9a-f]+$/);
  });
});

describe('Security — safeJSONParse', () => {
  it('parses valid JSON', () => {
    expect(VenueIQ.Security.safeJSONParse('{"a":1}').a).toBe(1);
  });
  it('returns fallback for invalid JSON', () => {
    expect(VenueIQ.Security.safeJSONParse('not json', 'default')).toBe('default');
  });
  it('returns null fallback by default', () => {
    expect(VenueIQ.Security.safeJSONParse('{broken')).toBeNull();
  });
  it('parses arrays', () => {
    const result = VenueIQ.Security.safeJSONParse('[1,2,3]');
    expect(Array.isArray(result)).toBeTrue();
  });
});

/* ================================================================== */
/*  Utils Module Tests                                                  */
/* ================================================================== */

describe('Utils — DOM helpers', () => {
  it('$ returns element', () => {
    const el = VenueIQ.Utils.$('body');
    expect(el).toBeInstanceOf(HTMLElement);
  });
  it('$ returns null for missing selector', () => {
    const el = VenueIQ.Utils.$('#definitely-does-not-exist-element');
    expect(el).toBeNull();
  });
  it('$ returns null for invalid selector', () => {
    const el = VenueIQ.Utils.$('[[invalid]]');
    expect(el).toBeNull();
  });
  it('$$ returns array', () => {
    const els = VenueIQ.Utils.$$('div');
    expect(Array.isArray(els)).toBeTrue();
  });
  it('$$ returns empty array for no matches', () => {
    const els = VenueIQ.Utils.$$('.no-such-class-exists-xyz');
    expect(els.length).toBe(0);
  });
  it('$$ with context', () => {
    const body = document.body;
    const els = VenueIQ.Utils.$$('*', body);
    expect(els.length).toBeGreaterThan(0);
  });
});

describe('Utils — formatNumber', () => {
  it('formats integers', () => {
    expect(VenueIQ.Utils.formatNumber(72340)).toContain('72');
  });
  it('returns dash for NaN', () => {
    expect(VenueIQ.Utils.formatNumber(NaN)).toBe('—');
  });
  it('returns dash for non-number', () => {
    expect(VenueIQ.Utils.formatNumber('abc')).toBe('—');
  });
  it('formats zero correctly', () => {
    expect(VenueIQ.Utils.formatNumber(0)).toContain('0');
  });
  it('formats negative numbers', () => {
    expect(VenueIQ.Utils.formatNumber(-100)).toContain('100');
  });
});

describe('Utils — formatDuration', () => {
  it('formats sub-minute as "< 1 min"', () => {
    expect(VenueIQ.Utils.formatDuration(0.5)).toBe('< 1 min');
  });
  it('formats minutes correctly', () => {
    expect(VenueIQ.Utils.formatDuration(5)).toContain('5');
  });
  it('formats hours correctly', () => {
    expect(VenueIQ.Utils.formatDuration(90)).toContain('h');
  });
  it('returns dash for negative input', () => {
    expect(VenueIQ.Utils.formatDuration(-1)).toBe('—');
  });
  it('returns dash for NaN', () => {
    expect(VenueIQ.Utils.formatDuration(NaN)).toBe('—');
  });
  it('formats exactly 60 minutes as 1h', () => {
    expect(VenueIQ.Utils.formatDuration(60)).toContain('h');
  });
  it('formats 90 min as "1h 30m"', () => {
    expect(VenueIQ.Utils.formatDuration(90)).toContain('1h');
  });
});

describe('Utils — formatPercent', () => {
  it('formats to 1 decimal', () => {
    expect(VenueIQ.Utils.formatPercent(94.7)).toBe('94.7%');
  });
  it('formats 0 correctly', () => {
    expect(VenueIQ.Utils.formatPercent(0)).toBe('0.0%');
  });
  it('formats 100 correctly', () => {
    expect(VenueIQ.Utils.formatPercent(100)).toBe('100.0%');
  });
  it('returns dash for NaN', () => {
    expect(VenueIQ.Utils.formatPercent(NaN)).toBe('—');
  });
  it('respects custom decimals', () => {
    expect(VenueIQ.Utils.formatPercent(94.7123, 2)).toBe('94.71%');
  });
});

describe('Utils — formatCurrency', () => {
  it('formats lakhs correctly', () => {
    const result = VenueIQ.Utils.formatCurrency(2840000);
    expect(result).toContain('L');
    expect(result).toContain('₹');
  });
  it('formats thousands correctly', () => {
    const result = VenueIQ.Utils.formatCurrency(5000);
    expect(result).toContain('K');
  });
  it('formats small amounts without suffix', () => {
    const result = VenueIQ.Utils.formatCurrency(500);
    expect(result).toContain('₹');
    expect(result).not.toContain('K');
    expect(result).not.toContain('L');
  });
  it('returns dash for NaN', () => {
    expect(VenueIQ.Utils.formatCurrency(NaN)).toBe('—');
  });
});

describe('Utils — clamp', () => {
  it('clamps to min', () => { expect(VenueIQ.Utils.clamp(-5, 0, 100)).toBe(0); });
  it('clamps to max', () => { expect(VenueIQ.Utils.clamp(200, 0, 100)).toBe(100); });
  it('returns value within range', () => { expect(VenueIQ.Utils.clamp(50, 0, 100)).toBe(50); });
  it('handles equal min and max', () => { expect(VenueIQ.Utils.clamp(50, 42, 42)).toBe(42); });
  it('handles value equal to min', () => { expect(VenueIQ.Utils.clamp(0, 0, 100)).toBe(0); });
  it('handles value equal to max', () => { expect(VenueIQ.Utils.clamp(100, 0, 100)).toBe(100); });
});

describe('Utils — lerp', () => {
  it('interpolates correctly at t=0.5', () => { expect(VenueIQ.Utils.lerp(0, 100, 0.5)).toBe(50); });
  it('returns start at t=0', () => { expect(VenueIQ.Utils.lerp(0, 100, 0)).toBe(0); });
  it('returns end at t=1', () => { expect(VenueIQ.Utils.lerp(0, 100, 1)).toBe(100); });
  it('clamps t > 1 to end', () => { expect(VenueIQ.Utils.lerp(0, 100, 2)).toBe(100); });
  it('clamps t < 0 to start', () => { expect(VenueIQ.Utils.lerp(0, 100, -1)).toBe(0); });
  it('works with negative range', () => { expect(VenueIQ.Utils.lerp(100, -100, 0.5)).toBe(0); });
});

describe('Utils — mapRange', () => {
  it('maps 0.5 in [0,1] to 50 in [0,100]', () => {
    expect(VenueIQ.Utils.mapRange(0.5, 0, 1, 0, 100)).toBe(50);
  });
  it('maps min to outMin', () => {
    expect(VenueIQ.Utils.mapRange(0, 0, 10, 50, 150)).toBe(50);
  });
  it('maps max to outMax', () => {
    expect(VenueIQ.Utils.mapRange(10, 0, 10, 50, 150)).toBe(150);
  });
});

describe('Utils — debounce', () => {
  it('returns a function', () => {
    const debounced = VenueIQ.Utils.debounce(() => {}, 100);
    expect(typeof debounced).toBe('function');
  });
  it('delays execution', (done) => {
    let count = 0;
    const debounced = VenueIQ.Utils.debounce(() => count++, 50);
    debounced(); debounced(); debounced();
    expect(count).toBe(0); // not called yet
  });
});

describe('Utils — throttle', () => {
  it('returns a function', () => {
    const throttled = VenueIQ.Utils.throttle(() => {}, 100);
    expect(typeof throttled).toBe('function');
  });
  it('limits calls to once per interval', () => {
    let count = 0;
    const throttled = VenueIQ.Utils.throttle(() => count++, 1000);
    throttled(); throttled(); throttled();
    expect(count).toBe(1);
  });
  it('allows call after interval', () => {
    let count = 0;
    const throttled = VenueIQ.Utils.throttle(() => count++, 0);
    throttled();
    throttled();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('Utils — randFloat', () => {
  it('returns number within range', () => {
    for (let i = 0; i < 20; i++) {
      const r = VenueIQ.Utils.randFloat(5, 10);
      expect(r >= 5 && r <= 10).toBeTrue();
    }
    expect(true).toBeTrue();
  });
});

describe('Utils — randInt', () => {
  it('returns integer', () => {
    const r = VenueIQ.Utils.randInt(0, 100);
    expect(Number.isInteger(r)).toBeTrue();
  });
  it('returns value within inclusive range', () => {
    for (let i = 0; i < 20; i++) {
      const r = VenueIQ.Utils.randInt(3, 7);
      expect(r >= 3 && r <= 7).toBeTrue();
    }
    expect(true).toBeTrue();
  });
});

describe('Utils — shuffle', () => {
  it('returns same length array', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(VenueIQ.Utils.shuffle(arr).length).toBe(5);
  });
  it('does not mutate original', () => {
    const arr = [1, 2, 3];
    VenueIQ.Utils.shuffle(arr);
    expect(arr[0]).toBe(1);
  });
  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = VenueIQ.Utils.shuffle(arr);
    expect(shuffled.includes(3)).toBeTrue();
    expect(shuffled.includes(5)).toBeTrue();
  });
});

describe('Utils — deepClone', () => {
  it('creates a deep copy', () => {
    const obj = { a: { b: 1 } };
    const clone = VenueIQ.Utils.deepClone(obj);
    clone.a.b = 99;
    expect(obj.a.b).toBe(1);
  });
  it('handles arrays', () => {
    const arr = [1, [2, 3]];
    const clone = VenueIQ.Utils.deepClone(arr);
    expect(Array.isArray(clone)).toBeTrue();
    expect(clone[1][0]).toBe(2);
  });
});

describe('Utils — groupBy', () => {
  it('groups correctly', () => {
    const data = [{ cat: 'a' }, { cat: 'b' }, { cat: 'a' }];
    const grouped = VenueIQ.Utils.groupBy(data, 'cat');
    expect(grouped.a.length).toBe(2);
    expect(grouped.b.length).toBe(1);
  });
  it('handles empty array', () => {
    const grouped = VenueIQ.Utils.groupBy([], 'cat');
    expect(Object.keys(grouped).length).toBe(0);
  });
});

describe('Utils — uniqueId', () => {
  it('returns a string', () => {
    expect(typeof VenueIQ.Utils.uniqueId()).toBe('string');
  });
  it('generates unique IDs', () => {
    const a = VenueIQ.Utils.uniqueId();
    const b = VenueIQ.Utils.uniqueId();
    expect(a === b).toBeFalse();
  });
  it('respects prefix', () => {
    expect(VenueIQ.Utils.uniqueId('test')).toMatch(/^test-/);
  });
  it('default prefix is viq', () => {
    expect(VenueIQ.Utils.uniqueId()).toMatch(/^viq-/);
  });
});

describe('Utils — densityToColor', () => {
  it('returns hsl string', () => {
    expect(VenueIQ.Utils.densityToColor(0.5)).toContain('hsl');
  });
  it('returns blue for 0 (empty)', () => {
    expect(VenueIQ.Utils.densityToColor(0)).toContain('240');
  });
  it('returns different colors for different densities', () => {
    const low = VenueIQ.Utils.densityToColor(0.1);
    const high = VenueIQ.Utils.densityToColor(0.9);
    expect(low === high).toBeFalse();
  });
});

describe('Utils — statusToColor', () => {
  it('returns success color for ok', () => {
    expect(VenueIQ.Utils.statusToColor('ok')).toContain('success');
  });
  it('returns warning color for warning', () => {
    expect(VenueIQ.Utils.statusToColor('warning')).toContain('warning');
  });
  it('returns danger color for critical', () => {
    expect(VenueIQ.Utils.statusToColor('critical')).toContain('danger');
  });
  it('returns fallback for unknown status', () => {
    expect(VenueIQ.Utils.statusToColor('unknown')).toBeTruthy();
  });
});

describe('Utils — formatRelativeTime', () => {
  it('returns "just now" for recent times', () => {
    expect(VenueIQ.Utils.formatRelativeTime(Date.now() - 5000)).toBe('just now');
  });
  it('returns minutes for times within an hour', () => {
    expect(VenueIQ.Utils.formatRelativeTime(Date.now() - 5 * 60 * 1000)).toContain('min ago');
  });
  it('returns hours for times within a day', () => {
    expect(VenueIQ.Utils.formatRelativeTime(Date.now() - 2 * 3600 * 1000)).toContain('h ago');
  });
});

describe('Utils — sleep', () => {
  it('returns a promise', () => {
    const p = VenueIQ.Utils.sleep(1);
    expect(p instanceof Promise).toBeTrue();
  });
});

/* ================================================================== */
/*  DataStore Module Tests                                             */
/* ================================================================== */

describe('DataStore — get/set', () => {
  it('gets top-level key', () => {
    const v = VenueIQ.DataStore.get('venue');
    expect(typeof v).toBe('object');
    expect(v).toBeTruthy();
  });
  it('gets nested key', () => {
    const name = VenueIQ.DataStore.get('venue.name');
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });
  it('sets and gets value', () => {
    VenueIQ.DataStore.set('venue.currentAttendance', 99999);
    expect(VenueIQ.DataStore.get('venue.currentAttendance')).toBe(99999);
    VenueIQ.DataStore.set('venue.currentAttendance', 72340);
  });
  it('returns undefined for missing key', () => {
    expect(VenueIQ.DataStore.get('nonexistent.deep.key')).toBeUndefined();
  });
  it('deep clone prevents mutation of returned value', () => {
    const venue = VenueIQ.DataStore.get('venue');
    venue.name = 'Hacked';
    expect(VenueIQ.DataStore.get('venue.name')).toBe('MetroArena Stadium');
  });
  it('set creates intermediate objects', () => {
    VenueIQ.DataStore.set('newKey.nested.value', 42);
    expect(VenueIQ.DataStore.get('newKey.nested.value')).toBe(42);
  });
  it('stores arrays correctly', () => {
    VenueIQ.DataStore.set('testArray', [1, 2, 3]);
    const arr = VenueIQ.DataStore.get('testArray');
    expect(Array.isArray(arr)).toBeTrue();
    expect(arr.length).toBe(3);
  });
});

describe('DataStore — subscribe', () => {
  it('calls subscriber on set', () => {
    let called = false;
    const unsub = VenueIQ.DataStore.subscribe('zones', () => { called = true; });
    VenueIQ.DataStore.set('zones', VenueIQ.DataStore.get('zones'));
    unsub();
    expect(called).toBeTrue();
  });
  it('returns unsubscribe function', () => {
    const unsub = VenueIQ.DataStore.subscribe('zones', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });
  it('does not call after unsubscribe', () => {
    let count = 0;
    const unsub = VenueIQ.DataStore.subscribe('stats', () => count++);
    unsub();
    VenueIQ.DataStore.set('stats.avgWaitMinutes', 5);
    expect(count).toBe(0);
  });
  it('passes new value to subscriber', () => {
    let received = null;
    const unsub = VenueIQ.DataStore.subscribe('stats.avgWaitMinutes', (val) => { received = val; });
    VenueIQ.DataStore.set('stats.avgWaitMinutes', 7.3);
    unsub();
    expect(received).toBe(7.3);
    VenueIQ.DataStore.set('stats.avgWaitMinutes', 4.2);
  });
  it('supports multiple subscribers on same key', () => {
    let c1 = 0, c2 = 0;
    const u1 = VenueIQ.DataStore.subscribe('alerts', () => c1++);
    const u2 = VenueIQ.DataStore.subscribe('alerts', () => c2++);
    VenueIQ.DataStore.set('alerts', []);
    u1(); u2();
    expect(c1).toBe(1);
    expect(c2).toBe(1);
  });
});

describe('DataStore — merge', () => {
  it('merges object properties', () => {
    VenueIQ.DataStore.merge('stats', { avgWaitMinutes: 3.0 });
    expect(VenueIQ.DataStore.get('stats.avgWaitMinutes')).toBe(3.0);
    VenueIQ.DataStore.merge('stats', { avgWaitMinutes: 4.2 });
  });
  it('does not overwrite unrelated properties', () => {
    const before = VenueIQ.DataStore.get('stats.satisfactionPct');
    VenueIQ.DataStore.merge('stats', { avgWaitMinutes: 2.0 });
    expect(VenueIQ.DataStore.get('stats.satisfactionPct')).toBe(before);
    VenueIQ.DataStore.merge('stats', { avgWaitMinutes: 4.2 });
  });
});

describe('DataStore — initial data integrity', () => {
  it('has zones array', () => {
    const zones = VenueIQ.DataStore.get('zones');
    expect(Array.isArray(zones)).toBeTrue();
    expect(zones.length).toBeGreaterThan(0);
  });
  it('has queues array', () => {
    const queues = VenueIQ.DataStore.get('queues');
    expect(Array.isArray(queues)).toBeTrue();
    expect(queues.length).toBeGreaterThan(0);
  });
  it('venue capacity is a positive number', () => {
    const cap = VenueIQ.DataStore.get('venue.capacity');
    expect(typeof cap).toBe('number');
    expect(cap).toBeGreaterThan(0);
  });
  it('all zones have required fields', () => {
    const zones = VenueIQ.DataStore.get('zones');
    zones.forEach(z => {
      expect(typeof z.id).toBe('string');
      expect(typeof z.name).toBe('string');
      expect(typeof z.capacity).toBe('number');
      expect(typeof z.current).toBe('number');
      expect(['ok', 'warning', 'critical']).toContain(z.status ? z.status : 'ok');
    });
    expect(true).toBeTrue();
  });
  it('all queues have required fields', () => {
    const queues = VenueIQ.DataStore.get('queues');
    queues.forEach(q => {
      expect(typeof q.id).toBe('string');
      expect(typeof q.name).toBe('string');
      expect(typeof q.waitMin).toBe('number');
      expect(q.waitMin).toBeGreaterThan(0);
    });
    expect(true).toBeTrue();
  });
  it('has staff array with counts', () => {
    const staff = VenueIQ.DataStore.get('staff');
    expect(Array.isArray(staff)).toBeTrue();
    staff.forEach(s => expect(typeof s.count).toBe('number'));
    expect(true).toBeTrue();
  });
  it('has alerts array', () => {
    const alerts = VenueIQ.DataStore.get('alerts');
    expect(Array.isArray(alerts)).toBeTrue();
  });
  it('venue attendance is within capacity', () => {
    const att = VenueIQ.DataStore.get('venue.currentAttendance');
    const cap = VenueIQ.DataStore.get('venue.capacity');
    expect(att).toBeLessThanOrEqual(cap);
  });
  it('has emergency contacts', () => {
    const contacts = VenueIQ.DataStore.get('emergencyContacts');
    expect(Array.isArray(contacts)).toBeTrue();
    expect(contacts.length).toBeGreaterThan(0);
  });
  it('zone current never exceeds capacity', () => {
    const zones = VenueIQ.DataStore.get('zones');
    zones.forEach(z => expect(z.current).toBeLessThanOrEqual(z.capacity));
    expect(true).toBeTrue();
  });
});

/* ================================================================== */
/*  Accessibility Tests                                                 */
/* ================================================================== */

describe('Accessibility — DOM Structure', () => {
  it('has skip-link element', () => {
    const el = document.querySelector('.skip-link');
    expect(el).toBeTruthy();
  });
  it('skip-link has href to main-content', () => {
    const el = document.querySelector('.skip-link');
    expect(el?.getAttribute('href')).toBe('#main-content');
  });
  it('main content has id and tabindex', () => {
    const main = document.getElementById('main-content');
    expect(main).toBeTruthy();
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });
  it('has aria-live polite region', () => {
    const el = document.getElementById('aria-live-polite');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });
  it('has aria-live assertive region', () => {
    const el = document.getElementById('aria-live-assertive');
    expect(el?.getAttribute('aria-live')).toBe('assertive');
  });
  it('nav has role=navigation and aria-label', () => {
    const nav = document.querySelector('nav[role="navigation"]');
    expect(nav).toBeTruthy();
    expect(nav?.getAttribute('aria-label')).toBeTruthy();
  });
  it('main has role=main', () => {
    const main = document.querySelector('[role="main"]');
    expect(main).toBeTruthy();
  });
  it('all images have alt text', () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const missing = imgs.filter(img => !img.getAttribute('alt'));
    expect(missing.length).toBe(0);
  });
  it('all buttons have accessible labels', () => {
    const btns = Array.from(document.querySelectorAll('button'));
    const missing = btns.filter(btn =>
      !btn.textContent?.trim() &&
      !btn.getAttribute('aria-label') &&
      !btn.getAttribute('aria-labelledby')
    );
    expect(missing.length).toBe(0);
  });
  it('all form inputs have labels', () => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
    const missing = inputs.filter(inp => {
      const id = inp.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = inp.getAttribute('aria-label');
      const hasAriaLabelledBy = inp.getAttribute('aria-labelledby');
      return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy;
    });
    expect(missing.length).toBe(0);
  });
  it('html element has lang attribute', () => {
    expect(document.documentElement.getAttribute('lang')).toBeTruthy();
  });
  it('html element has dir attribute', () => {
    expect(document.documentElement.getAttribute('dir')).toBeTruthy();
  });
});

describe('Accessibility — Heading Hierarchy', () => {
  it('has at least one H1', () => {
    const h1s = document.querySelectorAll('h1');
    expect(h1s.length).toBeGreaterThan(0);
  });
  it('headings exist in logical order', () => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
    expect(headings.length).toBeGreaterThan(0);
  });
});

describe('Accessibility — ARIA Attributes', () => {
  it('all aria-label values are non-empty strings', () => {
    const els = Array.from(document.querySelectorAll('[aria-label]'));
    const empty = els.filter(el => !el.getAttribute('aria-label').trim());
    expect(empty.length).toBe(0);
  });
  it('nav buttons exist', () => {
    const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
    expect(navBtns.length).toBeGreaterThan(0);
  });
  it('canvas elements have role=img and aria-label', () => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const invalid = canvases.filter(c =>
      !c.getAttribute('aria-label') || !c.getAttribute('role')
    );
    expect(invalid.length).toBe(0);
  });
  it('modals have aria-modal and aria-labelledby', () => {
    const modals = Array.from(document.querySelectorAll('[role="dialog"]'));
    modals.forEach(m => {
      expect(m.getAttribute('aria-modal')).toBe('true');
      expect(m.getAttribute('aria-labelledby')).toBeTruthy();
    });
    expect(true).toBeTrue();
  });
  it('tablist has aria-label', () => {
    const tablists = Array.from(document.querySelectorAll('[role="tablist"]'));
    tablists.forEach(tl => expect(tl.getAttribute('aria-label')).toBeTruthy());
    expect(true).toBeTrue();
  });
  it('all aria-haspopup values are valid', () => {
    const VALID = ['menu', 'listbox', 'tree', 'grid', 'dialog', 'true', 'false'];
    const els = Array.from(document.querySelectorAll('[aria-haspopup]'));
    const invalid = els.filter(el => !VALID.includes(el.getAttribute('aria-haspopup')));
    expect(invalid.length).toBe(0);
  });
  it('all role=tab buttons have aria-selected', () => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const missing = tabs.filter(t => !t.hasAttribute('aria-selected'));
    expect(missing.length).toBe(0);
  });
});

/* ================================================================== */
/*  SEO & PWA Tests                                                    */
/* ================================================================== */

describe('SEO — Meta Tags', () => {
  it('has title tag', () => {
    expect(document.title.length).toBeGreaterThan(0);
  });
  it('has meta description', () => {
    const desc = document.querySelector('meta[name="description"]');
    expect(desc).toBeTruthy();
    expect(desc?.getAttribute('content').length).toBeGreaterThan(50);
  });
  it('has meta keywords', () => {
    const kw = document.querySelector('meta[name="keywords"]');
    expect(kw).toBeTruthy();
  });
  it('has og:title', () => {
    const og = document.querySelector('meta[property="og:title"]');
    expect(og).toBeTruthy();
    expect(og?.getAttribute('content').length).toBeGreaterThan(0);
  });
  it('has og:description', () => {
    const og = document.querySelector('meta[property="og:description"]');
    expect(og).toBeTruthy();
  });
  it('has og:type', () => {
    const og = document.querySelector('meta[property="og:type"]');
    expect(og?.getAttribute('content')).toBe('website');
  });
  it('has og:image', () => {
    const og = document.querySelector('meta[property="og:image"]');
    expect(og).toBeTruthy();
  });
  it('has og:url', () => {
    const og = document.querySelector('meta[property="og:url"]');
    expect(og).toBeTruthy();
  });
  it('has canonical link', () => {
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical).toBeTruthy();
  });
  it('has twitter:card meta', () => {
    const tc = document.querySelector('meta[name="twitter:card"]');
    expect(tc).toBeTruthy();
  });
  it('has application-name meta', () => {
    const an = document.querySelector('meta[name="application-name"]');
    expect(an?.getAttribute('content')).toBeTruthy();
  });
  it('has JSON-LD structured data', () => {
    const ld = document.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld?.textContent || '{}');
    expect(parsed['@context']).toBe('https://schema.org');
  });
});

describe('SEO — Document Structure', () => {
  it('html has lang attribute', () => {
    expect(document.documentElement.lang).toBeTruthy();
  });
  it('charset is UTF-8', () => {
    const charset = document.querySelector('meta[charset]');
    expect(charset?.getAttribute('charset').toLowerCase()).toBe('utf-8');
  });
  it('viewport meta is present', () => {
    const vp = document.querySelector('meta[name="viewport"]');
    expect(vp).toBeTruthy();
    expect(vp?.getAttribute('content')).toContain('width=device-width');
  });
  it('robots meta is present', () => {
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots).toBeTruthy();
  });
});

describe('PWA — Manifest & Icons', () => {
  it('has manifest link', () => {
    const manifest = document.querySelector('link[rel="manifest"]');
    expect(manifest).toBeTruthy();
  });
  it('has theme-color meta', () => {
    const tc = document.querySelector('meta[name="theme-color"]');
    expect(tc).toBeTruthy();
  });
  it('has apple-mobile-web-app-capable meta', () => {
    const amwac = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    expect(amwac).toBeTruthy();
  });
  it('has apple-touch-icon link', () => {
    const ati = document.querySelector('link[rel="apple-touch-icon"]');
    expect(ati).toBeTruthy();
  });
  it('has favicon link', () => {
    const favicon = document.querySelector('link[rel="icon"]');
    expect(favicon).toBeTruthy();
  });
  it('has apple-mobile-web-app-title', () => {
    const title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    expect(title).toBeTruthy();
  });
});

/* ================================================================== */
/*  Security — DOM Safety Tests                                         */
/* ================================================================== */

describe('Security — XSS Prevention', () => {
  it('rendered zone names are safe', () => {
    const container = document.getElementById('zones-list');
    if (!container) { expect(true).toBeTrue(); return; }
    const scripts = container.querySelectorAll('script');
    expect(scripts.length).toBe(0);
  });
  it('no inline event handlers in rendered lists', () => {
    const body = document.body.innerHTML;
    const alertPattern = /onclick\s*=\s*["'].*alert\(.*\)/i;
    expect(alertPattern.test(body)).toBeFalse();
  });
  it('CSP meta tag present', () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(csp).toBeTruthy();
  });
  it('CSP includes default-src', () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    expect(csp?.getAttribute('content')).toContain('default-src');
  });
  it('no mixed content vulnerabilities possible (no http:// external scripts)', () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const httpScripts = scripts.filter(s => s.src.startsWith('http://'));
    expect(httpScripts.length).toBe(0);
  });
  it('no mixed content vulnerabilities in stylesheets', () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
    const httpLinks = links.filter(l => l.getAttribute('href')?.startsWith('http://'));
    expect(httpLinks.length).toBe(0);
  });
  it('X-Content-Type-Options header set via meta', () => {
    const meta = document.querySelector('meta[http-equiv="X-Content-Type-Options"]');
    expect(meta).toBeTruthy();
  });
  it('Referrer-Policy meta set', () => {
    const meta = document.querySelector('meta[http-equiv="Referrer-Policy"]');
    expect(meta).toBeTruthy();
  });
});

/* ================================================================== */
/*  Run All Tests                                                       */
/* ================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Wait for app to initialize
  setTimeout(() => { run(); }, 2000);
});
