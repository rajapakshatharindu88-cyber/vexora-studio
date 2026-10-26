# VEXORA 0.1.0 — Feature Status

This file distinguishes working prototype behavior from the full long-term design target. “Partial” does not mean production-certified.

| # | Feature area | Status in this build | Current limit |
|---|---|---|---|
| 1 | AI Design Assistant | Partial, offline rules | Understands a small set of shape, text, palette, business-card and starter-layout prompts; it is not a generative AI model and does not invent complex artwork. |
| 2 | Smart Vector Cleanup | Basic working | Removes exact duplicate fingerprints and tiny non-text objects; no advanced path boolean repair or curve optimization. |
| 3 | Print Production Intelligence | Advisory preflight | Checks artboard, bleed metadata, color-space metadata, object bounds, small text and contrast. No PDF/X, CMYK conversion, separations, spot plates, overprint or embedded-font audit. |
| 4 | Smart Typography / Sinhala | Basic working | Text editing and Unicode strings are supported. Shaping relies on browser/system fonts. No dedicated font manager, OpenType inspector or verified advanced Sinhala shaping pipeline yet. |
| 5 | One Design · All Sizes | Basic scaling/export | Exports resized variants. Does not automatically reflow/recompose every layout. Review each output manually. |
| 6 | Alignment Assistant | Geometric alignment working | Aligns multiple selected objects to bounds. Optical alignment and smart distributed spacing suggestions are not yet implemented. |
| 7 | Live Mockup | Simple presentation toggle | The current toggle is only a lightweight presentation preview, not perspective mapping onto a collection of real mockup surfaces. |
| 8 | Design Consistency Guardian | Basic working | Saves a palette in document metadata and flags explicit fills outside it. Does not fully inspect logos, safe space, type hierarchy or brand guidelines. |
| 9 | Vector-to-3D Preview | Simple extrusion-style preview | Stacked offset copies only; no real 3D mesh, bevel engine, material model, lighting rig or 3D file export. |
| 10 | Non-Destructive History | Partial working | Undo/redo plus named in-memory snapshots for the current session. Snapshots are not yet serialized into `.vex` files. |
| 11 | Packaging & Die-Lines | Basic working | Generates a simple editable carton guide with cut/fold colors. Not manufacturing-certified; glue flaps, exact carton standards, panel validation and reliable 3D folding are not done. |
| 12 | Accessibility & Contrast | Basic working | Estimates text-fill contrast against the document background. Does not infer the actual background behind each text object or complete an accessibility audit. |

## Additional items not yet implemented

- Full Bezier handles, click-to-place Pen anchors, arbitrary SVG path-command editing and robust transforms for rotated objects.
- Advanced transform handling for complex imported SVG paths and nested transforms.
- Full SVG fidelity (nested groups/transforms, clipping, masks, filters, gradients, raster images and complex CSS).
- PDF export, CMYK conversion/color management, print separations, overprint and PDF/X.
- Verified Code 128/QR generation, calendar generator, symbol libraries and plugin API.
- AI image generation, a local language model, cloud AI-provider integration or prompt-to-SVG generation beyond simple commands.
- Native installers compiled and tested on a clean Linux machine.
- Automated browser-based pointer/visual UI regression tests.

## Release gate for future versions

Before treating VEXORA as production-ready, add GUI interaction tests; verify save/open round trips; fuzz and harden SVG import; implement geometry transforms and boolean operations; add export validation; use known color-management test files; test real Sinhala fonts; verify Tauri packaging on supported Linux distributions; and benchmark large documents on 4GB hardware.
