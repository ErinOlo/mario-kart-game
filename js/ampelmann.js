/*
 * ampelmann.js — Ampelmännchen vector paths (traced from your image)
 * Two silhouettes: `walk` (green, striding) and `stop` (red, arms out).
 * Each is a single closed path. Coordinates start at (0,0); use the given
 * width/height as the SVG viewBox.
 *
 * Usage (ES module):  import { AMPELMANN, makeSVG, drawOnCanvas } from './ampelmann.js';
 * Usage (script tag): window.AMPELMANN, window.makeSVG, window.drawOnCanvas
 */

export const AMPELMANN = {
  walk: {
    width: 217,
    height: 241,
    color: "#019540",
    d: "M176.5,241.0 171.0,239.5 171.0,233.5 179.0,210.5 123.5,165.0 120.5,165.0 114.0,171.5 57.5,232.0 37.5,216.0 16.0,194.5 14.0,190.5 15.5,187.0 19.5,187.0 39.5,193.0 42.5,192.0 81.0,144.5 81.0,141.5 77.5,138.0 62.5,142.0 27.5,122.0 0.0,91.5 4.0,82.5 8.5,78.0 13.5,77.0 19.5,80.0 33.5,93.0 58.5,104.0 67.5,106.0 74.0,100.5 90.0,80.5 91.0,75.5 75.5,67.0 71.0,58.5 73.0,43.5 67.0,36.5 77.0,30.5 82.0,20.5 67.5,11.0 65.0,7.5 66.5,6.0 72.5,5.0 90.5,9.0 98.5,1.0 105.5,1.0 150.5,22.0 150.0,35.5 168.5,45.0 174.0,50.5 172.5,52.0 146.5,51.0 138.0,60.5 130.0,74.5 145.0,105.5 152.0,126.5 157.0,134.5 208.0,188.5 215.0,196.5 217.0,201.5 215.0,206.5 202.5,220.0 176.5,241.0Z"
  },
  stop: {
    width: 221,
    height: 241,
    color: "#e30613",
    d: "M121.5,241.0 95.5,240.0 86.0,236.5 92.0,231.5 92.0,222.5 85.0,182.5 80.0,136.5 74.0,120.5 68.5,115.0 59.5,111.0 28.5,108.0 22.5,106.0 20.5,103.0 6.5,104.0 3.0,101.5 0.0,92.5 2.0,85.5 6.5,81.0 21.5,83.0 28.5,79.0 64.5,75.0 92.5,64.0 94.0,62.5 93.0,58.5 85.0,51.5 75.0,33.5 60.0,24.5 78.5,19.0 97.5,4.0 109.5,0.0 124.5,2.0 135.5,8.0 148.5,19.0 167.0,25.5 153.0,33.5 146.0,46.5 131.0,59.5 132.5,64.0 161.5,76.0 190.5,78.0 201.5,82.0 215.5,81.0 221.0,87.5 221.0,97.5 215.5,104.0 202.5,101.0 196.5,107.0 165.5,109.0 159.5,111.0 154.0,115.5 150.0,126.5 144.0,182.5 135.0,227.5 135.0,231.5 143.0,235.5 138.5,238.0 121.5,241.0Z"
  }
};

const SVGNS = "http://www.w3.org/2000/svg";

/**
 * Build an <svg> element for one figure.
 * @param {"walk"|"stop"} which
 * @param {object} [opts] - { size?, fill? }  size = width in px (height scales)
 * @returns {SVGSVGElement}
 */
export function makeSVG(which, opts = {}) {
  const f = AMPELMANN[which];
  if (!f) throw new Error(`Unknown figure "${which}" (use "walk" or "stop")`);
  const fill = opts.fill ?? f.color;

  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${f.width} ${f.height}`);
  svg.setAttribute("xmlns", SVGNS);
  if (opts.size) {
    svg.setAttribute("width", opts.size);
    svg.setAttribute("height", (opts.size * f.height / f.width).toFixed(1));
  }
  const path = document.createElementNS(SVGNS, "path");
  path.setAttribute("d", f.d);
  path.setAttribute("fill", fill);
  svg.appendChild(path);
  return svg;
}

/**
 * Return a plain SVG markup string (handy for innerHTML or server-side).
 */
export function svgString(which, opts = {}) {
  const f = AMPELMANN[which];
  const fill = opts.fill ?? f.color;
  return `<svg xmlns="${SVGNS}" viewBox="0 0 ${f.width} ${f.height}">` +
         `<path d="${f.d}" fill="${fill}"/></svg>`;
}

/**
 * Draw a figure onto a Canvas 2D context (uses Path2D).
 * @param {CanvasRenderingContext2D} ctx
 * @param {"walk"|"stop"} which
 * @param {object} [opts] - { x?, y?, scale?, fill? }
 */
export function drawOnCanvas(ctx, which, opts = {}) {
  const f = AMPELMANN[which];
  const { x = 0, y = 0, scale = 1, fill = f.color } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = fill;
  ctx.fill(new Path2D(f.d));
  ctx.restore();
}

// Expose on window for non-module <script> usage
if (typeof window !== "undefined") {
  Object.assign(window, { AMPELMANN, makeSVG, svgString, drawOnCanvas });
}
