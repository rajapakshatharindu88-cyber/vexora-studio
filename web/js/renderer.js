import { SVG_NS, elementBounds, normalizeHex } from './model.js';

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === '') continue;
    node.setAttribute(key, String(value));
  }
  return node;
}

function buildObject(elm) {
  const g = el('g', { 'data-object-id': elm.id, 'data-object-type': elm.type, 'aria-label': elm.name || elm.type, opacity: elm.opacity ?? 1,
    transform: `translate(${(Number(elm.x)||0)+(Number(elm.tx)||0)} ${(Number(elm.y)||0)+(Number(elm.ty)||0)}) rotate(${Number(elm.rotation)||0} ${(Number(elm.w)||0)/2} ${(Number(elm.h)||0)/2}) scale(${Math.max(.001,Number(elm.scaleX)||1)} ${Math.max(.001,Number(elm.scaleY)||1)})`,
    'pointer-events': elm.visible === false ? 'none' : 'visiblePainted' });
  if (elm.visible === false) g.setAttribute('display','none');
  const common = { fill: elm.fill ?? 'none', stroke: elm.stroke ?? 'none', 'stroke-width': elm.strokeWidth ?? 0,
    'stroke-linecap': elm.linecap || 'round', 'stroke-linejoin': elm.linejoin || 'round', opacity: elm.opacity ?? 1,
    'vector-effect': 'non-scaling-stroke' };
  let shape;
  const w = Math.max(0, Number(elm.w)||0), h = Math.max(0, Number(elm.h)||0);
  switch (elm.type) {
    case 'rect':
      shape = el('rect', { x: 0, y: 0, width: w, height: h, rx: elm.rx ?? 0, ry: elm.ry ?? 0, ...common }); break;
    case 'ellipse':
      shape = el('ellipse', { cx: w/2, cy: h/2, rx: w/2, ry: h/2, ...common }); break;
    case 'line':
      shape = el('line', { x1: elm.flipX ? w : 0, y1: elm.flipY ? h : 0, x2: elm.flipX ? 0 : w, y2: elm.flipY ? 0 : h, ...common, fill: 'none' }); break;
    case 'path':
      shape = el('path', { d: elm.d || '', ...common, fill: elm.closed ? (elm.fill ?? 'none') : 'none' }); break;
    case 'polygon':
      shape = el('polygon', { points: elm.points || `0,0 ${w},0 ${w},${h}`, ...common }); break;
    case 'text': {
      shape = el('text', { x: 0, y: Math.max(Number(elm.fontSize)||32, 1), fill: elm.fill || '#222222', stroke: elm.stroke ?? 'none', 'stroke-width': elm.strokeWidth ?? 0,
        'font-family': elm.fontFamily || 'Inter, Arial, sans-serif', 'font-size': elm.fontSize || 32, 'font-weight': elm.fontWeight || 400,
        'font-style': elm.fontStyle || 'normal', 'text-anchor': elm.textAnchor || 'start', 'letter-spacing': elm.letterSpacing || 0,
        'dominant-baseline': 'alphabetic', opacity: elm.opacity ?? 1 });
      const lines = String(elm.text ?? 'Text').split('\n');
      lines.forEach((line, index) => { const span = el('tspan', { x: 0, dy: index === 0 ? 0 : (Number(elm.fontSize) || 32) * 1.2 }); span.textContent = line; shape.appendChild(span); });
      if (elm.textPath) {
        // Text-on-path is intentionally not synthesized unless the path relationship is present in the model.
        shape.setAttribute('aria-label', 'Text object');
      }
      break;
    }
    default: shape = el('rect', { x:0,y:0,width:w,height:h,fill:'none',stroke:'#ff5252','stroke-width':2 });
  }
  g.appendChild(shape);
  return g;
}

function drawPreview3d(host, elm) {
  // Lightweight preview: offset translucent copies behind the actual object; the source object remains untouched.
  const depth = Math.max(2, Math.min(10, Math.round(Number(elm.depth) || 6)));
  for (let i = depth; i >= 1; i--) {
    const copy = buildObject({ ...elm, id: `${elm.id}-depth-${i}`, name: '', x: Number(elm.x)||0, y: (Number(elm.y)||0) + (Number(elm.ty)||0) + i*1.8, tx: Number(elm.tx)||0, ty:0,
      fill: elm.extrudeColor || '#6c5b80', stroke: elm.extrudeColor || '#6c5b80', strokeWidth: elm.strokeWidth, opacity: .38, rotation: Number(elm.rotation)||0 });
    copy.removeAttribute('data-object-id'); copy.setAttribute('pointer-events','none'); host.appendChild(copy);
  }
}

export function renderDocument(doc, { artworkLayer, selectionLayer, interactionLayer, boardBackground, gridLayer, selectedIds = [], grid = false, preview3d = false, mockup = false, viewBox = null, tool = 'select' }) {
  boardBackground.setAttribute('width', doc.width); boardBackground.setAttribute('height', doc.height); boardBackground.setAttribute('fill', doc.background || '#ffffff');
  gridLayer.setAttribute('width', doc.width); gridLayer.setAttribute('height', doc.height);
  const oldPattern = gridLayer.ownerSVGElement?.querySelector('#gridPattern');
  if (oldPattern) { oldPattern.firstElementChild?.setAttribute('d', `M ${Math.max(1, gridLayer.ownerSVGElement.viewBox.baseVal.width/60)} 0 L 0 0 0 ${Math.max(1, gridLayer.ownerSVGElement.viewBox.baseVal.width/60)}`); }
  gridLayer.classList.toggle('visible', !!grid);
  if (viewBox) artworkLayer.ownerSVGElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  artworkLayer.replaceChildren(); selectionLayer.replaceChildren(); interactionLayer.replaceChildren();
  const hiddenLayerIds = new Set((doc.layers || []).filter(l => !l.visible).map(l => l.id));
  for (const item of doc.elements) {
    if (hiddenLayerIds.has(item.layer) || item.visible === false) continue;
    if (preview3d) drawPreview3d(artworkLayer, item);
    artworkLayer.appendChild(buildObject(item));
  }
  const selected = doc.elements.filter(item => selectedIds.includes(item.id) && !hiddenLayerIds.has(item.layer));
  if (selected.length) {
    const boxes = selected.map(elementBounds);
    const minX = Math.min(...boxes.map(b=>b.x)), minY = Math.min(...boxes.map(b=>b.y));
    const maxX = Math.max(...boxes.map(b=>b.right)), maxY = Math.max(...boxes.map(b=>b.bottom));
    const padding = 4;
    selectionLayer.appendChild(el('rect', { x:minX-padding,y:minY-padding,width:Math.max(1,maxX-minX+padding*2),height:Math.max(1,maxY-minY+padding*2),class:'selection-box' }));
    if (selected.length === 1) {
      const points = [
        ['nw',minX-padding,minY-padding],['n',(minX+maxX)/2,minY-padding],['ne',maxX+padding,minY-padding],
        ['e',maxX+padding,(minY+maxY)/2],['se',maxX+padding,maxY+padding],['s',(minX+maxX)/2,maxY+padding],
        ['sw',minX-padding,maxY+padding],['w',minX-padding,(minY+maxY)/2]
      ];
      for (const [handle,x,y] of points) selectionLayer.appendChild(el('rect',{x:x-3.5,y:y-3.5,width:7,height:7,rx:1,class:'selection-handle','data-handle':handle,'pointer-events':'all'}));
    }
  }
  if (selected.length === 1 && tool === 'node') {
    const item = selected[0];
    if (item.type === 'path' && Array.isArray(item.pathPoints)) {
      for (let i=0;i<item.pathPoints.length;i++) {
        const p=item.pathPoints[i];
        selectionLayer.appendChild(el('circle',{cx:(Number(item.x)||0)+(Number(item.tx)||0)+p.x*(Number(item.scaleX)||1),cy:(Number(item.y)||0)+(Number(item.ty)||0)+p.y*(Number(item.scaleY)||1),r:4,class:'selection-handle','data-node-id':item.id,'data-node-index':i,'pointer-events':'all'}));
      }
    }
  }
  if (mockup) {
    // Rendered by the UI's CSS presentation; the document artwork stays unchanged.
    artworkLayer.ownerSVGElement.classList.add('mockup-preview');
  } else artworkLayer.ownerSVGElement.classList.remove('mockup-preview');
}

export function elementToMarkup(elm) {
  const safe = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const x = (Number(elm.x)||0)+(Number(elm.tx)||0), y = (Number(elm.y)||0)+(Number(elm.ty)||0), w = Number(elm.w)||0, h = Number(elm.h)||0;
  const trans = `translate(${x} ${y}) rotate(${Number(elm.rotation)||0} ${w/2} ${h/2}) scale(${Math.max(.001,Number(elm.scaleX)||1)} ${Math.max(.001,Number(elm.scaleY)||1)})`;
  const common = `fill="${safe(elm.fill ?? 'none')}" stroke="${safe(elm.stroke ?? 'none')}" stroke-width="${Number(elm.strokeWidth)||0}" opacity="${Number(elm.opacity ?? 1)}" stroke-linejoin="${safe(elm.linejoin||'round')}" stroke-linecap="${safe(elm.linecap||'round')}"`;
  let shape = '';
  if (elm.type === 'rect') shape = `<rect x="0" y="0" width="${w}" height="${h}" rx="${Number(elm.rx)||0}" ry="${Number(elm.ry)||0}" ${common}/>`;
  else if (elm.type === 'ellipse') shape = `<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" ${common}/>`;
  else if (elm.type === 'line') shape = `<line x1="${elm.flipX?w:0}" y1="${elm.flipY?h:0}" x2="${elm.flipX?0:w}" y2="${elm.flipY?0:h}" fill="none" stroke="${safe(elm.stroke||'#222')}" stroke-width="${Number(elm.strokeWidth)||2}" opacity="${Number(elm.opacity??1)}"/>`;
  else if (elm.type === 'path') shape = `<path d="${safe(elm.d||'')}" ${common}/>`;
  else if (elm.type === 'polygon') shape = `<polygon points="${safe(elm.points||'')}" ${common}/>`;
  else if (elm.type === 'text') { const fs=Number(elm.fontSize)||32; const lines=String(elm.text||'Text').split('\n'); const spans=lines.map((line,i)=>`<tspan x="0" dy="${i===0?0:fs*1.2}">${safe(line)}</tspan>`).join(''); shape = `<text x="0" y="${Math.max(fs,1)}" fill="${safe(elm.fill||'#222')}" font-family="${safe(elm.fontFamily||'Inter, Arial, sans-serif')}" font-size="${fs}" font-weight="${safe(elm.fontWeight||400)}" font-style="${safe(elm.fontStyle||'normal')}" text-anchor="${safe(elm.textAnchor||'start')}" letter-spacing="${Number(elm.letterSpacing)||0}" opacity="${Number(elm.opacity??1)}">${spans}</text>`; }
  return `<g id="${safe(elm.id)}" data-name="${safe(elm.name||elm.type)}" transform="${trans}">${shape}</g>`;
}

export function documentToSVG(doc, { transparent = false } = {}) {
  const bg = transparent ? '' : `<rect width="${Number(doc.width)}" height="${Number(doc.height)}" fill="${normalizeHex(doc.background||'#ffffff')}"/>`;
  const hidden = new Set((doc.layers||[]).filter(l=>!l.visible).map(l=>l.id));
  const body = (doc.elements||[]).filter(e=>e.visible!==false && !hidden.has(e.layer)).map(elementToMarkup).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Number(doc.width)}px" height="${Number(doc.height)}px" viewBox="0 0 ${Number(doc.width)} ${Number(doc.height)}" role="img" aria-label="VEXORA vector artwork">${bg}\n${body}\n</svg>`;
}
