# CAD Wind Tunnel plan

A website where someone uploads a 3D/CAD model and watches it sit in a virtual wind tunnel, with smoke streams flowing around it, a pressure map painted on its surface and live readouts for drag.

## What real wind tunnels look like (and what we borrow)

- Test section: a long rectangular chamber with glass walls, a floor turntable the model sits on, and a contraction cone upstream. We render this as a translucent box with a grid floor and a turntable.
- Smoke visualization: smoke rakes release thin streams in front of the model so you can see the air split and curl around it. We draw streamlines and moving particles.
- Pressure-sensitive paint / CFD heat maps: red where air hits hard (high pressure), blue where it speeds up (low pressure). We color the model's surface the same way.
- Control room panel: airspeed, yaw angle on the turntable, and a balance readout (drag force). We put these in a side panel.

## Physics scope

Real wind tunnel results need computational fluid dynamics (CFD), which is far too heavy for a browser draft. Phase 1 uses potential flow around a shape that approximates the model (an ellipsoid fitted to its bounding box) plus a surface pressure estimate from each face's angle to the wind. It reacts to the model's size and orientation. Faces past about 90 degrees from the wind blend to a constant base suction (separated flow) and the particles get a simple slowed, jittery wake behind the model; this is a visual approximation, not turbulence. The numbers are not engineering results, and the UI says so.

## Phases

### Phase 1: simple draft (this PR)
1. Scaffold: Vite + React + TypeScript + three.js (react-three-fiber). Runs entirely in the browser, no backend, nothing saved.
2. Upload: one model at a time, drag-and-drop or file picker. Accepts `.stl`, `.obj`, `.glb`, `.ply`, up to 50 MB. A new upload replaces the old one.
3. Tunnel scene: glass test section, floor, turntable, model auto-centered and scaled to fit.
4. Flow visualization: smoke streamlines and animated particles from potential flow around the fitted ellipsoid.
5. Pressure map on the model surface.
6. Control panel: wind speed, yaw angle, model units (mm / cm / m / in), drag coefficient guess; readouts for frontal area, dynamic pressure and estimated drag force.
7. Tests for the pure logic (upload validation, flow field, pressure, drag math).

### Phase 2: real CAD formats
- Done: STEP / IGES support via OpenCASCADE compiled to WebAssembly (`occt-import-js`), loaded on demand since it is several MB.
- Done: STEP/IGES parsing runs in a Web Worker with a 60 second watchdog.
- Remaining: B-rep (`.brep`) import if users ask for it.
- Remaining: better frontal area: rasterize the model's silhouette instead of using the bounding box.

### Phase 3: better physics
- Run a real solver server-side (OpenFOAM in a container, or a GPU lattice-Boltzmann solver) as an async job. The browser uploads, polls for the result, and shows the computed flow field.
- Alternatively, a WebGPU lattice-Boltzmann solver in the browser for coarse but genuine CFD.

### Phase 4: accounts and storage
- Sign-in with Neon Auth, including Google. Neon Postgres holds users and our tables.
- Amazon S3 for the model files and solver results, uploaded with presigned URLs so files never pass through our API.
- A "my models" page to reopen past runs.
- The design and the first database migration are in [ACCOUNTS.md](ACCOUNTS.md). The tunnel keeps working without an account.

## Open questions
- Which CAD formats do users actually have? If most are STEP files from SolidWorks or Fusion, Phase 2 should come early.
- Is the goal education and intuition (Phase 1 physics is fine) or design decisions (needs Phase 3)?
