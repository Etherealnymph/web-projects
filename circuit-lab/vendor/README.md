# Vendored ngspice WebAssembly

Pinned package `@o.z/ngspice-wasm@0.0.0`, npm tarball shasum `d8b356f3dcb8365348fc3d72663a8fad9b93aedd`. The embedded engine identifies itself as ngspice-46, build 2026-05-27.

The original JavaScript wrapper did not export its internal `callMain`, although the compiled CLI is present. The sole wrapper change inserts `Module["callMain"]=callMain;` immediately before `preInit();run();`. Binary bytes are unchanged. `tools/prepare-vendor.mjs` reproducibly applies this edit to the pinned npm package and copies both license files. Engine input/output is handled in `js/engine.mjs`.

The upstream build probes `/proc/meminfo`. The browser MEMFS receives an explicitly emulated 256 MiB environment description so that ngspice's output-memory setup succeeds. This does not report the user's actual host memory. Each browser run uses a new disposable Worker and module instance; a 45-second timeout terminates it. Project, output-file and parsed-result budgets are checked separately.

Rebuild wrapper from the package using `npm pack @o.z/ngspice-wasm@0.0.0`, extract it, then run `node tools/prepare-vendor.mjs /path/to/package` from the project folder.

Upstream build infrastructure and corresponding source references are available at [z-wasm/ngspice-wasm](https://github.com/z-wasm/ngspice-wasm/tree/zero) and [ngspice source](https://sourceforge.net/p/ngspice/ngspice/ci/ngspice-46/tree/). The upstream wrapper is BSD-3-Clause; ngspice contains multiple licenses, reproduced in `NGSPICE-COPYING.txt`. Preserve license notices when redistributing. CircuitJS is an interaction reference, and its source/assets are not bundled here.
