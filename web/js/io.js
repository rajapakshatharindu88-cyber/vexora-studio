import { createElement, validateDocument, deepClone, uid } from './model.js';
import { documentToSVG } from './renderer.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function saveProject(doc) {
  doc.updatedAt = new Date().toISOString();
  const text = JSON.stringify(doc, null, 2);
  downloadBlob(new Blob([text], { type: 'application/vnd.vexora.project+json;charset=utf-8' }), `${safeBaseName(doc.name)}.vex`);
}

export function exportSVG(doc, options = {}) {
  downloadBlob(new Blob([documentToSVG(doc, options)], { type: 'image/svg+xml;charset=utf-8' }), `${safeBaseName(doc.name)}.svg`);
}

export async function exportPNG(doc, { scale = 1, transparent = false } = {}) {
  if (!Number.isFinite(scale) || scale < .1 || scale > 8) throw new Error('PNG scale must be between 0.1× and 8×.');
  const svg = documentToSVG(doc, { transparent });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('SVG could not be rasterized. Try simplifying the document.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(doc.width * scale)); canvas.height = Math.max(1, Math.round(doc.height * scale));
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas rendering is unavailable in this environment.');
    if (!transparent) { ctx.fillStyle = doc.background || '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png'));
    downloadBlob(png, `${safeBaseName(doc.name)}${scale !== 1 ? `-${scale}x` : ''}.png`);
  } finally { URL.revokeObjectURL(url); }
}

export function safeBaseName(name) {
  const value = String(name || 'VEXORA-Design').normalize('NFKC').replace(/[^a-zA-Z0-9 _.-]/g, '').trim().replace(/[ .]+/g, '-').replace(/-+/g, '-');
  return (value || 'VEXORA-Design').slice(0, 80);
}

function parseColor(elm, style, key) { return elm.getAttribute(key) || style[key] || ({ fill: '#c8a0f3', stroke: 'none', 'stroke-width': '0' }[key]); }
function parseStyle(elm) {
  const out = {};
  const raw = elm.getAttribute('style') || '';
  for (const decl of raw.split(';')) { const ix = decl.indexOf(':'); if (ix > 0) out[decl.slice(0, ix).trim()] = decl.slice(ix + 1).trim(); }
  return out;
}
function numAttr(elm, key, fallback = 0) { const v = parseFloat(elm.getAttribute(key)); return Number.isFinite(v) ? v : fallback; }

export function importSVGText(svgText, name = 'Imported SVG') {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svgText, 'image/svg+xml');
  const error = parsed.querySelector('parsererror');
  if (error || parsed.documentElement.localName !== 'svg') throw new Error('This SVG file could not be parsed.');
  const root = parsed.documentElement;
  const viewBox = (root.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
  const width = Math.min(100000, Math.max(1, parseFloat(root.getAttribute('width')) || (viewBox.length === 4 ? viewBox[2] : 1200)));
  const height = Math.min(100000, Math.max(1, parseFloat(root.getAttribute('height')) || (viewBox.length === 4 ? viewBox[3] : 800)));
  const doc = { schema:'vexora-document', version:1, name: name.replace(/\.svg$/i,''), width, height, background:'#ffffff', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    layers:[{id:'layer-artwork',name:'Imported Artwork',visible:true,locked:false}], elements:[], metadata:{units:'px',bleed:0,colorSpace:'RGB',profile:'sRGB',importedFrom:'SVG'} };
  const accepted = new Set(['rect','ellipse','circle','line','path','polygon','polyline','text']);
  let index = 0;
  for (const node of root.querySelectorAll('rect,ellipse,circle,line,path,polygon,polyline,text')) {
    if (node.closest('defs,clipPath,mask,pattern,marker,filter,symbol')) continue;
    const type = node.localName;
    if (!accepted.has(type)) continue;
    const style = parseStyle(node);
    let x = numAttr(node,'x'), y = numAttr(node,'y'), w = numAttr(node,'width'), h = numAttr(node,'height');
    if (type === 'circle') { const r = numAttr(node,'r'); x = numAttr(node,'cx') - r; y = numAttr(node,'cy') - r; w = h = 2*r; }
    if (type === 'ellipse') { const rx = numAttr(node,'rx'), ry = numAttr(node,'ry'); x = numAttr(node,'cx')-rx; y=numAttr(node,'cy')-ry; w=2*rx; h=2*ry; }
    if (type === 'line') { const x1=numAttr(node,'x1'),y1=numAttr(node,'y1'),x2=numAttr(node,'x2'),y2=numAttr(node,'y2'); x=Math.min(x1,x2);y=Math.min(y1,y2);w=Math.abs(x2-x1);h=Math.abs(y2-y1); }
    let normalizedPointString = node.getAttribute('points') || '';
    let localPolylinePath = '';
    if (type === 'polygon' || type === 'polyline') {
      const values = normalizedPointString.trim().split(/[ ,]+/).map(Number).filter(Number.isFinite);
      const coords=[]; for(let i=0;i+1<values.length;i+=2)coords.push({x:values[i],y:values[i+1]});
      if(coords.length){
        const minX=Math.min(...coords.map(p=>p.x)),minY=Math.min(...coords.map(p=>p.y)),maxX=Math.max(...coords.map(p=>p.x)),maxY=Math.max(...coords.map(p=>p.y));
        x=minX;y=minY;w=Math.max(1,maxX-minX);h=Math.max(1,maxY-minY);
        const local=coords.map(p=>({x:p.x-minX,y:p.y-minY}));
        normalizedPointString=local.map(p=>`${p.x},${p.y}`).join(' ');
        localPolylinePath=local.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')+(type==='polygon'?' Z':'');
      }
    }
    if (type === 'text') { x=numAttr(node,'x'); y=numAttr(node,'y'); w=Math.max(80,(node.textContent||'Text').length*(numAttr(node,'font-size',24)*.65)); h=numAttr(node,'font-size',24)*1.3; }
    let shapeType = ['rect','ellipse','line','path','polygon','text'].includes(type) ? type : 'path';
    if (type === 'polyline') shapeType='path';
    const e = createElement(shapeType, { id:uid('import'), name:node.getAttribute('id') || `${type[0].toUpperCase()}${type.slice(1)} ${++index}`, x, y, w:Math.max(1,w), h:Math.max(1,h), layer:'layer-artwork',
      fill: parseColor(node,style,'fill'), stroke:parseColor(node,style,'stroke'), strokeWidth:numAttr(node,'stroke-width',parseFloat(style['stroke-width'])||0), opacity:numAttr(node,'opacity',parseFloat(style.opacity)||1),
      rotation:0, tx:0, ty:0 });
    if (shapeType === 'path') {
      if(type==='polyline' || type==='polygon') { e.d=localPolylinePath; e.closed=type==='polygon'; }
      else { e.d=node.getAttribute('d') || ''; e.closed=/z\s*$/i.test(e.d); e.x=0;e.y=0;e.w=width;e.h=height; }
    }
    if (shapeType === 'polygon') e.points = normalizedPointString;
    if(type==='line'){e.flipX=numAttr(node,'x2')<numAttr(node,'x1');e.flipY=numAttr(node,'y2')<numAttr(node,'y1');}
    if(type==='rect'){e.rx=numAttr(node,'rx');e.ry=numAttr(node,'ry');}
    if (shapeType === 'text') { e.text = node.textContent || ''; e.fontSize=numAttr(node,'font-size',parseFloat(style['font-size'])||24);e.fontFamily=node.getAttribute('font-family')||style['font-family']||'Arial, sans-serif';e.fontWeight=node.getAttribute('font-weight')||style['font-weight']||400;e.textAnchor=node.getAttribute('text-anchor')||'start'; e.fill=parseColor(node,style,'fill')||'#222222'; }
    const transform=node.getAttribute('transform')||'';
    const tr=transform.match(/translate\(\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?\s*\)/i); if(tr){e.tx=Number(tr[1])||0;e.ty=Number(tr[2])||0;}
    const rot=transform.match(/rotate\(\s*(-?[\d.]+)/i); if(rot) e.rotation=Number(rot[1])||0;
    doc.elements.push(e);
  }
  validateDocument(doc);
  return doc;
}

export function loadProjectText(text, filename = 'Opened Design') {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return importSVGText(text, filename); }
  validateDocument(parsed);
  parsed.name = String(parsed.name || filename.replace(/\.(vex|json)$/i,''));
  parsed.layers ||= [{id:'layer-artwork',name:'Artwork',visible:true,locked:false}];
  parsed.metadata ||= { units:'px', bleed:0, colorSpace:'RGB', profile:'sRGB' };
  return deepClone(parsed);
}
