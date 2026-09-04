# NOVA ONE

A cinematic, scroll-driven 3D product experience for the **NOVA ONE** concept flagship.
Built with SvelteKit 2 (Svelte 5 runes), Three.js and a fully static build.

```sh
npm install
npm run dev
```

Requires Node **20.19+** (`engine-strict` is on).

## What it does

Scrolling the page drives a single normalised progress value (0 → 1). That value is
mapped onto eight narrative chapters, and every chapter has a _director_ that poses
the camera, the phone and the exploded component stack. The DOM sections and the 3D
scenes read the same chapter table, so text and visuals can never drift apart.

- **8 chapters** — hero, design, architecture, display, compute, camera, battery, close.
- **Exploded view** — procedurally generated layer stack (glass, OLED, frame, board, battery, back).
- **Live configurator** — model, finish and storage picks, with the finish applied to the real material.
- **Hotspots** — 3D anchors projected into DOM labels, only shown on the chapters where they mean something.
- **Detail gallery** — buttons plus arrow-key and swipe navigation.
- **Spec table and footer** — the boring but necessary product facts.

## Architecture

```
src/lib/
  data/product.js        single source of truth: chapters, layers, models,
                         finishes, storage, gallery, specs + progress helpers
  3d/phoneEngine.js      renderer, lights, model loading, hotspot projection,
                         adaptive pixel-ratio, context-loss recovery, disposal
  3d/CinematicRig.js     camera + subject poses, framerate-independent damping
  3d/ScrollController.js scroll → smoothed progress, measured on one element
  3d/scenes/sceneManager.js  per-chapter directors
  3d/ParticleSystem.js   accent-tinted ambient particles
  3d/LabelSystem.js      3D→2D label projection helpers
  3d/modelPipeline.js    procedural PMREM environment + model normalisation
  actions/               reveal-on-scroll, carousel keyboard/swipe nav
  components/            header, loader, progress rail, configurator,
                         gallery, hotspots
  styles/app.css         design tokens and global primitives
```

### Design decisions worth knowing

- **Data first.** Chapter ranges, copy, and accents live in `product.js`. Adding a
  chapter means editing one array — the rail, the nav, the sections and the
  director lookup all follow.
- **Progress is measured against the cinematic region**, not the whole document, so
  the static sections below (configurator, gallery, specs) don't compress the
  animation.
- **Frame-rate independent smoothing** (`1 - exp(-k·dt)`) everywhere, so a 144 Hz
  monitor and a throttled tab converge on the same motion.
- **Graceful degradation.** No WebGL, a failed model load, or a lost GL context all
  fall back to the plain DOM content instead of a blank screen, and the loader has a
  hard timeout so it can never trap the user.
- **Accessibility.** Skip link, labelled sections and landmarks, real buttons for
  every interaction, `prefers-reduced-motion` honoured by both the scroll smoothing
  and the idle animations, and the canvas marked decorative because all information
  also exists as text.
- **Performance.** Adaptive pixel ratio driven by measured FPS, rendering paused when
  the tab is hidden or the canvas is off-screen, and full GPU-resource disposal on
  teardown.

## Scripts

| Script                            | What it does                               |
| --------------------------------- | ------------------------------------------ |
| `npm run dev`                     | Dev server                                 |
| `npm run build`                   | Static production build into `build/`      |
| `npm run preview`                 | Serve the production build                 |
| `npm test`                        | Unit tests (Vitest, jsdom)                 |
| `npm run check`                   | `svelte-check` with `checkJs` + `strict`   |
| `npm run lint` / `npm run format` | Prettier check / write                     |
| `npm run verify`                  | lint → check → test → build (what CI runs) |

## Testing

Unit tests cover the pure logic: chapter lookup and local progress, scroll mapping
and smoothing, the rig's damping and pose interpolation, and every chapter director
(including that each one is reachable and never leaves both phone groups hidden).
The engine tests exercise the parts that don't need a real GPU.

## Deploying

`npm run build` emits a plain static site (`adapter-static`, prerendered, with
`404.html` as the fallback). Upload `build/` to any static host — GitHub Pages,
Netlify, Cloudflare Pages, S3. No server runtime required.

## Licence

Concept demo. The NOVA ONE product, name and specifications are fictional.
