import { createDocument, createElement, deepClone, elementBounds, validateDocument, uid } from './model.js';
import { renderDocument } from './renderer.js';
import { saveProject, exportSVG, exportPNG, loadProjectText, downloadBlob, safeBaseName } from './io.js';
import { FEATURE_CATALOG, STARTER_PALETTES, analyzeDocument, cleanupDocument, makeQuickLayout, applyNaturalCommand, alignSelection, exportResponsiveVariant, generateDieline, makeContrastReport, saveBrandPalette, checkBrandPalette, contrastRatio, chooseReadableText } from './features.js';

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const svg=$('#designSvg'), artworkLayer=$('#artworkLayer'), selectionLayer=$('#selectionLayer'), interactionLayer=$('#interactionLayer'), boardBackground=$('#boardBackground'), gridLayer=$('#gridLayer');
const state={
  doc:createDocument(), tool:'select', selectedIds:[], fill:'#c8a0f3', stroke:'#342b41', strokeWidth:2,
  zoom:1, panX:0, panY:0, viewBox:{x:0,y:0,w:1200,h:800}, grid:false, snap:false, preview3d:false, mockup:false, theme:'dark', inspector:'design',
  studioPanel:'assistant', studioOpen:true, studioCollapsed:false, dirty:false, dragging:null, spaceDown:false,
  undoStack:[],redoStack:[],snapshots:[], lastSavedAt:null, nameSequence:1, drawPoints:[], clipboard:null
};
const DRAFT_KEY='vexora-autorecovery-v1';

function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function toast(message,type=''){const node=document.createElement('div');node.className=`toast ${type}`;node.textContent=message;$('#toastRegion').appendChild(node);setTimeout(()=>node.remove(),3500);}
function markDirty(){state.dirty=true;$('#dirtyMark').hidden=false;$('#saveStatus').textContent='Unsaved changes · local';state.doc.updatedAt=new Date().toISOString();clearTimeout(markDirty.timer);markDirty.timer=setTimeout(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({doc:state.doc,savedAt:new Date().toISOString()}));}catch{}},350);}
function commitUndo(){state.undoStack.push(JSON.stringify(state.doc));if(state.undoStack.length>60)state.undoStack.shift();state.redoStack.length=0;}
function undo(){if(!state.undoStack.length){toast('Nothing to undo.');return;}state.redoStack.push(JSON.stringify(state.doc));state.doc=JSON.parse(state.undoStack.pop());state.selectedIds=state.selectedIds.filter(id=>state.doc.elements.some(e=>e.id===id));markDirty();drawAll();toast('Undo complete.');}
function redo(){if(!state.redoStack.length){toast('Nothing to redo.');return;}state.undoStack.push(JSON.stringify(state.doc));state.doc=JSON.parse(state.redoStack.pop());markDirty();drawAll();toast('Redo complete.');}
function findObject(id){return state.doc.elements.find(e=>e.id===id);}
function selectedObjects(){return state.doc.elements.filter(e=>state.selectedIds.includes(e.id));}
function setSelection(ids){state.selectedIds=[...new Set(ids)].filter(id=>state.doc.elements.some(e=>e.id===id));}
function getViewBox(){const w=state.doc.width/state.zoom,h=state.doc.height/state.zoom;return {x:(state.doc.width-w)/2+state.panX,y:(state.doc.height-h)/2+state.panY,w,h};}
function renderCanvas(){
  state.viewBox=getViewBox();
  svg.setAttribute('viewBox',`${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.w} ${state.viewBox.h}`);
  $('#canvasBoardWrap').style.aspectRatio=`${state.doc.width}/${state.doc.height}`;
  $('#canvasBoardWrap').style.maxWidth='min(92%, 1000px)';
  $('#zoomValue').textContent=`${Math.round(state.zoom*100)}%`;
  $('#documentSize').textContent=`${Math.round(state.doc.width)} × ${Math.round(state.doc.height)} px`;
  $('#gridButton').classList.toggle('active',state.grid);$('#snapButton').classList.toggle('active',state.snap);
  renderDocument(state.doc,{artworkLayer,selectionLayer,interactionLayer,boardBackground,gridLayer,selectedIds:state.selectedIds,grid:state.grid,preview3d:state.preview3d,mockup:state.mockup,viewBox:state.viewBox,tool:state.tool});
  $('#canvasBoardWrap').classList.toggle('mockup-mode', state.mockup);
  $('#emptyHint').classList.toggle('visible',state.doc.elements.length===0);
  $('#selectionCount').textContent=state.selectedIds.length?`${state.selectedIds.length} selected`:'No selection';
  $('#documentName').textContent=state.doc.name;$('#activeTab').firstChild.textContent=state.doc.name;$('#dirtyMark').hidden=!state.dirty;
  $('#fillChip span').style.background=state.fill;$('#strokeChip span').style.borderColor=state.stroke;
  $('#toolHint').textContent=toolHint(state.tool);
}
function toolHint(tool){return ({select:'Selection · Drag an object to move it; Shift-click to add to selection',node:'Direct selection · Select an object, then edit its geometry in the inspector',pen:'Pen · Drag to draw a freeform vector path',pencil:'Pencil · Draw a freehand vector path',rect:'Rectangle · Drag to create a rectangle',ellipse:'Ellipse · Drag to create an ellipse',line:'Line · Drag to create a line',text:'Text · Click the canvas to add text',eyedropper:'Eyedropper · Click an object to sample its fill color'})[tool]||'VEXORA';}
function renderInspector(){
  $$('.inspector-tab').forEach(b=>b.classList.toggle('active',b.dataset.inspector===state.inspector));
  const host=$('#inspectorContent');
  if(state.inspector==='layers'){host.innerHTML=renderLayers();return;}
  if(state.inspector==='assets'){host.innerHTML=renderAssets();return;}
  const sel=selectedObjects();
  if(sel.length===1){host.innerHTML=renderObjectInspector(sel[0]);return;}
  if(sel.length>1){host.innerHTML=renderMultiInspector(sel.length);return;}
  host.innerHTML=`
  <section class="section"><div class="section-head"><h3>ARTBOARD</h3><span>Canvas settings</span></div>
    <div class="field-grid">
      <div class="field"><label>Width (px)</label><input type="number" min="1" max="100000" data-docprop="width" value="${state.doc.width}"></div>
      <div class="field"><label>Height (px)</label><input type="number" min="1" max="100000" data-docprop="height" value="${state.doc.height}"></div>
      <div class="field full"><label>Background</label><div class="color-line"><span class="color-preview" style="background:${esc(state.doc.background)}"></span><input type="color" data-docprop="background" value="${esc(state.doc.background)}"></div></div>
      <div class="field"><label>Bleed (px)</label><input type="number" min="0" max="1000" data-docprop="bleed" value="${Number(state.doc.metadata?.bleed)||0}"></div>
      <div class="field"><label>Color space</label><select data-docprop="colorSpace"><option ${state.doc.metadata?.colorSpace==='RGB'?'selected':''}>RGB</option><option ${state.doc.metadata?.colorSpace==='CMYK'?'selected':''}>CMYK</option></select></div>
      <div class="field full"><label>Document name</label><input data-docprop="name" value="${esc(state.doc.name)}" maxlength="100"></div>
    </div>
  </section>
  <section class="section"><div class="section-head"><h3>APPEARANCE DEFAULTS</h3><span>New objects</span></div>
    <div class="field-grid"><div class="field"><label>Fill</label><input type="color" data-defaultprop="fill" value="${esc(state.fill)}"></div><div class="field"><label>Stroke</label><input type="color" data-defaultprop="stroke" value="${esc(state.stroke)}"></div><div class="field"><label>Stroke width</label><input type="number" data-defaultprop="strokeWidth" min="0" max="200" step="0.5" value="${state.strokeWidth}"></div></div>
  </section>
  <section class="section"><div class="section-head"><h3>QUICK ACTIONS</h3></div><div class="action-row"><button class="panel-button" data-action="quick-layout">Starter layout</button><button class="panel-button" data-action="add-text">Add text</button></div><p class="muted">VEXORA uses an offline-first vector document. Changes stay on this device unless you export or save them elsewhere.</p></section>`;
}
function renderObjectInspector(e){
  const isText=e.type==='text';
  return `<section class="section"><div class="section-head"><h3>SELECTION</h3><span class="pill">${esc(e.type.toUpperCase())}</span></div>
    <div class="field full"><label>Object name</label><input data-prop="name" value="${esc(e.name)}" maxlength="120"></div>
    <div class="field-grid" style="margin-top:10px"><div class="field"><label>X</label><input type="number" step="1" data-prop="x" value="${Math.round((Number(e.x)||0)+(Number(e.tx)||0))}"></div><div class="field"><label>Y</label><input type="number" step="1" data-prop="y" value="${Math.round((Number(e.y)||0)+(Number(e.ty)||0))}"></div><div class="field"><label>Width</label><input type="number" min="1" step="1" data-prop="w" value="${Math.round(elementBounds(e).w||1)}"></div><div class="field"><label>Height</label><input type="number" min="1" step="1" data-prop="h" value="${Math.round(elementBounds(e).h||1)}"></div><div class="field"><label>Rotation (°)</label><input type="number" min="-360" max="360" data-prop="rotation" value="${Number(e.rotation)||0}"></div><div class="field"><label>Opacity (%)</label><input type="number" min="0" max="100" data-prop="opacityPercent" value="${Math.round((Number(e.opacity??1))*100)}"></div></div>
  </section>
  ${isText?`<section class="section"><div class="section-head"><h3>TYPOGRAPHY</h3></div><div class="field full"><label>Text content (Sinhala / Unicode supported)</label><textarea data-prop="text" rows="3" maxlength="2000">${esc(e.text||'')}</textarea></div><div class="field-grid" style="margin-top:9px"><div class="field"><label>Font family</label><input data-prop="fontFamily" value="${esc(e.fontFamily||'Inter, Arial, sans-serif')}"></div><div class="field"><label>Size (px)</label><input type="number" min="1" max="500" data-prop="fontSize" value="${Number(e.fontSize)||32}"></div><div class="field"><label>Weight</label><select data-prop="fontWeight"><option value="400" ${String(e.fontWeight)==='400'?'selected':''}>Regular</option><option value="500" ${String(e.fontWeight)==='500'?'selected':''}>Medium</option><option value="600" ${String(e.fontWeight)==='600'?'selected':''}>Semibold</option><option value="700" ${String(e.fontWeight)==='700'?'selected':''}>Bold</option></select></div><div class="field"><label>Letter spacing</label><input type="number" step="0.5" data-prop="letterSpacing" value="${Number(e.letterSpacing)||0}"></div></div></section>`:''}
  <section class="section"><div class="section-head"><h3>FILL & STROKE</h3></div><div class="field-grid"><div class="field"><label>Fill</label><input type="color" data-prop="fill" value="${colorInput(e.fill)}"></div><div class="field"><label>Stroke</label><input type="color" data-prop="stroke" value="${colorInput(e.stroke)}"></div><div class="field"><label>Stroke width</label><input type="number" min="0" max="200" step="0.5" data-prop="strokeWidth" value="${Number(e.strokeWidth)||0}"></div><div class="field"><label>Layer</label><select data-prop="layer">${state.doc.layers.map(l=>`<option value="${esc(l.id)}" ${l.id===e.layer?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div></div>
    <div class="action-row" style="margin-top:12px"><button class="panel-button" data-action="duplicate">Duplicate</button><button class="panel-button" data-action="front">Bring forward</button><button class="panel-button danger" data-action="delete">Delete</button></div>
  </section>`;
}
function colorInput(v){return /^#[0-9a-f]{6}$/i.test(v||'')?v:'#000000';}
function renderMultiInspector(count){return `<div class="empty-state"><div class="big">⊞</div><strong>${count} objects selected</strong><p>Use alignment controls in Smart Studio or apply a shared color.</p><div class="field"><label>Shared fill color</label><input type="color" data-multi-prop="fill" value="${esc(state.fill)}"></div><div class="action-row" style="margin-top:12px"><button class="panel-button" data-action="duplicate">Duplicate</button><button class="panel-button danger" data-action="delete">Delete selected</button></div></div>`;}
function renderLayers(){return `<section class="section"><div class="section-head"><h3>DOCUMENT LAYERS</h3><button class="panel-button" data-action="new-layer">+ Layer</button></div><div class="layer-list">${state.doc.layers.map(l=>`<div class="layer-item ${state.selectedIds.some(id=>findObject(id)?.layer===l.id)?'selected':''}"><button class="icon-button" data-layer-action="visibility" data-layer-id="${esc(l.id)}" title="Toggle visibility">${l.visible?'◉':'○'}</button><span class="layer-title" data-layer-select="${esc(l.id)}">${esc(l.name)}</span><button class="icon-button" data-layer-action="lock" data-layer-id="${esc(l.id)}" title="Toggle lock">${l.locked?'▣':'□'}</button></div>`).join('')}</div></section><section class="section"><div class="section-head"><h3>OBJECTS</h3><span>${state.doc.elements.length}</span></div><div class="layer-list">${[...state.doc.elements].reverse().map(e=>`<div class="layer-item ${state.selectedIds.includes(e.id)?'selected':''}" data-select-object="${esc(e.id)}"><span class="layer-thumb">${({rect:'▱',ellipse:'◯',line:'／',path:'⌁',polygon:'◇',text:'T'})[e.type]||'◇'}</span><span class="layer-title">${esc(e.name)}</span><span class="layer-meta">${esc(e.type)}</span></div>`).join('')||'<p class="muted">No objects yet. Use the drawing tools to create your first object.</p>'}</div></section><p class="muted">Tip: use Shift-click to select multiple canvas objects. Layer order follows the object stack.</p>`;}
function renderAssets(){const saved=state.doc.metadata?.brandPalette;return `<section class="section"><div class="section-head"><h3>COLOR LIBRARY</h3><span>Offline</span></div>${STARTER_PALETTES.map(p=>`<div style="margin-bottom:12px"><div class="field-row" style="margin-bottom:6px"><span class="muted">${esc(p.name)}</span><button class="panel-button" data-save-palette="${esc(p.name)}">Save brand</button></div><div style="display:flex;gap:4px">${p.colors.map(c=>`<button data-color="${c}" title="${c}" style="height:27px;flex:1;border:1px solid #ffffff22;background:${c};border-radius:5px"></button>`).join('')}</div></div>`).join('')}</section>${saved?`<section class="section"><div class="section-head"><h3>SAVED BRAND · ${esc(saved.name)}</h3><span>${saved.colors.length} colors</span></div><div style="display:flex;gap:4px">${saved.colors.map(c=>`<button data-color="${c}" title="${c}" style="height:28px;flex:1;border:1px solid #ffffff22;background:${c};border-radius:5px"></button>`).join('')}</div><button class="panel-button" style="width:100%;margin-top:8px" data-action="brand-check">Check consistency</button></section>`:''}<section class="section"><div class="section-head"><h3>REUSABLE ASSETS</h3></div><p class="muted">Symbol libraries and font installation checks are planned extensions. The current palette library is saved with the project.</p></section>`;}
function renderAllStudio(){
  $('#studioTitle').textContent=({assistant:'Smart Studio',preflight:'Print Check',history:'Design History'}[state.studioPanel]||'Smart Studio');
  $('#studioPanel').classList.toggle('closed',!state.studioOpen);$('#studioPanel').classList.toggle('collapsed',state.studioCollapsed);
  $$('.dock-item').forEach(b=>b.classList.toggle('active',b.dataset.panel===state.studioPanel));
  const body=$('#studioBody');
  if(state.studioPanel==='assistant') body.innerHTML=renderAssistantStudio();
  else if(state.studioPanel==='preflight') body.innerHTML=renderPreflightStudio();
  else body.innerHTML=renderHistoryStudio();
}
function renderAssistantStudio(){return `<div class="prompt-box"><label for="assistantPrompt">Describe a vector design or ask for a smart action</label><textarea id="assistantPrompt" placeholder="e.g. Create a maroon and gold business card with headline text…"></textarea><div class="action-row"><button class="panel-button accent" id="runAssistant">Run offline assistant ↗</button><button class="panel-button" id="quickLayoutButton">Starter layout</button></div><p class="muted">No paid API, no account, no online model. This first version uses transparent, rule-based commands—not a generative AI model.</p><div id="assistantResult" class="muted"></div></div><div><div class="section-head"><h3>SMART TOOLS</h3><span>12 feature areas</span></div><div class="feature-grid">${FEATURE_CATALOG.map(f=>`<button class="feature-card" data-feature="${f.id}"><span class="symbol">${f.icon}</span><strong>${esc(f.title)}</strong><small>${esc(f.summary)}</small></button>`).join('')}</div></div>`;}
function renderPreflightStudio(){const findings=analyzeDocument(state.doc);return `<div><div class="section-head"><h3>DOCUMENT CHECKS</h3><span>${findings.filter(f=>f.level==='warning').length} warnings</span></div><p class="muted">Automated checks help you find issues; they do not certify final print output.</p><div class="action-row" style="margin-bottom:10px"><button class="panel-button" data-action="set-bleed">Set 3 mm bleed (≈11.34 px)</button><button class="panel-button" data-action="color-rgb">Set RGB profile</button><button class="panel-button accent" data-action="export-report">Export report</button></div></div><div class="report-list">${findings.map(f=>`<div class="report-item"><span class="report-dot ${f.level==='good'?'good':''}" style="${f.level==='info'?'background:#77bce8':''}"></span><div><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p></div></div>`).join('')}</div>`;}
function renderHistoryStudio(){return `<div><div class="section-head"><h3>DOCUMENT SNAPSHOTS</h3><button class="panel-button accent" data-action="snapshot">+ Save snapshot</button></div><p class="muted">Snapshots are stored in memory for this session and included only if you save them through the project workflow later. Undo/redo history is session-local.</p><div class="report-list">${state.snapshots.map((s,i)=>`<div class="report-item"><span class="report-dot good"></span><div style="flex:1"><strong>${esc(s.name)}</strong><p>${new Date(s.at).toLocaleString()} · ${s.count} objects</p></div><button class="panel-button" data-restore-snapshot="${i}">Restore</button></div>`).join('')||'<div class="empty-state">No named snapshots yet.</div>'}</div><div class="section" style="margin-top:12px"><div class="section-head"><h3>UNDO / REDO</h3></div><div class="action-row"><button class="panel-button" id="studioUndo">Undo</button><button class="panel-button" id="studioRedo">Redo</button></div></div></div><div class="muted">For crash recovery, VEXORA stores a local recovery copy in browser storage while this app is running. Use Save to export a portable .vex file.</div>`;}
function drawAll(){renderCanvas();renderInspector();renderAllStudio();}
function renderObjectPreview(elm){ // Render only a preview object without touching the saved document.
  interactionLayer.replaceChildren();const node=document.createElementNS('http://www.w3.org/2000/svg','g');
  const x=(Number(elm.x)||0), y=(Number(elm.y)||0), w=Number(elm.w)||1,h=Number(elm.h)||1;
  node.setAttribute('transform',`translate(${x} ${y})`);node.setAttribute('opacity','.65');node.setAttribute('pointer-events','none');
  let s;if(elm.type==='rect'){s=document.createElementNS(svg.namespaceURI,'rect');s.setAttribute('width',w);s.setAttribute('height',h);s.setAttribute('fill',elm.fill);s.setAttribute('stroke',elm.stroke);s.setAttribute('stroke-width',elm.strokeWidth||1);}else if(elm.type==='ellipse'){s=document.createElementNS(svg.namespaceURI,'ellipse');s.setAttribute('cx',w/2);s.setAttribute('cy',h/2);s.setAttribute('rx',w/2);s.setAttribute('ry',h/2);s.setAttribute('fill',elm.fill);s.setAttribute('stroke',elm.stroke);s.setAttribute('stroke-width',elm.strokeWidth||1);}else if(elm.type==='line'){s=document.createElementNS(svg.namespaceURI,'line');s.setAttribute('x1',0);s.setAttribute('y1',0);s.setAttribute('x2',w);s.setAttribute('y2',h);s.setAttribute('stroke',elm.stroke);s.setAttribute('stroke-width',elm.strokeWidth||1);}else if(elm.type==='path'){s=document.createElementNS(svg.namespaceURI,'path');s.setAttribute('d',elm.d||'');s.setAttribute('fill',elm.closed?elm.fill:'none');s.setAttribute('stroke',elm.stroke);s.setAttribute('stroke-width',elm.strokeWidth||1);}if(s)node.appendChild(s);interactionLayer.appendChild(node);
}
function clientToDoc(event){const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};const p=pt.matrixTransform(matrix.inverse());return{x:p.x,y:p.y};}
function snapPoint(p){if(!state.snap)return p;const step=state.grid?20:10;return{x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step};}
function getHitObject(event){return event.target.closest?.('[data-object-id]')?.getAttribute('data-object-id')||null;}
function updatePathDraft(drag){
  const pts=drag.points||[];if(pts.length<2)return;
  let minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxX=Math.max(...pts.map(p=>p.x)),maxY=Math.max(...pts.map(p=>p.y));
  drag.draft.x=minX;drag.draft.y=minY;drag.draft.w=Math.max(1,maxX-minX);drag.draft.h=Math.max(1,maxY-minY);
  // Reduce path payload slightly while retaining corners; no aggressive simplification is performed.
  drag.draft.d=pts.map((p,i)=>`${i?'L':'M'} ${(p.x-minX).toFixed(2)} ${(p.y-minY).toFixed(2)}`).join(' ');
  renderObjectPreview(drag.draft);
}
function svgPointerDown(event){
  if(event.button!==0)return;const pos=snapPoint(clientToDoc(event));$('#cursorPosition').textContent=`X: ${Math.round(pos.x)}  Y: ${Math.round(pos.y)}`;
  const nodeHandle=event.target.closest?.('[data-node-index]');
  if(nodeHandle){const obj=findObject(nodeHandle.dataset.nodeId);if(obj?.type==='path'&&Array.isArray(obj.pathPoints)){commitUndo();state.dragging={mode:'node',id:obj.id,index:Number(nodeHandle.dataset.nodeIndex),base:deepClone(obj),moved:false};svg.setPointerCapture?.(event.pointerId);event.preventDefault();return;}}
  const resizeHandle=event.target.closest?.('[data-handle]');
  if(resizeHandle&&state.selectedIds.length===1){const obj=findObject(state.selectedIds[0]);if(obj){commitUndo();state.dragging={mode:'resize',id:obj.id,handle:resizeHandle.dataset.handle,start:pos,base:deepClone(obj),bounds:elementBounds(obj),moved:false};svg.setPointerCapture?.(event.pointerId);event.preventDefault();return;}}
  if(state.spaceDown){state.dragging={mode:'pan',clientX:event.clientX,clientY:event.clientY,viewBox:{...state.viewBox}};svg.setPointerCapture?.(event.pointerId);event.preventDefault();return;}
  const id=getHitObject(event);const locked=id&&state.doc.layers.find(l=>l.id===findObject(id)?.layer)?.locked;
  if(state.tool==='eyedropper'){
    if(id){const target=findObject(id);if(target.fill&&target.fill!=='none'){state.fill=target.fill;const selected=selectedObjects();if(selected.length){commitUndo();selected.forEach(e=>e.fill=target.fill);markDirty();}drawAll();toast(`Sampled ${target.fill}.`);}else toast('This object has no fill color.');}return;
  }
  if(state.tool==='select'||state.tool==='node'){
    if(id){if(event.shiftKey){state.selectedIds=state.selectedIds.includes(id)?state.selectedIds.filter(v=>v!==id):[...state.selectedIds,id];}else if(!state.selectedIds.includes(id)){state.selectedIds=[id];}
      if(state.tool==='select'&&!locked){commitUndo();state.dragging={mode:'move',start:pos,items:selectedObjects().map(e=>({id:e.id,tx:Number(e.tx)||0,ty:Number(e.ty)||0})),moved:false};}
    }else if(!event.shiftKey){state.selectedIds=[];}
    renderCanvas();renderInspector();return;
  }
  if(state.tool==='text') { openTextDialog(pos.x,pos.y);return; }
  if(['rect','ellipse','line','pen','pencil'].includes(state.tool)){
    commitUndo();
    const type=['pen','pencil'].includes(state.tool)?'path':state.tool;
    const draft=createElement(type,{name:state.tool==='pen'?'Pen Path':state.tool==='pencil'?'Freehand Path':`${state.tool[0].toUpperCase()}${state.tool.slice(1)} ${state.nameSequence++}`,
      x:pos.x,y:pos.y,w:1,h:1,fill:type==='path'||type==='line'?'none':state.fill,stroke:state.stroke,strokeWidth:state.strokeWidth,layer:currentLayerId(),d:'M 0 0',closed:false});
    state.dragging={mode:'draw',tool:state.tool,start:pos,last:pos,draft,points:[pos]};svg.setPointerCapture?.(event.pointerId);renderObjectPreview(draft);event.preventDefault();
  }
}
function currentLayerId(){return state.doc.layers.find(l=>!l.locked&&l.visible)?.id||state.doc.layers[0]?.id||'layer-artwork';}
function svgPointerMove(event){
  const pos=snapPoint(clientToDoc(event));$('#cursorPosition').textContent=`X: ${Math.round(pos.x)}  Y: ${Math.round(pos.y)}`;
  const d=state.dragging;if(!d)return;
  if(d.mode==='pan'){
    const rect=svg.getBoundingClientRect();const dx=(event.clientX-d.clientX)/Math.max(1,rect.width)*d.viewBox.w,dy=(event.clientY-d.clientY)/Math.max(1,rect.height)*d.viewBox.h;
    state.viewBox={...d.viewBox,x:d.viewBox.x-dx,y:d.viewBox.y-dy};state.panX=state.viewBox.x-(state.doc.width-state.viewBox.w)/2;state.panY=state.viewBox.y-(state.doc.height-state.viewBox.h)/2;svg.setAttribute('viewBox',`${state.viewBox.x} ${state.viewBox.y} ${state.viewBox.w} ${state.viewBox.h}`);return;
  }
  if(d.mode==='resize'){
    const e=findObject(d.id);if(!e)return;const b=d.bounds,dx=pos.x-d.start.x,dy=pos.y-d.start.y;let left=b.x,right=b.right,top=b.y,bottom=b.bottom;
    if(d.handle.includes('w'))left=Math.min(b.right-3,b.x+dx);if(d.handle.includes('e'))right=Math.max(b.x+3,b.right+dx);
    if(d.handle.includes('n'))top=Math.min(b.bottom-3,b.y+dy);if(d.handle.includes('s'))bottom=Math.max(b.y+3,b.bottom+dy);
    e.tx=(Number(d.base.tx)||0)+(left-b.x);e.ty=(Number(d.base.ty)||0)+(top-b.y);
    e.scaleX=Math.max(.001,(Number(d.base.scaleX)||1)*(right-left)/Math.max(1,b.w));e.scaleY=Math.max(.001,(Number(d.base.scaleY)||1)*(bottom-top)/Math.max(1,b.h));d.moved=Math.abs(dx)+Math.abs(dy)>.1;renderCanvas();return;
  }
  if(d.mode==='node'){
    const e=findObject(d.id);if(!e||!Array.isArray(e.pathPoints))return;const p=e.pathPoints[d.index];if(!p)return;
    p.x=Math.max(0,Math.min(Number(e.w)||1,(pos.x-(Number(e.x)||0)-(Number(e.tx)||0))/Math.max(.001,Number(e.scaleX)||1)));
    p.y=Math.max(0,Math.min(Number(e.h)||1,(pos.y-(Number(e.y)||0)-(Number(e.ty)||0))/Math.max(.001,Number(e.scaleY)||1)));
    e.d=e.pathPoints.map((q,i)=>`${i?'L':'M'} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ');d.moved=true;renderCanvas();return;
  }
  if(d.mode==='move'){
    const dx=pos.x-d.start.x,dy=pos.y-d.start.y;
    for(const item of d.items){const e=findObject(item.id);if(e){e.tx=item.tx+dx;e.ty=item.ty+dy;}}
    d.moved=Math.abs(dx)+Math.abs(dy)>.1;renderCanvas();return;
  }
  if(d.mode==='draw'){
    d.last=pos;const start=d.start;
    if(d.tool==='pencil'||d.tool==='pen'){
      const last=d.points[d.points.length-1];if(Math.hypot(pos.x-last.x,pos.y-last.y)>2)d.points.push(pos);
      updatePathDraft(d);
    }else{
      const left=Math.min(start.x,pos.x),top=Math.min(start.y,pos.y),w=Math.max(1,Math.abs(pos.x-start.x)),h=Math.max(1,Math.abs(pos.y-start.y));
      d.draft.x=left;d.draft.y=top;d.draft.w=w;d.draft.h=h;d.draft.flipX=pos.x<start.x;d.draft.flipY=pos.y<start.y;
      renderObjectPreview(d.draft);
    }
  }
}
function svgPointerUp(event){
  const d=state.dragging;if(!d)return;
  if(d.mode==='draw'){
    if(d.tool==='pen'||d.tool==='pencil')updatePathDraft(d);
    const el=d.draft;
    if(d.tool==='line'&&(el.w<2&&el.h<2)){interactionLayer.replaceChildren();state.dragging=null;state.undoStack.pop();return;}
    if(['rect','ellipse'].includes(d.tool)&&(el.w<3||el.h<3)){el.w=Math.max(24,el.w);el.h=Math.max(24,el.h);}
    if(el.type==='path'&&d.points.length<2){interactionLayer.replaceChildren();state.dragging=null;state.undoStack.pop();return;}
    if(el.type==='path'){el.closed=false;el.fill='none';el.pathPoints=d.points.map(p=>({x:p.x-el.x,y:p.y-el.y}));}
    state.doc.elements.push(el);state.selectedIds=[el.id];markDirty();interactionLayer.replaceChildren();state.dragging=null;drawAll();
  }else if(d.mode==='move'){
    state.dragging=null;if(d.moved)markDirty();renderCanvas();renderInspector();
  }else if(d.mode==='resize'||d.mode==='node'){
    state.dragging=null;if(d.moved)markDirty();renderCanvas();renderInspector();
  }else if(d.mode==='pan'){state.dragging=null;}
  try{svg.releasePointerCapture(event.pointerId);}catch{}
}
function setTool(tool){state.tool=tool;$$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));renderCanvas();}
function openDialog(title, bodyHtml, options={}){
  $('#dialogTitle').textContent=title;$('#dialogEyebrow').textContent=options.eyebrow||'VEXORA STUDIO';$('#dialogBody').innerHTML=bodyHtml;
  const dialog=$('#genericDialog');if(!dialog.open)dialog.showModal();if(options.onOpen)options.onOpen(dialog);return dialog;
}
function closeDialog(){$('#genericDialog').close();}
function openTextDialog(x=state.doc.width*.2,y=state.doc.height*.2,existing=null){
  openDialog(existing?'Edit text':'Add text',`<div class="field-grid"><div class="field full"><label>Text content · Sinhala and Unicode supported</label><textarea id="textContentInput" rows="4" maxlength="2000" placeholder="Type your text here…">${esc(existing?.text||'Your text')}</textarea></div><div class="field"><label>Font family</label><input id="textFont" value="${esc(existing?.fontFamily||'Inter, Arial, sans-serif')}"></div><div class="field"><label>Font size (px)</label><input id="textSize" type="number" min="1" max="500" value="${Number(existing?.fontSize)||48}"></div><div class="field"><label>Weight</label><select id="textWeight"><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700" selected>Bold</option></select></div><div class="field"><label>Color</label><input id="textColor" type="color" value="${colorInput(existing?.fill||state.fill)}"></div></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Cancel</button><button class="panel-button accent" id="confirmText">${existing?'Apply changes':'Create text'}</button></div>`,{onOpen:()=>{setTimeout(()=>$('#textContentInput')?.focus(),50);}});
  $('#confirmText').onclick=()=>{
    const text=$('#textContentInput').value;if(!text.trim()){toast('Enter some text first.');return;}
    const values={text,fontFamily:$('#textFont').value||'Arial, sans-serif',fontSize:Math.max(1,Number($('#textSize').value)||32),fontWeight:$('#textWeight').value,fill:$('#textColor').value,stroke:'none',strokeWidth:0,w:Math.max(100,text.length*(Number($('#textSize').value)||32)*.62),h:(Number($('#textSize').value)||32)*1.5};
    if(existing){commitUndo();Object.assign(existing,values);}else{commitUndo();const e=createElement('text',{name:`Text ${state.nameSequence++}`,x,y,layer:currentLayerId(),...values});state.doc.elements.push(e);state.selectedIds=[e.id];}
    markDirty();closeDialog();drawAll();toast(existing?'Text updated.':'Text object created.','success');
  };
}
function saveNow(){try{saveProject(state.doc);state.dirty=false;state.lastSavedAt=new Date();$('#dirtyMark').hidden=true;$('#saveStatus').textContent='Saved export · local file';toast('Project export prepared. Choose where to save the .vex file.','success');}catch(err){toast(err.message,'error');}}
function openFilePicker(){ $('#openFileInput').value='';$('#openFileInput').click(); }
async function handleOpenFile(file){
  try{const text=await file.text();const doc=loadProjectText(text,file.name);commitUndo();state.doc=doc;state.selectedIds=[];state.dirty=false;state.undoStack=[];state.redoStack=[];state.zoom=1;state.panX=0;state.panY=0;try{localStorage.setItem(DRAFT_KEY,JSON.stringify({doc:state.doc,savedAt:new Date().toISOString()}));}catch{}drawAll();toast(`Opened ${file.name}.`,'success');}
  catch(err){toast(`Could not open file: ${err.message}`,'error');}
}
function openExportDialog(){openDialog('Export artwork',`<p class="muted">Export editable vectors or a raster image. PDF export is not included in this first lightweight build.</p><div class="feature-grid"><button class="feature-card" id="exportSVGButton"><span class="symbol">⌁</span><strong>SVG Vector</strong><small>Editable vector artwork</small></button><button class="feature-card" id="exportPNGButton"><span class="symbol">▧</span><strong>PNG Image</strong><small>Transparent or opaque raster</small></button><button class="feature-card" id="exportResponsiveButton"><span class="symbol">↗</span><strong>Size Variants</strong><small>Social and print dimensions</small></button></div><div class="field-grid" style="margin-top:15px"><div class="field"><label>PNG scale</label><select id="pngScale"><option value="1">1× — document size</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></div><div class="field"><label><input type="checkbox" id="pngTransparent" checked> Transparent background (PNG)</label></div></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);
  $('#exportSVGButton').onclick=()=>{exportSVG(state.doc);toast('SVG export started.','success');closeDialog();};
  $('#exportPNGButton').onclick=async()=>{try{await exportPNG(state.doc,{scale:Number($('#pngScale').value)||1,transparent:$('#pngTransparent').checked});toast('PNG export started.','success');closeDialog();}catch(err){toast(err.message,'error');}};
  $('#exportResponsiveButton').onclick=()=>{closeDialog();runFeature('responsive');};
}
function addQuickLayout(){commitUndo();makeQuickLayout(state.doc);state.selectedIds=[];markDirty();drawAll();toast('Created editable starter layout. Replace sample copy before publishing.','success');}
function runAssistant(){const prompt=$('#assistantPrompt')?.value||'';commitUndo();const result=applyNaturalCommand(state.doc,prompt);if(result.created){state.selectedIds=state.doc.elements.slice(-result.created).map(e=>e.id);markDirty();drawAll();}else {state.undoStack.pop();}const output=$('#assistantResult');if(output){output.textContent=result.message;output.style.color=result.created?'#9bdcb5':'var(--muted)';}toast(result.message,result.created?'success':'');}
function runCleanup(){const before=state.doc.elements.length;commitUndo();const report=cleanupDocument(state.doc);if(report.removed)markDirty();else state.undoStack.pop();state.selectedIds=state.selectedIds.filter(id=>findObject(id));drawAll();openDialog('Smart Vector Cleanup',`<p>${report.removed?`Removed ${report.removed} object(s).`:'No unsafe modifications were made.'}</p><div class="report-list">${report.notes.map(n=>`<div class="report-item"><span class="report-dot ${report.removed?'good':''}"></span><div><strong>${esc(n)}</strong><p>Cleanup checks exact duplicates and sub-pixel geometry only. Review the document visually.</p></div></div>`).join('')}</div><div class="dialog-actions"><button class="panel-button accent" data-dialog-cancel>Done</button></div>`);}
function showFindings(title,findings){openDialog(title,`<div class="report-list">${findings.map(f=>`<div class="report-item"><span class="report-dot ${f.level==='good'?'good':''}" style="${f.level==='info'?'background:#77bce8':''}"></span><div><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p></div></div>`).join('')}</div><div class="dialog-actions"><button class="panel-button accent" data-dialog-cancel>Close</button></div>`);}
function runFeature(id){
  if(id==='ai'){state.studioPanel='assistant';state.studioOpen=true;state.studioCollapsed=false;renderAllStudio();$('#assistantPrompt')?.focus();return;}
  if(id==='cleanup'){runCleanup();return;}
  if(id==='print'||id==='preflight'){state.studioPanel='preflight';state.studioOpen=true;state.studioCollapsed=false;renderAllStudio();return;}
  if(id==='type'||id==='typography'){openTextDialog();return;}
  if(id==='responsive'){
    const targets=[{label:'Instagram Square',width:1080,height:1080},{label:'Story / Reel',width:1080,height:1920},{label:'Landscape Post',width:1200,height:630},{label:'A4 at 150 dpi',width:1240,height:1754}];
    openDialog('One Design · All Sizes',`<p class="muted">Variants scale object geometry and text sizes. Complex layouts may need manual rearrangement after export; review every output.</p><div class="report-list">${targets.map((t,i)=>`<div class="report-item"><span class="report-dot good"></span><div style="flex:1"><strong>${esc(t.label)}</strong><p>${t.width} × ${t.height} px</p></div><button class="panel-button" data-responsive="${i}">Export SVG</button><button class="panel-button" data-responsive-png="${i}">Export PNG</button></div>`).join('')}</div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);
    $$('[data-responsive]').forEach(b=>b.onclick=()=>{const copy=exportResponsiveVariant(state.doc,targets[Number(b.dataset.responsive)]);exportSVG(copy);toast('Variant SVG exported.','success');});
    $$('[data-responsive-png]').forEach(b=>b.onclick=async()=>{try{const copy=exportResponsiveVariant(state.doc,targets[Number(b.dataset.responsivePng)]);await exportPNG(copy);toast('Variant PNG exported.','success');}catch(err){toast(err.message,'error');}});return;
  }
  if(id==='alignment'){
    openDialog('Optical Alignment',`<p class="muted">Select two or more objects on the canvas, then choose an alignment operation. The current implementation performs geometric alignment (not perceptual AI estimation).</p><div class="feature-grid">${[['left','Align left','⇤'],['center','Center horizontally','↔'],['right','Align right','⇥'],['top','Align top','⇡'],['middle','Center vertically','↕'],['bottom','Align bottom','⇣']].map(([a,b,c])=>`<button class="feature-card" data-align="${a}"><span class="symbol">${c}</span><strong>${b}</strong><small>Selected objects</small></button>`).join('')}</div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);
    $$('[data-align]').forEach(b=>b.onclick=()=>{commitUndo();const msg=alignSelection(state.doc,state.selectedIds,b.dataset.align);if(msg.startsWith('Aligned'))markDirty();else state.undoStack.pop();drawAll();toast(msg,msg.startsWith('Aligned')?'success':'');});return;
  }
  if(id==='mockup') {state.mockup=!state.mockup;renderCanvas();toast(state.mockup?'Presentation preview enabled; document geometry is unchanged.':'Presentation preview disabled.');return;}
  if(id==='brand'){
    const saved=state.doc.metadata?.brandPalette;
    openDialog('Design Consistency Guardian',`<p class="muted">Save a profile of preferred colors. This checks fills only; typography, logo clear space and full brand guidelines remain manual review items.</p>${STARTER_PALETTES.map((p,i)=>`<div class="report-item"><span class="report-dot ${saved?.name===p.name?'good':''}"></span><div style="flex:1"><strong>${esc(p.name)}</strong><p>${p.colors.join('  ·  ')}</p></div><button class="panel-button" data-brand-save="${i}">Use palette</button></div>`).join('')}<div class="dialog-actions"><button class="panel-button" id="runBrandCheck">Check saved profile</button><button class="panel-button" data-dialog-cancel>Close</button></div>`);
    $$('[data-brand-save]').forEach(b=>b.onclick=()=>{commitUndo();saveBrandPalette(state.doc,STARTER_PALETTES[Number(b.dataset.brandSave)]);markDirty();drawAll();toast(`Saved ${STARTER_PALETTES[Number(b.dataset.brandSave)].name} brand colors.`,'success');closeDialog();});
    $('#runBrandCheck').onclick=()=>showFindings('Brand Consistency Report',checkBrandPalette(state.doc));return;
  }
  if(id==='3d') {state.preview3d=!state.preview3d;renderCanvas();toast(state.preview3d?'Lightweight extrusion preview enabled.':'3D preview disabled.');return;}
  if(id==='history'){state.studioPanel='history';state.studioOpen=true;state.studioCollapsed=false;renderAllStudio();return;}
  if(id==='packaging'){
    openDialog('Packaging & Die-Line Generator',`<p class="muted">Create an editable, simple carton-net guide using your document's available space. Measurements below are interpreted as proportions in millimetres; the generated output is not manufacturing-certified.</p><div class="dialog-grid"><div class="field"><label>Box width (mm)</label><input id="packW" type="number" min="10" max="500" value="80"></div><div class="field"><label>Box height (mm)</label><input id="packH" type="number" min="10" max="700" value="120"></div><div class="field"><label>Box depth (mm)</label><input id="packD" type="number" min="5" max="300" value="35"></div><div class="field"><label>Output guide</label><input value="Red = cut · Blue = fold" disabled></div></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Cancel</button><button class="panel-button accent" id="generateDieline">Generate editable dieline</button></div>`);
    $('#generateDieline').onclick=()=>{const w=Number($('#packW').value),h=Number($('#packH').value),d=Number($('#packD').value);if([w,h,d].some(v=>!Number.isFinite(v)||v<=0)){toast('Enter valid positive dimensions.','error');return;}commitUndo();const result=generateDieline(state.doc,{w,h,depth:d});state.selectedIds=state.doc.elements.filter(e=>e.layer==='layer-dieline').map(e=>e.id);markDirty();drawAll();closeDialog();toast(result.details,'success');};return;
  }
  if(id==='accessibility'){
    const results=makeContrastReport(state.doc);
    if(!results.length){showFindings('Accessibility Checker',[{level:'info',title:'No text objects found',detail:'Add text to inspect approximate contrast against the document background.'}]);return;}
    openDialog('Accessibility & Contrast',`<p class="muted">Ratios compare text fill with the document background only. If text sits on a colored panel, select the actual background color and recheck manually. Contrast ratio guidance is not a complete accessibility audit.</p><div class="report-list">${results.map((r,i)=>`<div class="report-item"><span class="report-dot ${r.pass?'good':''}"></span><div style="flex:1"><strong>${esc(r.name)} · ${r.ratio.toFixed(2)}:1</strong><p>Text ${esc(r.color)} · ${r.pass?'Passes 4.5:1 contrast target':'Below 4.5:1 against document background'}</p></div><button class="panel-button" data-contrast-fix="${i}">Use ${r.fix}</button></div>`).join('')}</div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);
    $$('[data-contrast-fix]').forEach(b=>b.onclick=()=>{const r=results[Number(b.dataset.contrastFix)];const e=state.doc.elements.find(el=>el.name===r.name&&el.type==='text');if(e){commitUndo();e.fill=r.fix;state.selectedIds=[e.id];markDirty();drawAll();toast('Suggested contrast color applied.','success');closeDialog();}});return;
  }
}
function currentPromptText(){return $('#assistantPrompt')?.value||'';}
function openDefaultColorDialog(which){
  const key=which==='fill'?'fill':'stroke';
  openDialog(which==='fill'?'Default Fill Color':'Default Stroke Color',`<div class="field"><label>Color</label><input type="color" id="defaultColorPicker" value="${colorInput(state[key])}"></div><p class="muted">The color becomes the default for new objects. If objects are selected, this also applies to their ${which}.</p><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Cancel</button><button class="panel-button accent" id="applyDefaultColor">Apply color</button></div>`);
  $('#applyDefaultColor').onclick=()=>{const value=$('#defaultColorPicker').value;state[key]=value;const selected=selectedObjects();if(selected.length){commitUndo();selected.forEach(e=>e[key]=value);markDirty();}drawAll();closeDialog();toast(`${which} color updated.`,'success');};
}
function openAbout(){openDialog('About VEXORA Studio',`<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px"><img src="./assets/vexora-logo-original.jpg" alt="VEXORA logo" style="width:92px;height:92px;object-fit:contain;background:#000;border-radius:10px"><div><h3 style="margin:0 0 6px">VEXORA Studio</h3><p class="muted" style="margin:0">Version v 1.0.0 · October 2026</p><p class="muted" style="margin:6px 0 0">Offline-first vector design studio</p></div></div><div style="display:flex;align-items:center;gap:12px;border-top:1px solid var(--border);padding-top:14px"><img src="./assets/grafio-logo-original.png" alt="Grafio logo" style="width:76px;height:76px;object-fit:contain;background:#000;border-radius:8px"><div><strong>නිර්මාතෘ (Founder)</strong><p style="margin:5px 0 0">Grafio.</p><p class="muted" style="margin:4px 0 0">R.M.T.D Rajapaksha (Owner)</p></div></div><div class="dialog-actions"><button class="panel-button accent" data-dialog-cancel>Close</button></div>`);}
function openHelp(){openDialog('Keyboard Shortcuts',`<div class="report-list">${[['V','Selection'],['A','Direct selection / object inspector'],['P','Pen / freehand path'],['N','Pencil'],['R','Rectangle'],['O','Ellipse'],['L','Line'],['T','Text'],['I','Eyedropper'],['Ctrl/Cmd + Z','Undo'],['Ctrl/Cmd + Shift + Z','Redo'],['Ctrl/Cmd + S','Export project'],['Ctrl/Cmd + O','Open file'],['Delete / Backspace','Delete selected objects'],['G','Toggle grid'],['Space + drag','Pan viewport'],['Escape','Clear selection / close dialog']].map(([k,v])=>`<div class="report-item"><span class="pill">${esc(k)}</span><div><strong>${esc(v)}</strong></div></div>`).join('')}</div><div class="dialog-actions"><button class="panel-button accent" data-dialog-cancel>Got it</button></div>`);}
function handleAction(action){
  if(action==='quick-layout'){addQuickLayout();return;}
  if(action==='add-text'){openTextDialog();return;}
  if(action==='delete'){if(!state.selectedIds.length)return;commitUndo();state.doc.elements=state.doc.elements.filter(e=>!state.selectedIds.includes(e.id));state.selectedIds=[];markDirty();drawAll();toast('Selected objects deleted.');return;}
  if(action==='duplicate'){const originals=selectedObjects();if(!originals.length)return;commitUndo();const copies=originals.map(e=>({...deepClone(e),id:uid(e.type),name:`${e.name} Copy`,tx:(Number(e.tx)||0)+18,ty:(Number(e.ty)||0)+18}));state.doc.elements.push(...copies);state.selectedIds=copies.map(e=>e.id);markDirty();drawAll();toast(`Duplicated ${copies.length} object(s).`);return;}
  if(action==='front'){const selected=selectedObjects();if(!selected.length)return;commitUndo();state.doc.elements=state.doc.elements.filter(e=>!state.selectedIds.includes(e.id)).concat(selected);markDirty();drawAll();return;}
  if(action==='new-layer'){const name=`Layer ${state.doc.layers.length+1}`;state.doc.layers.push({id:uid('layer'),name,visible:true,locked:false});markDirty();renderInspector();toast(`Created ${name}.`);return;}
  if(action==='brand-check'){showFindings('Brand Consistency Report',checkBrandPalette(state.doc));return;}
  if(action==='set-bleed'){commitUndo();state.doc.metadata.bleed=3*96/25.4;markDirty();renderAllStudio();toast('Bleed metadata set to approximately 3 mm at 96 dpi. Confirm units with your print provider.');return;}
  if(action==='color-rgb'){commitUndo();state.doc.metadata.colorSpace='RGB';state.doc.metadata.profile='sRGB';markDirty();renderAllStudio();toast('Set document metadata to RGB/sRGB. This does not perform a color conversion.');return;}
  if(action==='export-report'){const text=analyzeDocument(state.doc).map(f=>`${f.level.toUpperCase()}: ${f.title}\n${f.detail}`).join('\n\n');downloadBlob(new Blob([`VEXORA PRE-FLIGHT REPORT\n${state.doc.name}\n${state.doc.width} × ${state.doc.height} px\n\n${text}\n\nThis report is advisory and does not certify print output.`],{type:'text/plain;charset=utf-8'}),`${safeBaseName(state.doc.name)}-preflight.txt`);toast('Preflight report exported.','success');return;}
  if(action==='snapshot'){const name=`Snapshot ${state.snapshots.length+1}`;state.snapshots.push({name,at:new Date().toISOString(),count:state.doc.elements.length,doc:deepClone(state.doc)});renderAllStudio();toast('Named snapshot saved for this session.','success');return;}
}
function selectInspectorObject(id){state.selectedIds=[id];state.inspector='design';drawAll();}

// Main UI event delegation.
document.addEventListener('click',event=>{
  const tool=event.target.closest('[data-tool]');if(tool){setTool(tool.dataset.tool);return;}
  const inspector=event.target.closest('[data-inspector]');if(inspector){state.inspector=inspector.dataset.inspector;renderInspector();return;}
  const dock=event.target.closest('[data-panel]');if(dock){state.studioPanel=dock.dataset.panel;state.studioOpen=true;state.studioCollapsed=false;renderAllStudio();return;}
  const feature=event.target.closest('[data-feature]');if(feature){runFeature(feature.dataset.feature);return;}
  const actionEl=event.target.closest('[data-action]');if(actionEl){handleAction(actionEl.dataset.action);return;}
  const dataColor=event.target.closest('[data-color]');if(dataColor){state.fill=dataColor.dataset.color;const sel=selectedObjects();if(sel.length){commitUndo();sel.forEach(e=>e.fill=state.fill);markDirty();}drawAll();toast(`Selected color ${state.fill}.`);return;}
  const savePalette=event.target.closest('[data-save-palette]');if(savePalette){const p=STARTER_PALETTES.find(p=>p.name===savePalette.dataset.savePalette);if(p){commitUndo();saveBrandPalette(state.doc,p);markDirty();renderInspector();toast(`Saved ${p.name} as the brand palette.`,'success');}return;}
  const layerAction=event.target.closest('[data-layer-action]');if(layerAction){const l=state.doc.layers.find(v=>v.id===layerAction.dataset.layerId);if(!l)return;commitUndo();if(layerAction.dataset.layerAction==='visibility')l.visible=!l.visible;else l.locked=!l.locked;markDirty();drawAll();return;}
  const layerSelect=event.target.closest('[data-layer-select]');if(layerSelect){const layerId=layerSelect.dataset.layerSelect;state.selectedIds=state.doc.elements.filter(e=>e.layer===layerId).map(e=>e.id);drawAll();return;}
  const selectObject=event.target.closest('[data-select-object]');if(selectObject){selectInspectorObject(selectObject.dataset.selectObject);return;}
  const tab=event.target.closest('[data-menu]');if(tab){const menu=tab.dataset.menu;if(menu==='file')openDialog('File',`<div class="feature-grid"><button class="feature-card" id="menuNew"><span class="symbol">＋</span><strong>New document</strong><small>Start a fresh canvas</small></button><button class="feature-card" id="menuOpen"><span class="symbol">↗</span><strong>Open file</strong><small>.vex, JSON or SVG</small></button><button class="feature-card" id="menuSave"><span class="symbol">⇩</span><strong>Save project</strong><small>Download .vex</small></button><button class="feature-card" id="menuExport"><span class="symbol">▧</span><strong>Export</strong><small>SVG and PNG</small></button></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);else if(menu==='edit')openDialog('Edit',`<div class="action-row"><button class="panel-button" id="menuUndo">Undo</button><button class="panel-button" id="menuRedo">Redo</button><button class="panel-button" id="menuDuplicate">Duplicate</button><button class="panel-button danger" id="menuDelete">Delete</button></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);else if(menu==='object')openDialog('Object',`<div class="action-row"><button class="panel-button" id="menuFront">Bring to front</button><button class="panel-button" id="menuAlign">Align objects</button><button class="panel-button" id="menuCleanup">Smart cleanup</button></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);else if(menu==='view')openDialog('View',`<div class="action-row"><button class="panel-button" id="menuGrid">Toggle grid</button><button class="panel-button" id="menuSnap">Toggle snap</button><button class="panel-button" id="menuFit">Fit artboard</button><button class="panel-button" id="menu3d">Toggle 3D preview</button></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);else if(menu==='window'){state.studioOpen=!state.studioOpen;renderAllStudio();}else if(menu==='help')openDialog('Help',`<div class="action-row"><button class="panel-button" id="aboutButton">About VEXORA Studio</button><button class="panel-button" id="shortcutsButton">Keyboard shortcuts</button></div><div class="dialog-actions"><button class="panel-button" data-dialog-cancel>Close</button></div>`);else openHelp();return;}
  const resp=event.target.closest('[data-restore-snapshot]');if(resp){const snap=state.snapshots[Number(resp.dataset.restoreSnapshot)];if(snap){commitUndo();state.doc=deepClone(snap.doc);state.selectedIds=[];markDirty();drawAll();toast(`Restored ${snap.name}.`,'success');}return;}
  const panelButton=event.target.closest('[data-responsive],[data-responsive-png],[data-brand-save],[data-contrast-fix],[data-align]');if(panelButton)return;
  const colorChip=event.target.closest('#fillChip, #strokeChip');if(colorChip){openDefaultColorDialog(colorChip.id==='fillChip'?'fill':'stroke');return;}
  if(event.target.id==='themeButton'){state.theme=state.theme==='dark'?'light':'dark';document.body.classList.toggle('light-theme',state.theme==='light');return;}
  if(event.target.id==='helpButton'){openHelp();return;}
  if(event.target.id==='aboutButton'){openAbout();return;}
  if(event.target.id==='shortcutsButton'){openHelp();return;}
  if(event.target.id==='saveButton'){saveNow();return;}
  if(event.target.id==='exportButton'){openExportDialog();return;}
  if(event.target.id==='undoButton'||event.target.id==='studioUndo'){undo();return;}
  if(event.target.id==='redoButton'||event.target.id==='studioRedo'){redo();return;}
  if(event.target.id==='newDocumentButton'||event.target.id==='menuNew'){if(state.dirty&&!confirm('Start a new document? Export unsaved changes first if you need to keep them.'))return;state.doc=createDocument();state.selectedIds=[];state.undoStack=[];state.redoStack=[];state.dirty=false;state.zoom=1;state.panX=0;state.panY=0;state.snapshots=[];drawAll();closeDialog();return;}
  if(event.target.id==='menuOpen'){closeDialog();openFilePicker();return;}
  if(event.target.id==='menuSave'){closeDialog();saveNow();return;}
  if(event.target.id==='menuExport'){closeDialog();openExportDialog();return;}
  if(event.target.id==='menuUndo'){undo();closeDialog();return;}if(event.target.id==='menuRedo'){redo();closeDialog();return;}if(event.target.id==='menuDuplicate'){handleAction('duplicate');closeDialog();return;}if(event.target.id==='menuDelete'){handleAction('delete');closeDialog();return;}if(event.target.id==='menuFront'){handleAction('front');closeDialog();return;}if(event.target.id==='menuAlign'){closeDialog();runFeature('alignment');return;}if(event.target.id==='menuCleanup'){closeDialog();runCleanup();return;}if(event.target.id==='menuGrid'){state.grid=!state.grid;renderCanvas();closeDialog();return;}if(event.target.id==='menuSnap'){state.snap=!state.snap;renderCanvas();closeDialog();return;}if(event.target.id==='menuFit'){state.zoom=1;state.panX=0;state.panY=0;renderCanvas();closeDialog();return;}if(event.target.id==='menu3d'){state.preview3d=!state.preview3d;renderCanvas();closeDialog();return;}
  if(event.target.id==='gridButton'){state.grid=!state.grid;renderCanvas();return;}if(event.target.id==='snapButton'){state.snap=!state.snap;renderCanvas();return;}
  if(event.target.id==='zoomIn'){state.zoom=Math.min(4,state.zoom*1.2);renderCanvas();return;}if(event.target.id==='zoomOut'){state.zoom=Math.max(.2,state.zoom/1.2);renderCanvas();return;}if(event.target.id==='fitButton'){state.zoom=1;state.panX=0;state.panY=0;renderCanvas();return;}
  if(event.target.id==='starterButton'||event.target.id==='quickLayoutButton'){addQuickLayout();return;}
  if(event.target.id==='runAssistant'){runAssistant();return;}
  if(event.target.id==='studioCollapse'){state.studioCollapsed=!state.studioCollapsed;renderAllStudio();return;}if(event.target.id==='studioClose'){state.studioOpen=false;renderAllStudio();return;}
  if(event.target.matches('[data-dialog-cancel]')){closeDialog();return;}
});

document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.docprop){const key=el.dataset.docprop;let value=el.type==='number'?Number(el.value):el.value;if(key==='width'||key==='height'){if(!Number.isFinite(value)||value<1||value>100000){toast('Artboard dimensions must be between 1 and 100,000 px.','error');renderInspector();return;}commitUndo();state.doc[key]=value;state.zoom=1;}else if(key==='bleed'){commitUndo();state.doc.metadata.bleed=Math.max(0,Number(value)||0);}else if(key==='colorSpace'){commitUndo();state.doc.metadata.colorSpace=value;}else if(key==='name'){state.doc.name=String(value).slice(0,100)||'Untitled Design';}else if(key==='background'){commitUndo();state.doc.background=value;}markDirty();drawAll();return;}
  if(el.dataset.defaultprop){const key=el.dataset.defaultprop;state[key]=el.type==='number'?Number(el.value):el.value;if(key==='strokeWidth')state.strokeWidth=Math.max(0,state.strokeWidth);renderInspector();return;}
  if(el.dataset.multiProp){commitUndo();selectedObjects().forEach(e=>e[el.dataset.multiProp]=el.value);state.fill=el.value;markDirty();drawAll();return;}
  if(el.dataset.prop){const key=el.dataset.prop;const propKey=key==='opacityPercent'?'opacity':key;const sel=selectedObjects();if(sel.length!==1)return;const obj=sel[0];let value=el.type==='number'?Number(el.value):el.value;if(key==='opacityPercent')value=Math.max(0,Math.min(100,value))/100;if(['x','y'].includes(key)){commitUndo();const b=elementBounds(obj);if(key==='x')obj.tx=(Number(obj.tx)||0)+(value-b.x);else obj.ty=(Number(obj.ty)||0)+(value-b.y);}else if(key==='w'){commitUndo();obj.scaleX=Math.max(.001,value)/Math.max(1,Number(obj.w)||1);}else if(key==='h'){commitUndo();obj.scaleY=Math.max(.001,value)/Math.max(1,Number(obj.h)||1);}else{commitUndo();obj[propKey]=value;}if(key==='fill')state.fill=value;if(key==='stroke')state.stroke=value;markDirty();drawAll();return;}
});

svg.addEventListener('pointerdown',svgPointerDown);svg.addEventListener('pointermove',svgPointerMove);svg.addEventListener('pointerup',svgPointerUp);svg.addEventListener('pointercancel',svgPointerUp);
svg.addEventListener('dblclick',event=>{const id=getHitObject(event);const e=findObject(id);if(e?.type==='text')openTextDialog(e.x+e.tx,e.y+e.ty,e);});
svg.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();state.zoom=Math.max(.2,Math.min(4,state.zoom*(event.deltaY<0?1.08:.92)));renderCanvas();},{passive:false});
$('#canvasViewport').addEventListener('contextmenu',event=>event.preventDefault());
$('#openFileInput').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)handleOpenFile(file);});
$('#dialogClose').addEventListener('click',closeDialog);
$('#genericDialog').addEventListener('click',event=>{if(event.target===$('#genericDialog'))closeDialog();});
window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
  if(event.code==='Space'&&!event.repeat){state.spaceDown=true;event.preventDefault();}
  if(event.key==='Escape'){if($('#genericDialog').open){closeDialog();return;}state.selectedIds=[];renderCanvas();renderInspector();}
  if(mod&&key==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
  if(mod&&key==='s'){event.preventDefault();saveNow();return;}if(mod&&key==='o'){event.preventDefault();openFilePicker();return;}if(mod&&key==='e'){event.preventDefault();openExportDialog();return;}
  if(mod&&key==='d'){event.preventDefault();handleAction('duplicate');return;}
  if((key==='delete'||key==='backspace')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();handleAction('delete');return;}
  if(key==='g'&&!mod&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){state.grid=!state.grid;renderCanvas();return;}
  if(mod||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  const hotkeys={v:'select',a:'node',p:'pen',n:'pencil',r:'rect',o:'ellipse',l:'line',t:'text',i:'eyedropper'};if(hotkeys[key])setTool(hotkeys[key]);
});
window.addEventListener('keyup',event=>{if(event.code==='Space')state.spaceDown=false;});
window.addEventListener('blur',()=>{state.spaceDown=false;});
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});

// Local recovery offer. No network access or external service is used.
try{
  const recovery=localStorage.getItem(DRAFT_KEY);
  if(recovery){const parsed=JSON.parse(recovery);if(parsed?.doc?.schema==='vexora-document'&&Array.isArray(parsed.doc.elements)&&parsed.doc.elements.length){
    const age=Date.now()-new Date(parsed.savedAt||0).getTime();
    if(age<7*24*60*60*1000&&confirm('A local VEXORA recovery document was found. Restore it?')){validateDocument(parsed.doc);state.doc=parsed.doc;state.dirty=true;toast('Recovered local document. Save a .vex copy to keep it portable.','success');}
  }}
}catch{}

renderAll();
