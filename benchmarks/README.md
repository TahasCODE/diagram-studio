# Playback benchmark — 13 November 2026

This is a local frontend rendering experiment, not a service-load test, internet
demo measurement, or a guarantee for other computers. Raw observations and machine
details are committed in `results/baseline.json` and `results/after.json`.

## Workload and measurements

`npm run bench:fixtures` deterministically generates importable 100-node and
500-node version-1 project files. Each has one serpentine path visiting every node
once (99 or 499 edges), with no branching. Coordinates are deliberately dense in
the existing percentage-based canvas: this stresses routing and rendering, not
the readability of a diagram with hundreds of overlapping nodes. Branch-heavy
graphs, editing, drag latency, and mobile performance are outside this workload.

The runner opens the **real app and playback UI**, signed out, through its existing
read-only hash snapshot format. It does not use a simplified component harness.
The original 250-node limit would reject the larger fixture. Client validation,
editor controls, Java validation and OpenAPI now consistently allow 500 nodes;
frontend and Java boundary tests accept 500 and reject 501. The existing 500-step
limit and 1 MB payload limit are unchanged. Both measured variants use this cap.

Two metrics use the browser's monotonic clock:

- **Time to usable playback:** navigation time origin until all expected node
  elements exist, Service 001 is active and Next Step is enabled, followed by two
  animation frames. Includes parsing, bundle loading and initial rendering in the
  local preview; excludes authentication, database queries and remote publication
  loading. Dense nodes being mounted does not mean every label is legible.
- **Step-to-visible-update proxy:** from programmatic activation of the real Next
  Step button until the expected active-node label and progress value are in the
  DOM, followed by two animation frames. This gives a paint opportunity, not proof
  of physical display presentation. It excludes pointer dispatch, OS input latency
  and Playwright transport. Reduced motion disables UI transitions. Frame pacing
  puts a floor under small values; this is not an INP/Web Vitals measurement.

Each variant uses one discarded warm-up load per size, then 10 measured loads in
fresh browser contexts and 30 sequential steps per load: 300 update observations
per size. Median is the upper middle observation; p95 is nearest-rank. The 300
steps are clustered within 10 page loads, not 300 independent sessions. No timed
profiles or screenshots run during these measurements. A separate CPU profile
samples 10 additional steps after the final timed run, at a requested 1 ms
interval. Source maps attribute self samples to source files.

## Environment

Headless Google Chrome 157.0.8103.51; Node v26.13.0; Windows build 10.0.26300;
Intel Core i7-1185G7 at 3.00 GHz, 8 logical CPUs, approximately 15 GiB RAM.
Viewport 1440 × 1000, device scale 1, no CPU throttling, reduced motion enabled.
Both runs use the same machine and production build settings with source maps,
served by Vite preview at `127.0.0.1:5175`. Request routing disables HTTP caching;
each load uses a new context. External requests, including Google Fonts, are
blocked, so the system font fallback is used. The static preview has no API; no
accounts, database writes, SMTP or credentials are involved. Browser process and
OS file caches are not reset between loads. Other desktop activity was not
controlled; these are descriptive samples, not a lab-controlled causal estimate.

## Results

At **500 nodes**, median step latency went from **88.1 ms to 29.1 ms** (67% lower
in this run); p95 went from **168.9 ms to 97.3 ms**. Time to usable playback was
1370.1 → 1157.5 ms median, and 2035.7 → 1554.8 ms p95. Startup remains substantial
and variable; do not use this run to claim a general startup speedup.

At **100 nodes**, median step latency was **29.8 → 28.9 ms**, but p95 worsened
from **31.0 → 69.7 ms**. Time to usable playback also worsened: 428.2 → 540.2 ms
median and 548.7 → 904.3 ms p95. There is **no supported improvement claim at
100 nodes**. Scheduling noise, frame pacing and uncontrolled desktop activity
limit interpretation. No statistical significance or universal percentage is claimed.

The 500-node CPU profile attributed **58.5% of all samples to geometry code**
before the change and **0% after** during the sampled steps. Zero samples does
not imply zero total cost: initial layout, edits and resizing still route edges.
The 100-node baseline attributed only 3.1% to geometry, consistent with the
smaller workload having less to gain from this particular change.

## Change supported by profiling

The canvas previously rebuilt node boxes and reran obstacle-aware routing for
every edge on every playback step, although positions and connections had not
changed. Routing scores candidate segments against other node boxes, so that
repetition becomes costly with hundreds of edges and nodes.

`Canvas.tsx` now memoizes the node list, boxes, routes and branch-label placement
against their actual geometry inputs. Playback still updates active nodes,
active edges, progress and the minimap. Document edits, dragging, changed scenario
connections and viewport dimensions invalidate the cached geometry. The routing
algorithm and edge appearance are unchanged. This avoids repeated routing work;
it does not virtualize the DOM, solve dense layouts, or eliminate large-graph
startup cost. Guest tests cover forward/back/restart and geometry updates after
resize at both fixture sizes; existing browser tests cover the rest of the UI.

## Reproduce

Use a separate checkout for the baseline if you have uncommitted work. The
baseline benchmark commit is `345eef97a5fc198b75b9bc6c0aee282ba4fd28de`;
it contains the fixtures, runner and 500-node cap, with the original Canvas.
The later optimization commit in the same PR changes Canvas and adds the report.
Recorded runs occurred before those commits: their `commit` is the then-current
parent, while `sourceHashes`, asset names and `sourceDescription` identify the
measured variants. Hash annotations were added after the run without changing
measurements; `sourceHashesRecordedAfterRun` records that fact explicitly.

On each variant:

```powershell
npm ci
npm run bench:fixtures
npm run build -- --sourcemap
npm run preview -- --port 5175 --strictPort
```

In a second terminal, from the same checkout:

```powershell
npm run bench:playback -- baseline
# On the optimized checkout use a distinct output label:
npm run bench:playback -- after
```

Stop preview and rebuild between variants. Keep the browser, viewport, machine,
power settings and workload unchanged; avoid concurrent builds or tests. The
default is local Google Chrome; `CI=true` selects Playwright Chromium and must be
reported as a different environment. Set `BENCH_URL` for another local preview
port, or `BENCH_LOADS` (3–100) for more samples. The script never starts a server.
It writes raw JSON to `benchmarks/results/<label>.json` and CPU profiles to ignored
`.runtime/playback-profiles/`. Open profiles in Chrome DevTools' JavaScript
Profiler. Rebuild with `--sourcemap` so the runner can attribute samples.

`source-map-js` 1.2.2 is a direct development dependency for profiling. This exact
version was already in the dependency tree; declaring it directly avoids relying
on a transitive import. No browser runtime dependency was added. CPU profiles
are intentionally not committed; summary source counts and raw timing samples are.

For manual verification, export any current work, then use Project → Import
Project to open either fixture and confirm replacement. Switch to Playback and
try Next Step, Previous and Restart; resize the window and confirm connectors
follow the nodes. The guest hash-link browser tests exercise the same renderer
without overwriting a local draft. This work does not publish a public demo.
