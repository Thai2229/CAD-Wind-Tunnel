# CAD Wind Tunnel

Upload a 3D model and watch it sit in a virtual wind tunnel: smoke streamlines and particles flow around it, the surface is colored by pressure, and a control panel shows frontal area, dynamic pressure and estimated drag.

Everything runs in the browser. The file is read locally and never uploaded, and nothing is saved.

## Supported files

One model at a time, up to 50 MB: `.stl`, `.obj`, `.glb`, `.ply`, `.step`/`.stp` and `.iges`/`.igs`. STL, PLY, STEP and IGES are treated as Z-up (the usual CAD export) and rotated upright. GLB defaults to meters, the others to millimeters; change the unit in the panel if your model differs.

STEP and IGES files are converted to a triangle mesh in your browser with occt-import-js. It is about 7.6 MB of WebAssembly and is only downloaded when you drop a STEP or IGES file. STEP and IGES files are capped at 20 MB.

Parsing runs in a background worker, so a heavy file cannot freeze the page, and it is stopped with a friendly message if the reader takes more than 30 seconds to start or the parse takes more than 60 seconds. Dropping another file cancels a parse in progress. The library needs `'unsafe-eval'`, so only the worker script is allowed to use it: the page's content security policy has no `'unsafe-eval'`, and `vercel.json` sends a separate policy for the worker file (same-origin scripts and requests only). `vite preview` and `npm run dev` do not send that header; the worker still runs there because a worker script without its own policy is not restricted by the page's.

## About the physics

This is a visualization, not CFD. The flow is potential flow around an ellipsoid fitted to the model's bounding box, and the surface pressure comes from each face's angle to the wind. It responds to size and yaw and gives a feel for where air speeds up and where it piles up, but it has no wake or turbulence, and the drag number depends on the Cd you enter. See [docs/PLAN.md](docs/PLAN.md) for how real solvers fit in later.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm test` (vitest), `npm run lint` (oxlint), `npm run build`, `npm run preview`.

## Third-party notices

STEP and IGES import uses [occt-import-js](https://github.com/kovacsv/occt-import-js) (LGPL-2.1), which is built on [Open CASCADE Technology](https://dev.opencascade.org/) (LGPL-2.1 with the OCCT exception). The library is bundled unmodified as a separate WebAssembly file; the license texts ship in `node_modules/occt-import-js/dist/`.

## License

MIT, see [LICENSE](LICENSE). Third-party components keep their own licenses, listed above.

## Layout

- `src/lib/`: pure logic with tests (upload validation, flow field, aero math, model loading)
- `src/components/`: the three.js scene and the control panel
- `docs/PLAN.md`: roadmap (real CFD, accounts and S3 storage)
- `docs/DEPLOYMENT.md`: Vercel setup, branch flow and the S3 plan
