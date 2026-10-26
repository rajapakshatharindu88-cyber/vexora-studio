export const SVG_NS = 'http://www.w3.org/2000/svg';
export const DEFAULT_WIDTH = 1200;
export const DEFAULT_HEIGHT = 800;

export function uid(prefix = 'obj') {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${value}`;
}

export function createDocument(name = 'Untitled Design', width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  return {
    schema: 'vexora-document', version: 1, name, width, height,
    background: '#ffffff', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    layers: [{ id: 'layer-artwork', name: 'Artwork', visible: true, locked: false }],
    elements: [], metadata: { units: 'px', bleed: 0, colorSpace: 'RGB', profile: 'sRGB' }
  };
}

export function createElement(type, props = {}) {
  const base = {
    id: uid(type), type, name: props.name || `${type[0].toUpperCase()}${type.slice(1)}`,
    x: Number.isFinite(props.x) ? props.x : 100, y: Number.isFinite(props.y) ? props.y : 100,
    w: Number.isFinite(props.w) ? props.w : 120, h: Number.isFinite(props.h) ? props.h : 80,
    tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1, fill: type === 'line' || type === 'path' ? 'none' : '#c8a0f3',
    stroke: '#342b41', strokeWidth: type === 'text' ? 0 : 2, opacity: 1,
    layer: 'layer-artwork', visible: true, locked: false
  };
  return { ...base, ...props, id: props.id || base.id, type };
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function elementBounds(el) {
  const x = (Number(el.x) || 0) + (Number(el.tx) || 0);
  const y = (Number(el.y) || 0) + (Number(el.ty) || 0);
  let w = Math.max(0, Number(el.w) || 0) * Math.max(0.001, Number(el.scaleX) || 1), h = Math.max(0, Number(el.h) || 0) * Math.max(0.001, Number(el.scaleY) || 1);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

export function normalizeHex(hex) {
  if (typeof hex !== 'string') return '#000000';
  let value = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(value)) value = '#' + value.slice(1).split('').map(ch => ch + ch).join('');
  if (!/^#[0-9a-f]{6}$/i.test(value)) return '#000000';
  return value.toLowerCase();
}

export function setElementPosition(el, x, y) {
  el.tx = (Number(el.tx) || 0) + (x - elementBounds(el).x);
  el.ty = (Number(el.ty) || 0) + (y - elementBounds(el).y);
}

export function validateDocument(doc) {
  if (!doc || typeof doc !== 'object' || doc.schema !== 'vexora-document') throw new Error('This is not a VEXORA project document.');
  const width = Number(doc.width), height = Number(doc.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100000 || height > 100000) throw new Error('Document dimensions are invalid.');
  if (!Array.isArray(doc.elements) || !Array.isArray(doc.layers)) throw new Error('Document layers or artwork are invalid.');
  const ids = new Set();
  for (const el of doc.elements) {
    if (!el || typeof el.id !== 'string' || typeof el.type !== 'string') throw new Error('The document contains an invalid object.');
    if (ids.has(el.id)) throw new Error('The document contains duplicate object IDs.');
    ids.add(el.id);
    if (!['rect','ellipse','line','path','polygon','text'].includes(el.type)) throw new Error(`Unsupported object type: ${el.type}`);
    for (const key of ['x','y','w','h','tx','ty','rotation','scaleX','scaleY','strokeWidth','opacity']) {
      if (el[key] !== undefined && !Number.isFinite(Number(el[key]))) throw new Error(`Invalid ${key} value on ${el.name || el.id}.`);
    }
  }
  return true;
}
