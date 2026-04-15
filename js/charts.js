/**
 * VenueIQ — Charts Module
 * Canvas-based chart rendering: sparklines, heatmaps, bar/line/pie charts.
 * Zero external dependencies — all native Canvas API.
 * @module charts
 */

'use strict';

const Charts = (() => {

  const { clamp, mapRange, densityToColor, randFloat, randInt } = window.VenueIQ.Utils;

  /* ------------------------------------------------------------------ */
  /*  Sparkline                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Draw a mini sparkline chart on a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {number[]} data
   * @param {object} [opts]
   */
  const drawSparkline = (canvas, data, opts = {}) => {
    if (!canvas || !data?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 60;
    const h = canvas.offsetHeight || 32;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const {
      color = '#6C63FF',
      fillOpacity = 0.25,
      lineWidth = 2,
    } = opts;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => ({
      x: mapRange(i, 0, data.length - 1, 2, w - 2),
      y: mapRange(v, min, max, h - 4, 4),
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, fillOpacity);
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Last dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  /* ------------------------------------------------------------------ */
  /*  Crowd Heatmap                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Draw the stadium crowd density heatmap.
   * @param {HTMLCanvasElement} canvas
   * @param {number[][]} densityGrid - 2D grid of 0..1 values
   * @param {object} [opts]
   */
  const drawHeatmap = (canvas, densityGrid, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr || 900 * dpr;
    canvas.height = canvas.offsetHeight * dpr || 400 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth  || 900;
    const h = canvas.offsetHeight || 400;
    const { showGrid = false, showAnnotations = true } = opts;

    // Black stadium background
    ctx.fillStyle = '#0d1520';
    ctx.fillRect(0, 0, w, h);

    // Draw stadium shape (oval/ellipse)
    const cx = w / 2, cy = h / 2;
    const rx = w * 0.45, ry = h * 0.42;

    // Outer concrete ring
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 20, ry + 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2440';
    ctx.fill();

    // Pitch
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.22, ry * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a6e2b';
    ctx.fill();
    // Pitch markings
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.22, ry * 0.36, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw heatmap cells
    if (densityGrid?.length) {
      const rows = densityGrid.length;
      const cols = densityGrid[0].length;

      densityGrid.forEach((row, ri) => {
        row.forEach((density, ci) => {
          if (density <= 0) return;

          // Map grid to stadium oval positions
          const normX = ci / cols;
          const normY = ri / rows;
          const gx = cx + (normX - 0.5) * 2 * rx;
          const gy = cy + (normY - 0.5) * 2 * ry;

          // Skip if outside stadium oval
          const distX = (gx - cx) / (rx + 20);
          const distY = (gy - cy) / (ry + 20);
          if (distX * distX + distY * distY > 1) return;

          const cellW = w / cols;
          const cellH = h / rows;

          ctx.globalAlpha = clamp(density * 0.8 + 0.1, 0, 0.85);
          ctx.fillStyle = densityToColor(density);
          ctx.beginPath();
          ctx.roundRect
            ? ctx.roundRect(gx - cellW / 2, gy - cellH / 2, cellW, cellH, 3)
            : ctx.rect(gx - cellW / 2, gy - cellH / 2, cellW, cellH);
          ctx.fill();
        });
      });
    }

    ctx.globalAlpha = 1;

    // Zone labels
    if (showAnnotations) {
      const labels = [
        { text: 'NORTH', x: cx, y: cy - ry * 0.75 },
        { text: 'SOUTH', x: cx, y: cy + ry * 0.75 },
        { text: 'EAST',  x: cx + rx * 0.75, y: cy },
        { text: 'WEST',  x: cx - rx * 0.75, y: cy },
        { text: 'VIP',   x: cx, y: cy },
      ];

      ctx.font = `bold ${Math.max(10, w * 0.012)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      labels.forEach(({ text, x, y }) => {
        // Badge background
        const tw = ctx.measureText(text).width + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - tw / 2, y - 10, tw, 20, 4);
        else ctx.rect(x - tw / 2, y - 10, tw, 20);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(text, x, y);
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Generate Density Grid                                               */
  /* ------------------------------------------------------------------ */

  /**
   * Generate a realistic crowd density grid based on zone data.
   * @param {object[]} zones
   * @param {number} rows
   * @param {number} cols
   * @returns {number[][]}
   */
  const generateDensityGrid = (zones, rows = 30, cols = 50) => {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    const cx = cols / 2;
    const cy = rows / 2;

    const ZONE_MAP = {
      north: { yCentre: 0.12, xCentre: 0.5 },
      south: { yCentre: 0.88, xCentre: 0.5 },
      east:  { yCentre: 0.5,  xCentre: 0.88 },
      west:  { yCentre: 0.5,  xCentre: 0.12 },
      vip:   { yCentre: 0.5,  xCentre: 0.5  },
      concourse: { yCentre: 0.5, xCentre: 0.5 },
    };

    zones.forEach(zone => {
      const map = ZONE_MAP[zone.id] || { yCentre: 0.5, xCentre: 0.5 };
      const density = zone.current / zone.capacity;
      const zx = map.xCentre * cols;
      const zy = map.yCentre * rows;
      const spread = zone.id === 'vip' ? 4 : 8;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.sqrt(Math.pow(r - zy, 2) + Math.pow(c - zx, 2));
          if (dist < spread * 2) {
            const influence = Math.max(0, 1 - dist / (spread * 2));
            grid[r][c] = Math.max(
              grid[r][c],
              density * influence + randFloat(-0.05, 0.05)
            );
          }
        }
      }
    });

    // Clamp and return
    return grid.map(row => row.map(v => clamp(v, 0, 1)));
  };

  /* ------------------------------------------------------------------ */
  /*  Bar Chart                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Draw a bar chart on a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {object} data - { labels: string[], datasets: [{label, values, color}] }
   * @param {object} [opts]
   */
  const drawBarChart = (canvas, data, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr || 400 * dpr;
    canvas.height = canvas.offsetHeight * dpr || 250 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth  || 400;
    const h = canvas.offsetHeight || 250;
    const { labels = [], datasets = [] } = data;
    const { padding = 40, fontSize = 11, showGrid = true } = opts;

    if (!labels.length || !datasets.length) return;

    const allValues = datasets.flatMap(d => d.values);
    const maxVal = Math.max(...allValues) * 1.15 || 1;

    const chartX = padding;
    const chartY = 10;
    const chartW = w - padding * 1.8;
    const chartH = h - padding * 1.4;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    if (showGrid) {
      const gridLines = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= gridLines; i++) {
        const y = chartY + (chartH * i / gridLines);
        ctx.beginPath();
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartW, y);
        ctx.stroke();

        // Y-axis labels
        const val = Math.round(maxVal - (maxVal * i / gridLines));
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(val, chartX - 5, y + 4);
      }
    }

    // Bars
    const barGroupW = chartW / labels.length;
    const barW = (barGroupW * 0.7) / datasets.length;
    const barGap = barGroupW * 0.15;

    labels.forEach((label, li) => {
      datasets.forEach((dataset, di) => {
        const val = dataset.values[li] ?? 0;
        const barH = (val / maxVal) * chartH;
        const x = chartX + barGroupW * li + barGap + (barW + 2) * di;
        const y = chartY + chartH - barH;

        // Gradient fill
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, dataset.color || '#6C63FF');
        grad.addColorStop(1, hexToRgba(dataset.color || '#6C63FF', 0.4));
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
        else ctx.rect(x, y, barW, barH);
        ctx.fill();

        // Value label on top
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `bold ${fontSize - 1}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(val, x + barW / 2, y - 4);
      });

      // X-axis label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      const xLabel = chartX + barGroupW * li + barGroupW / 2;
      ctx.fillText(label, xLabel, chartY + chartH + 14);
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Line Chart                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Draw a multi-line chart.
   * @param {HTMLCanvasElement} canvas
   * @param {object} data - { labels, datasets: [{label, values, color}] }
   * @param {object} [opts]
   */
  const drawLineChart = (canvas, data, opts = {}) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr || 600 * dpr;
    canvas.height = canvas.offsetHeight * dpr || 250 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth  || 600;
    const h = canvas.offsetHeight || 250;
    const { labels = [], datasets = [] } = data;
    const { padding = 45, showDots = true, smooth = true } = opts;

    if (!labels.length || !datasets.length) return;

    const allValues = datasets.flatMap(d => d.values);
    const maxVal = Math.max(...allValues) * 1.15 || 1;
    const minVal = Math.min(0, ...allValues);

    const chartX = padding;
    const chartY = 10;
    const chartW = w - padding * 1.6;
    const chartH = h - padding * 1.4;

    ctx.clearRect(0, 0, w, h);

    // Grid
    for (let i = 0; i <= 5; i++) {
      const y = chartY + (chartH * i / 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartW, y);
      ctx.stroke();

      const val = Math.round(maxVal - (maxVal * i / 5));
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, chartX - 6, y + 4);
    }

    // X-axis labels
    labels.forEach((label, i) => {
      const x = chartX + (chartW / (labels.length - 1)) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, chartY + chartH + 14);
    });

    // Draw each dataset
    datasets.forEach(dataset => {
      const points = dataset.values.map((v, i) => ({
        x: chartX + (chartW / (labels.length - 1)) * i,
        y: chartY + chartH - ((v - minVal) / (maxVal - minVal)) * chartH,
      }));

      // Gradient fill under line
      const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
      grad.addColorStop(0, hexToRgba(dataset.color || '#6C63FF', 0.3));
      grad.addColorStop(1, hexToRgba(dataset.color || '#6C63FF', 0));

      ctx.beginPath();
      ctx.moveTo(points[0].x, chartY + chartH);
      if (smooth && points.length > 2) {
        ctx.lineTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const cp1x = points[i].x + (points[i + 1].x - points[i].x) * 0.5;
          ctx.bezierCurveTo(cp1x, points[i].y, cp1x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
        }
      } else {
        points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.lineTo(points[points.length - 1].x, chartY + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      if (smooth && points.length > 2) {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
          const cp1x = points[i].x + (points[i + 1].x - points[i].x) * 0.5;
          ctx.bezierCurveTo(cp1x, points[i].y, cp1x, points[i + 1].y, points[i + 1].x, points[i + 1].y);
        }
      } else {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.strokeStyle = dataset.color || '#6C63FF';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Dots
      if (showDots) {
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = dataset.color || '#6C63FF';
          ctx.fill();
          ctx.strokeStyle = '#0a0e1a';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Donut Chart                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Draw a donut/pie chart.
   * @param {HTMLCanvasElement} canvas
   * @param {object[]} segments - [{label, value, color}]
   * @param {object} [opts]
   */
  const drawDonutChart = (canvas, segments, opts = {}) => {
    if (!canvas || !segments?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr || 260 * dpr;
    canvas.height = canvas.offsetHeight * dpr || 200 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth  || 260;
    const h = canvas.offsetHeight || 200;
    const { innerRadiusFactor = 0.58, showLegend = true } = opts;

    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    const cx = showLegend ? w * 0.38 : w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) * 0.85;
    const innerR = radius * innerRadiusFactor;

    ctx.clearRect(0, 0, w, h);

    let startAngle = -Math.PI / 2;
    const gaps = 0.02;

    segments.forEach(seg => {
      const angle = (seg.value / total) * Math.PI * 2 - gaps;
      const midA = startAngle + angle / 2;

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
      ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
      ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();

      startAngle += angle + gaps;
    });

    // Center text
    const pct = Math.round((segments[0]?.value / total) * 100);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.round(radius * 0.28)}px Space Grotesk, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, cx, cy - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `${Math.round(radius * 0.14)}px Inter, sans-serif`;
    ctx.fillText('TOP', cx, cy + radius * 0.18);

    // Legend
    if (showLegend) {
      const lx = cx + radius + 16;
      let ly = cy - (segments.length * 18) / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      segments.slice(0, 6).forEach(seg => {
        ctx.fillStyle = seg.color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly - 5, 10, 10, 2);
        else ctx.rect(lx, ly - 5, 10, 10);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(`${seg.label} (${Math.round((seg.value/total)*100)}%)`, lx + 14, ly);
        ly += 20;
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Evacuation Map                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Draw the evacuation route map on a canvas.
   * @param {HTMLCanvasElement} canvas
   */
  const drawEvacuationMap = (canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr || 500 * dpr;
    canvas.height = canvas.offsetHeight * dpr || 350 * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth  || 500;
    const h = canvas.offsetHeight || 350;

    ctx.fillStyle = '#0d1520';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const rx = w * 0.42, ry = h * 0.40;

    // Stadium outline
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(26,36,64,0.8)';
    ctx.fill();

    // Pitch
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.2, ry * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a6e2b';
    ctx.fill();

    // Exit paths (animated dashes)
    const exits = [
      { x: cx, y: cy - ry, angle: -90, color: '#00e676', label: 'N-EXIT', status: 'safe' },
      { x: cx, y: cy + ry, angle: 90, color: '#00e676', label: 'S-EXIT', status: 'safe' },
      { x: cx + rx, y: cy, angle: 0, color: '#ff6b35', label: 'E-EXIT', status: 'blocked' },
      { x: cx - rx, y: cy, angle: 180, color: '#ffdd00', label: 'W-EXIT', status: 'caution' },
      { x: cx + rx * 0.7, y: cy - ry * 0.7, angle: -45, color: '#00e676', label: 'NE-EXIT', status: 'safe' },
      { x: cx - rx * 0.7, y: cy - ry * 0.7, angle: -135, color: '#00e676', label: 'NW-EXIT', status: 'safe' },
      { x: cx + rx * 0.7, y: cy + ry * 0.7, angle: 45, color: '#00e676', label: 'SE-EXIT', status: 'safe' },
      { x: cx - rx * 0.7, y: cy + ry * 0.7, angle: 135, color: '#00e676', label: 'SW-EXIT', status: 'safe' },
    ];

    // Assembly points
    const assemblies = [
      { x: cx, y: cy - ry - 30, label: 'A1' },
      { x: cx, y: cy + ry + 30, label: 'A2' },
      { x: cx - rx - 35, y: cy, label: 'A3' },
    ];

    // Draw exit arrows
    exits.forEach(ex => {
      const rad = (ex.angle * Math.PI) / 180;
      const arrowLen = 30;
      const ax = ex.x + Math.cos(rad) * 15;
      const ay = ex.y + Math.sin(rad) * 15;
      const bx = ex.x + Math.cos(rad) * (15 + arrowLen);
      const by = ex.y + Math.sin(rad) * (15 + arrowLen);

      // Arrow line
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = ex.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const headSize = 8;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - headSize * Math.cos(rad - 0.4), by - headSize * Math.sin(rad - 0.4));
      ctx.lineTo(bx - headSize * Math.cos(rad + 0.4), by - headSize * Math.sin(rad + 0.4));
      ctx.closePath();
      ctx.fillStyle = ex.color;
      ctx.fill();

      // Exit dot
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = ex.color;
      ctx.fill();

      // Label
      ctx.fillStyle = ex.color;
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      const lblX = ex.x + Math.cos(rad) * (15 + arrowLen + 18);
      const lblY = ex.y + Math.sin(rad) * (15 + arrowLen + 18);
      ctx.fillText(ex.label, lblX, lblY);
    });

    // Assembly points
    assemblies.forEach(ap => {
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#2979ff';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ap.label, ap.x, ap.y);
      ctx.textBaseline = 'alphabetic';
    });

    // Title
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EVACUATION ROUTE PLAN — MetroArena Stadium', cx, h - 8);
  };

  /* ------------------------------------------------------------------ */
  /*  Helper: Hex to RGBA                                                 */
  /* ------------------------------------------------------------------ */

  const hexToRgba = (hex, alpha = 1) => {
    let r, g, b;
    if (hex.startsWith('#')) {
      const h = hex.slice(1);
      if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
      } else {
        r = parseInt(h.slice(0, 2), 16);
        g = parseInt(h.slice(2, 4), 16);
        b = parseInt(h.slice(4, 6), 16);
      }
      return `rgba(${r},${g},${b},${alpha})`;
    }
    // HSL and CSS vars passthrough
    return hex.replace(')', `, ${alpha})`).replace(/^hsl/, 'hsla');
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    drawSparkline,
    drawHeatmap,
    generateDensityGrid,
    drawBarChart,
    drawLineChart,
    drawDonutChart,
    drawEvacuationMap,
    hexToRgba,
  });

})();

window.VenueIQ = window.VenueIQ || {};
window.VenueIQ.Charts = Charts;
