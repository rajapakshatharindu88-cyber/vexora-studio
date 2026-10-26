import { createElement, deepClone, elementBounds, normalizeHex, uid } from './model.js';
import { documentToSVG } from './renderer.js';

export const FEATURE_CATALOG = [
  {id:'ai', number:'01', title:'AI Design Assistant', icon:'✳', summary:'Offline command assistant powered by deterministic rules', action:'assistant'},
  {id:'cleanup', number:'02', title:'Smart Vector Cleanup', icon:'⌁', summary:'Detect duplicate, tiny and out-of-bounds objects', action:'cleanup'},
  {id:'print', number:'03', title:'Print Production Intelligence', icon:'▤', summary:'Preflight, dimensions, bleed and RGB checks', action:'preflight'},
  {id:'type', number:'04', title:'Smart Typography', icon:'T', summary:'Typography controls with Unicode/Sinhala text support', action:'typography'},
  {id:'responsive', number:'05', title:'One Design · All Sizes', icon:'↗', summary:'Export composition variants for common placements', action:'responsive'},
  {id:'alignment', number:'06', title:'Optical Alignment', icon:'⊞', summary:'Align selected objects and inspect composition gaps', action:'alignment'},
  {id:'mockup', number:'07', title:'Live Mockup', icon:'▱', summary:'Preview the artboard in a presentation frame', action:'mockup'},
  {id:'brand', number:'08', title:'Consistency Guardian', icon:'◈', summary:'Save brand colors and flag inconsistent fills', action:'brand'},
  {id:'3d', number:'09', title:'Vector-to-3D Preview', icon:'⬡', summary:'Lightweight extruded appearance preview', action:'3d'},
  {id:'history', number:'10', title:'Non-Destructive History', icon:'↶', summary:'Named snapshots and reversible document restore', action:'history'},
  {id:'packaging', number:'11', title:'Packaging & Die-Lines', icon:'▦', summary:'Generate simple editable cut/fold guides', action:'packaging'},
  {id:'accessibility', number:'12', title:'Accessibility Checker', icon:'◉', summary:'Contrast analysis and accessible-color suggestions', action:'accessibility'}
];

export const STARTER_PALETTES = [
  {name:'Vexora Violet', colors:['#231b2d','#8b5fc7','#d6b7f4','#f6f0fc','#ffffff']},
  {name:'Maroon & Gold', colors:['#4b1422','#7c1f35','#c39a48','#f2e6c9','#ffffff']},
  {name:'Ink & Citrus', colors:['#171a21','#2e3946','#e2ef62','#f4f4eb','#ffffff']},
  {name:'Ocean Studio', colors:['#102c3a','#1e6b78','#81c5c2','#e6f2ed','#ffffff']}
];

export function hexToRgb(color) {
  const hex = normalizeHex(color).slice(1);
  return { r:parseInt(hex.slice(0,2),16), g:parseInt(hex.slice(2,4),16), b:parseInt(hex.slice(4,6),16) };
}
export function relativeLuminance(color) {
  const {r,g,b}=hexToRgb(color);
  const channel = v => { v/=255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; };
  return .2126*channel(r)+.7152*channel(g)+.0722*channel(b);
}
export function contrastRatio(fg,bg) { const a=relativeLuminance(fg),b=relativeLuminance(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
export function chooseReadableText(bg) { return contrastRatio('#ffffff',bg) >= contrastRatio('#111111',bg) ? '#ffffff' : '#111111'; }

export function analyzeDocument(doc) {
  const findings=[];
  if(!doc.elements.length) findings.push({level:'info',title:'Canvas is empty',detail:'Add vector objects before running production checks.'});
  if((doc.metadata?.bleed||0)<=0) findings.push({level:'warning',title:'Bleed is not defined',detail:'For edge-to-edge printing, confirm a bleed value with your print provider.'});
  if((doc.metadata?.colorSpace||'RGB').toUpperCase()!=='CMYK') findings.push({level:'warning',title:'Document is RGB',detail:'RGB artwork can be exported, but a print provider may require a managed CMYK conversion.'});
  if(!(doc.metadata?.profile)) findings.push({level:'warning',title:'Color profile is unspecified',detail:'Confirm the target color profile with the printer or output workflow.'});
  const hidden = new Set((doc.layers||[]).filter(l=>!l.visible).map(l=>l.id));
  for(const e of doc.elements){
    if(hidden.has(e.layer)||e.visible===false) continue;
    const b=elementBounds(e);
    if(b.right<0||b.bottom<0||b.x>doc.width||b.y>doc.height) findings.push({level:'warning',title:`Outside artwork: ${e.name}`,detail:'This object is completely outside the current artboard.'});
    if(b.x<0||b.y<0||b.right>doc.width||b.bottom>doc.height) findings.push({level:'info',title:`Artwork crosses edge: ${e.name}`,detail:'Confirm whether this is intentional bleed or an accidental off-artboard object.'});
    if(e.type==='text' && Number(e.fontSize||0)>0 && Number(e.fontSize)<8) findings.push({level:'warning',title:`Small text: ${e.name}`,detail:'Text below 8 px may be too small for many print or digital contexts. Verify at final size.'});
    if(e.type==='text' && /[\u0D80-\u0DFF]/.test(e.text||'')) findings.push({level:'info',title:'Sinhala text detected',detail:'Verify shaping, line breaks and font availability on the target production machine.'});
    if(e.type==='text' && e.fill && e.fill!=='none'){
      const ratio=contrastRatio(e.fill,doc.background||'#ffffff');
      if(ratio<4.5) findings.push({level:'warning',title:`Low text contrast: ${e.name}`,detail:`Estimated contrast ${ratio.toFixed(2)}:1 against the document background. This is a heuristic; inspect any colored background behind the text.`});
    }
  }
  findings.unshift({level:'good',title:`${doc.elements.length} vector object${doc.elements.length===1?'':'s'} inspected`,detail:`Artboard ${doc.width} × ${doc.height} px. Checks do not certify final print output.`});
  return findings;
}

function objectFingerprint(e) {
  return JSON.stringify([e.type,e.x,e.y,e.w,e.h,e.tx,e.ty,e.rotation,e.fill,e.stroke,e.strokeWidth,e.text,e.d,e.points]);
}

export function cleanupDocument(doc) {
  const seen=new Set(), remove=new Set(), notes=[];
  for(const e of doc.elements){
    if(Math.max(Number(e.w)||0,Number(e.h)||0)<.75 && e.type!=='text') { remove.add(e.id); notes.push(`Removed tiny object: ${e.name}`); continue; }
    const fp=objectFingerprint(e);
    if(seen.has(fp)) { remove.add(e.id); notes.push(`Removed duplicate: ${e.name}`); }
    else seen.add(fp);
  }
  const before=doc.elements.length;
  doc.elements=doc.elements.filter(e=>!remove.has(e.id));
  if(!notes.length) notes.push('No exact duplicates or sub-pixel objects found. Geometry was left unchanged.');
  return {removed:before-doc.elements.length,notes};
}

export function makeQuickLayout(doc) {
  doc.elements=[];
  doc.layers=[{id:'layer-artwork',name:'Artwork',visible:true,locked:false}];
  doc.background='#f6f2fa';
  const margin=70, cardW=doc.width-140, cardH=doc.height-140;
  doc.elements.push(createElement('rect',{name:'Background Panel',x:margin,y:margin,w:cardW,h:cardH,fill:'#261d31',stroke:'none',strokeWidth:0,rx:28,ry:28}));
  doc.elements.push(createElement('ellipse',{name:'Accent Orb',x:doc.width-340,y:margin+45,w:180,h:180,fill:'#a879e2',stroke:'none',strokeWidth:0,opacity:.92}));
  doc.elements.push(createElement('ellipse',{name:'Accent Ring',x:doc.width-285,y:margin+100,w:190,h:190,fill:'none',stroke:'#e8d4ff',strokeWidth:2,opacity:.8}));
  doc.elements.push(createElement('text',{name:'Eyebrow',x:margin+55,y:margin+70,w:500,h:25,text:'VEXORA  /  DESIGN SYSTEM',fontSize:17,fontFamily:'Inter, Arial, sans-serif',fontWeight:700,letterSpacing:3,fill:'#caa7ef',stroke:'none',strokeWidth:0}));
  doc.elements.push(createElement('text',{name:'Headline',x:margin+52,y:margin+160,w:cardW*.66,h:90,text:'Make ideas\nfeel tangible.',fontSize:62,fontFamily:'Inter, Arial, sans-serif',fontWeight:700,fill:'#ffffff',stroke:'none',strokeWidth:0}));
  doc.elements.push(createElement('text',{name:'Description',x:margin+58,y:margin+315,w:cardW*.62,h:42,text:'A thoughtful space for bold visual work.',fontSize:23,fontFamily:'Inter, Arial, sans-serif',fontWeight:400,fill:'#d7c9e8',stroke:'none',strokeWidth:0}));
  doc.elements.push(createElement('rect',{name:'Call to Action',x:margin+57,y:margin+400,w:230,h:55,fill:'#d5b3f4',stroke:'none',strokeWidth:0,rx:14,ry:14}));
  doc.elements.push(createElement('text',{name:'Call to Action Label',x:margin+80,y:margin+416,w:190,h:28,text:'EXPLORE THE STUDIO  ↗',fontSize:14,fontWeight:700,fill:'#271c35',stroke:'none',strokeWidth:0}));
  doc.name='VEXORA Quick Layout'; doc.updatedAt=new Date().toISOString();
  return doc;
}

export function applyNaturalCommand(doc, rawPrompt) {
  const prompt=String(rawPrompt||'').trim();
  if(!prompt) return {message:'Enter a design instruction to get started.',created:0};
  const low=prompt.toLowerCase();
  const colorMap={maroon:'#6e1d32',burgundy:'#6e1d32',gold:'#c5a04f',pink:'#e9a8c7',purple:'#9c73d2',violet:'#8b5fc7',blue:'#4776b8',navy:'#192e4a',green:'#4a9567',black:'#17181c',white:'#ffffff',red:'#dc4c58',orange:'#ed9152',yellow:'#e8c94b',teal:'#4faaa8'};
  let chosen='#c8a0f3'; for(const [key,value] of Object.entries(colorMap)) if(new RegExp(`\\b${key}\\b`,'i').test(low)){chosen=value;break;}
  if(/quick layout|starter|portfolio layout|make a layout/.test(low)){ makeQuickLayout(doc); return {message:'Created an editable starter composition. Select any object to change it.',created:doc.elements.length}; }
  if(/business.?card|visiting card/.test(low)){
    const w=doc.width,h=doc.height, m=Math.round(Math.min(w,h)*.08);
    doc.background='#f4eee8';
    doc.elements.push(createElement('rect',{name:'Business Card Base',x:m,y:m,w:w-2*m,h:h-2*m,fill:chosen,stroke:'#c5a04f',strokeWidth:2,rx:16,ry:16}));
    doc.elements.push(createElement('text',{name:'Brand Name',x:m+35,y:m+55,w:w*.62,h:50,text:/name\s*[:=]\s*([^,;]+)/i.exec(prompt)?.[1]||'YOUR BRAND',fontSize:Math.max(25,Math.round(w*.04)),fontWeight:700,fill:chooseReadableText(chosen),stroke:'none',strokeWidth:0}));
    doc.elements.push(createElement('text',{name:'Contact Details',x:m+38,y:h-m-105,w:w*.7,h:55,text:'Creative Studio  ·  +94 00 000 0000',fontSize:Math.max(12,Math.round(w*.018)),fill:chooseReadableText(chosen),stroke:'none',strokeWidth:0}));
    return {message:'Added an editable business-card starting point. Replace the sample contact text before printing.',created:3};
  }
  const shapeMatch=low.match(/\b(circle|ellipse|rectangle|rect|square|line|star)\b/);
  const matchText=/(?:text|says?|with headline|title)\s*["'“]?([^"'”]+)["'”]?/i.exec(prompt);
  const created=[]; const baseX=doc.width*.22,baseY=doc.height*.22;
  if(shapeMatch){
    const kind=shapeMatch[1];
    if(['circle','ellipse'].includes(kind)) created.push(createElement('ellipse',{name:'Assistant Circle',x:baseX,y:baseY,w:doc.width*.24,h:doc.width*.24,fill:chosen,stroke:'#2d2439',strokeWidth:2}));
    else if(['line'].includes(kind)) created.push(createElement('line',{name:'Assistant Line',x:baseX,y:baseY,w:doc.width*.45,h:doc.height*.2,fill:'none',stroke:chosen,strokeWidth:6}));
    else if(kind==='star') created.push(createElement('polygon',{name:'Assistant Star',x:baseX,y:baseY,w:180,h:180,points:'90,0 111,62 178,64 126,104 145,170 90,132 35,170 54,104 2,64 69,62',fill:chosen,stroke:'#31233e',strokeWidth:2}));
    else created.push(createElement('rect',{name:'Assistant Rectangle',x:baseX,y:baseY,w:doc.width*.34,h:doc.height*.23,fill:chosen,stroke:'#31233e',strokeWidth:2,rx:/round|rounded/.test(low)?18:0,ry:/round|rounded/.test(low)?18:0}));
  }
  if(matchText){
    const text=matchText[1].trim().slice(0,160);
    created.push(createElement('text',{name:'Assistant Text',x:doc.width*.12,y:doc.height*.65,w:doc.width*.7,h:70,text,fontSize:Math.max(25,Math.min(72,doc.width*.055)),fontWeight:700,fill:chosen,stroke:'none',strokeWidth:0}));
  }
  if(created.length){doc.elements.push(...created);return {message:`Created ${created.length} editable vector object${created.length===1?'':'s'} using local rules. No online AI was used.`,created:created.length};}
  if(/palette|color scheme|colour scheme|colors|colours/.test(low)) return {message:`Suggested palette: ${[chosen,'#ffffff','#24202b','#d8c2ef'].join('  ·  ')}. Use Assets to save a brand palette.`,created:0,palette:[chosen,'#ffffff','#24202b','#d8c2ef']};
  return {message:'This offline assistant understands common shape, text, business-card and starter-layout commands. For free-form concept generation, an optional language model could be added later.',created:0};
}

export function alignSelection(doc, ids, mode) {
  const list=doc.elements.filter(e=>ids.includes(e.id));
  if(list.length<2) return 'Select at least two objects to align them.';
  const boxes=list.map(e=>({e,b:elementBounds(e)}));
  const minX=Math.min(...boxes.map(v=>v.b.x)), maxX=Math.max(...boxes.map(v=>v.b.right)), minY=Math.min(...boxes.map(v=>v.b.y)), maxY=Math.max(...boxes.map(v=>v.b.bottom));
  if(mode==='left'){for(const {e,b} of boxes)e.tx=(Number(e.tx)||0)+minX-b.x;}
  else if(mode==='right'){for(const {e,b} of boxes)e.tx=(Number(e.tx)||0)+maxX-b.right;}
  else if(mode==='center'){const mid=(minX+maxX)/2;for(const {e,b} of boxes)e.tx=(Number(e.tx)||0)+mid-b.cx;}
  else if(mode==='top'){for(const {e,b} of boxes)e.ty=(Number(e.ty)||0)+minY-b.y;}
  else if(mode==='bottom'){for(const {e,b} of boxes)e.ty=(Number(e.ty)||0)+maxY-b.bottom;}
  else if(mode==='middle'){const mid=(minY+maxY)/2;for(const {e,b} of boxes)e.ty=(Number(e.ty)||0)+mid-b.cy;}
  return `Aligned ${list.length} objects (${mode}).`;
}

export function exportResponsiveVariant(doc, target) {
  const copy=deepClone(doc), sx=target.width/doc.width, sy=target.height/doc.height;
  copy.width=target.width;copy.height=target.height;copy.name=`${doc.name} ${target.label}`;
  for(const e of copy.elements){e.x=(Number(e.x)||0)*sx;e.y=(Number(e.y)||0)*sy;e.w=(Number(e.w)||0)*sx;e.h=(Number(e.h)||0)*sy;e.tx=(Number(e.tx)||0)*sx;e.ty=(Number(e.ty)||0)*sy;if(e.fontSize)e.fontSize*=Math.min(sx,sy);if(e.strokeWidth)e.strokeWidth*=Math.min(sx,sy);}
  return copy;
}

export function generateDieline(doc, settings={}) {
  const layerId='layer-dieline';
  let layer=doc.layers.find(l=>l.id===layerId);
  if(!layer){layer={id:layerId,name:'Dieline · Production Guide',visible:true,locked:false};doc.layers.push(layer);}
  // Simple tuck-box / carton net: one connected strip of four panels and top/bottom flaps.
  const scale=Math.min((doc.width*.68)/(settings.w*4+settings.depth*2),(doc.height*.62)/(settings.h*2+settings.depth*2));
  const bw=Math.max(20,settings.w*scale), bh=Math.max(20,settings.h*scale), d=Math.max(10,settings.depth*scale), x=(doc.width-(bw*4+d*2))*.5, y=(doc.height-(bh*2+d*2))*.5;
  const cut='#eb5c66',fold='#509bdd';
  const cutLine=(name,x1,y1,x2,y2)=>createElement('line',{name,x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1),fill:'none',stroke:cut,strokeWidth:1.5,layer:layerId});
  const foldLine=(name,x1,y1,x2,y2)=>createElement('line',{name,x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1),fill:'none',stroke:fold,strokeWidth:1.1,layer:layerId,strokeDasharray:'5 4'});
  const items=[];
  // Outer cut boundary, shown as four paths so horizontal/vertical direction is retained.
  const p=[ [x,y],[x+bw*4+d*2,y],[x+bw*4+d*2,y+bh*2+d*2],[x,y+bh*2+d*2] ];
  items.push(createElement('path',{name:'Outer Cut Boundary',x:0,y:0,w:doc.width,h:doc.height,d:`M ${p[0][0]} ${p[0][1]} L ${p[1][0]} ${p[1][1]} L ${p[2][0]} ${p[2][1]} L ${p[3][0]} ${p[3][1]} Z`,fill:'none',stroke:cut,strokeWidth:1.5,layer:layerId,closed:true}));
  for(let i=1;i<4;i++)items.push(foldLine(`Vertical Fold ${i}`,x+bw*i,y,x+bw*i,y+bh*2+d*2));
  items.push(foldLine('Top Fold',x,y+bh,x+bw*4+d*2,y+bh)); items.push(foldLine('Bottom Fold',x,y+bh+d,x+bw*4+d*2,y+bh+d));
  items.push(foldLine('Lid Fold',x,y+d+bh,x+bw*4+d*2,y+d+bh));
  items.push(createElement('text',{name:'Dieline Legend',x:x,y:Math.max(18,y-20),w:500,h:16,text:'CUT  /  FOLD  ·  Verify dimensions and printer requirements',fontSize:12,fill:'#37404b',stroke:'none',strokeWidth:0,layer:layerId}));
  doc.elements=doc.elements.filter(e=>e.layer!==layerId);doc.elements.push(...items);
  return {count:items.length,scale,details:`Generated a simple carton net from ${settings.w} × ${settings.h} × ${settings.depth} mm input. This is a design starting point, not a manufacturing-certified dieline.`};
}

export function makeContrastReport(doc) {
  const result=[];
  for(const e of doc.elements.filter(e=>e.type==='text')){
    const color=e.fill||'#000000'; const ratio=contrastRatio(color,doc.background||'#ffffff');
    result.push({name:e.name,color,ratio,pass:ratio>=4.5,large:ratio>=3,fix:chooseReadableText(doc.background||'#ffffff')});
  }
  return result;
}

export function saveBrandPalette(doc, palette) {
  doc.metadata ||= {};
  doc.metadata.brandPalette={name:palette.name,colors:[...palette.colors],savedAt:new Date().toISOString()};
}

export function checkBrandPalette(doc) {
  const palette=doc.metadata?.brandPalette;
  if(!palette?.colors?.length) return [{level:'info',title:'No brand profile saved',detail:'Save a palette from Assets to enable brand consistency checks.'}];
  const allowed=new Set(palette.colors.map(normalizeHex));
  const found=new Map();
  for(const e of doc.elements){if(e.fill&&e.fill!=='none'){const c=normalizeHex(e.fill);if(!allowed.has(c))found.set(c,(found.get(c)||0)+1);}}
  if(!found.size)return [{level:'good',title:'Brand colors are consistent',detail:`Every explicit fill matches the “${palette.name}” palette.`}];
  return [...found.entries()].map(([color,count])=>({level:'warning',title:`Color ${color} is outside the brand palette`,detail:`Used by ${count} object${count===1?'':'s'}. Review intentional exceptions before replacing it.`}));
}

export function svgText(doc) { return documentToSVG(doc); }
