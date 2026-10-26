import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createElement, validateDocument, elementBounds } from '../web/js/model.js';
import { cleanupDocument, contrastRatio, makeQuickLayout, applyNaturalCommand, alignSelection, generateDieline, analyzeDocument, checkBrandPalette, STARTER_PALETTES, saveBrandPalette } from '../web/js/features.js';

test('creates a valid empty VEXORA document', () => {
  const doc = createDocument();
  assert.equal(doc.schema, 'vexora-document');
  assert.equal(doc.width, 1200);
  assert.equal(validateDocument(doc), true);
});

test('rejects invalid document dimensions and duplicate IDs', () => {
  const doc = createDocument(); doc.width = -4;
  assert.throws(() => validateDocument(doc), /dimensions/i);
  const doc2 = createDocument(); const one=createElement('rect',{id:'same'}); const two=createElement('ellipse',{id:'same'}); doc2.elements.push(one,two);
  assert.throws(() => validateDocument(doc2), /duplicate/i);
});

test('cleanup removes exact duplicate objects and tiny non-text elements', () => {
  const doc=createDocument(); const a=createElement('rect',{name:'A',x:10,y:10,w:50,h:40}); const b={...a,id:'b',name:'B'}; const tiny=createElement('ellipse',{name:'Tiny',x:0,y:0,w:.2,h:.2}); doc.elements=[a,b,tiny];
  const result=cleanupDocument(doc);
  assert.equal(result.removed,2); assert.equal(doc.elements.length,1);
});

test('contrast ratio follows known black/white ratio', () => {
  assert.ok(Math.abs(contrastRatio('#000000','#ffffff')-21)<.01);
  assert.ok(contrastRatio('#777777','#ffffff') < contrastRatio('#000000','#ffffff'));
});

test('starter layout yields editable objects', () => {
  const doc=createDocument(); makeQuickLayout(doc);
  assert.ok(doc.elements.length>=5); assert.ok(doc.elements.some(e=>e.type==='text'));
  assert.equal(validateDocument(doc),true);
});

test('offline assistant recognizes shapes and natural-language text', () => {
  const doc=createDocument(); const result=applyNaturalCommand(doc,'Create a maroon circle and text "Hello VEXORA"');
  assert.equal(result.created,2); assert.ok(doc.elements.some(e=>e.type==='ellipse'));
  assert.ok(doc.elements.some(e=>e.type==='text'&&e.text.includes('Hello VEXORA')));
});

test('aligns two objects to the same left edge', () => {
  const doc=createDocument(); const a=createElement('rect',{x:20,y:20,w:30,h:30}),b=createElement('rect',{x:100,y:80,w:40,h:25});doc.elements=[a,b];
  const msg=alignSelection(doc,[a.id,b.id],'left'); assert.match(msg,/Aligned/);
  assert.equal(elementBounds(a).x,elementBounds(b).x);
});

test('visual bounds include non-destructive scaling', () => {
  const e=createElement('rect',{x:10,y:20,w:100,h:40,scaleX:1.5,scaleY:2});
  assert.deepEqual({x:elementBounds(e).x,y:elementBounds(e).y,w:elementBounds(e).w,h:elementBounds(e).h},{x:10,y:20,w:150,h:80});
});

test('dieline generator adds an independent production layer and editable objects', () => {
  const doc=createDocument(); const r=generateDieline(doc,{w:80,h:120,depth:35});
  assert.ok(r.count>=5); assert.ok(doc.layers.some(l=>l.id==='layer-dieline')); assert.ok(doc.elements.some(e=>e.layer==='layer-dieline'));
  assert.equal(validateDocument(doc),true);
});

test('brand guardian reports missing profile then supports a saved palette', () => {
  const doc=createDocument(); assert.equal(checkBrandPalette(doc)[0].level,'info');
  saveBrandPalette(doc,STARTER_PALETTES[0]); assert.equal(checkBrandPalette(doc)[0].level,'good');
});

test('preflight gives advisory findings for an empty RGB document', () => {
  const report=analyzeDocument(createDocument()); assert.ok(report.some(r=>/empty/i.test(r.title))); assert.ok(report.some(r=>/RGB/i.test(r.title)));
});

test('SVG export contains editable vector markup and escapes text content', async () => {
  const { documentToSVG } = await import('../web/js/renderer.js');
  const doc=createDocument('Test Artwork');
  doc.elements.push(createElement('text',{name:'Safe Text',text:'<script>not markup</script>',fontSize:20,fill:'#222222'}));
  const svg=documentToSVG(doc);
  assert.match(svg,/<svg\b/);
  assert.match(svg,/<text\b/);
  assert.match(svg,/&lt;script&gt;not markup&lt;\/script&gt;/);
  assert.doesNotMatch(svg,/<script>/);
});

test('responsive exports scale dimensions and retain editability', async () => {
  const { exportResponsiveVariant } = await import('../web/js/features.js');
  const doc=createDocument('Social'); doc.elements.push(createElement('rect',{x:100,y:100,w:300,h:200}));
  const variant=exportResponsiveVariant(doc,{label:'Square',width:1080,height:1080});
  assert.equal(variant.width,1080);assert.equal(variant.height,1080);
  assert.equal(variant.elements[0].x,90);assert.equal(variant.elements[0].w,270);
  assert.equal(validateDocument(variant),true);
});

test('included starter example is a valid VEXORA project', async () => {
  const fs = await import('node:fs');
  const example=JSON.parse(fs.readFileSync(new URL('../samples/starter-layout.json', import.meta.url),'utf8'));
  assert.equal(validateDocument(example),true);
  assert.ok(example.elements.length>=5);
});
