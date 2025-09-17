# errorwix-core

**A tiny, zero-dependency JavaScript micro-framework** with a virtual DOM, component class, reactive `store`, and a tiny hash router.  
Perfect for small projects, demos, learning virtual DOM implementation, or building lightweight UI widgets to upload to GitHub.

---

## Repo name
`errorwix-core`

---

## What it does (quick)
- Provides `h(tag, props, ...children)` to create VNodes (JSX-style).
- Minimal virtual DOM with `diff()` and patching.
- `Component` base class with `setState()` lifecycle hooks.
- `store()` reactive state helper (subscribe + simple Proxy).
- `createRouter()` — small hash-based router.
- `mount()` to attach VNodes to a real DOM container.

Designed to be intentionally small and readable so you can extend it. Use as an ES module or bundle.

---

## Quick start

### 1) Add to your repo
Save `errorwix-core.js` in `src/` or `lib/` and import:

```html
<!-- example using native modules -->
<script type="module">
import { h, mount, Component, store, createRouter } from './errorwix-core.js';

// ...example below...
</script>
