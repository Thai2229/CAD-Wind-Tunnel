# CAD Wind Tunnel

Upload a 3D model and watch it sit in a virtual wind tunnel: smoke streamlines and particles flow around it, the surface is colored by pressure, and a control panel shows frontal area, dynamic pressure and estimated drag.

Everything runs in the browser. The file is read locally and never uploaded, and nothing is saved.

## Supported files

One model at a time, up to 50 MB: `.stl`, `.obj`, `.glb`, `.ply`. STL and PLY are treated as Z-up (the usual CAD export) and rotated upright. GLB defaults to meters, the others to millimeters; change the unit in the panel if your model differs.

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

## Layout

- `src/lib/`: pure logic with tests (upload validation, flow field, aero math, model loading)
- `src/components/`: the three.js scene and the control panel
- `docs/PLAN.md`: roadmap (STEP support, real CFD, accounts and S3 storage)
