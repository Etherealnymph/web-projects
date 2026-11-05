# Vendored KaTeX 0.19.1

Source: official [`katex@0.19.1`](https://www.npmjs.com/package/katex/v/0.19.1), repository [KaTeX/KaTeX](https://github.com/KaTeX/KaTeX).

Package archive: `https://registry.npmjs.org/katex/-/katex-0.19.1.tgz`

npm integrity (also pinned in `package-lock.json`):

```
sha512-jG8uKntjSEcm2EpQOh0XturpPuuC9r3Sq5HLHdsFdWZT27E672SF19QEi+of0/YeOy15lDgRhKvr5614uRrEfA==
```

The ESM distribution `katex.mjs`, stylesheet `katex.min.css`, and the entire `fonts/` directory are copied unchanged from the package. The original MIT license is retained in `LICENSE`. `SHA256SUMS` identifies the renderer, stylesheet, and license shipped here. No CDN references are added; stylesheet font URLs resolve inside this folder.

Reproduce from the `silicon-notes` directory:

```sh
npm ci --ignore-scripts
node tools/prepare-katex.mjs
```

The copier refuses versions other than 0.19.1. The browser loads the checked-in files directly, without npm, a bundler, or a network formula service. The application wrapper `js/math.mjs` applies `trust: false`, bounded input/expansion/render counts, separate macro state for each formula, and escaped visible errors.

Upstream reference: [security](https://katex.org/docs/security.html), [rendering options](https://katex.org/docs/options.html). These are documentation links, not runtime dependencies.
