export const EW = (function () {
  // VNode factory
  function h(tag, props = {}, ...children) {
    const flat = [].concat(...children).map(c =>
      typeof c === "object" ? c : text(String(c))
    );
    return { tag, props: props || {}, children: flat, key: props && props.key };
  }
  function text(value) {
    return { tag: null, value };
  }

  // Create real DOM from VNode
  function createElement(vnode) {
    if (vnode.tag === null) {
      return document.createTextNode(vnode.value);
    }
    const el = typeof vnode.tag === "function"
      ? createComponent(vnode.tag, vnode.props, vnode.children)
      : document.createElement(vnode.tag);

    if (typeof vnode.tag !== "function") {
      setProps(el, vnode.props);
      vnode.children.forEach(c => el.appendChild(createElement(c)));
    }
    vnode.el = el;
    return el;
  }

  // Props handling (simple)
  function setProps(el, props) {
    for (let [k, v] of Object.entries(props)) {
      if (k === "className") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") {
        const ev = k.slice(2).toLowerCase();
        el.addEventListener(ev, v);
      } else if (k === "style" && typeof v === "object") {
        Object.assign(el.style, v);
      } else if (k === "ref" && typeof v === "function") {
        v(el);
      } else if (k !== "key") {
        el.setAttribute(k, v);
      }
    }
  }

  // Minimal component system
  class Component {
    constructor(props = {}) {
      this.props = props;
      this.state = {};
      this.__vnode = null;
      this.__el = null;
    }
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      this.__update();
    }
    __renderWrapper() {
      // child classes implement render()
      return this.render();
    }
    __mount() {
      const vnode = this.__renderWrapper();
      this.__vnode = vnode;
      const el = createElement(vnode);
      this.__el = el;
      if (this.componentDidMount) {
        setTimeout(() => this.componentDidMount(), 0);
      }
      return el;
    }
    __update() {
      const newVnode = this.__renderWrapper();
      const parent = this.__el && this.__el.parentNode;
      this.__vnode = diff(this.__vnode, newVnode, parent);
      this.__el = this.__vnode && this.__vnode.el;
      if (this.componentDidUpdate) {
        setTimeout(() => this.componentDidUpdate(), 0);
      }
    }
  }

  // When a VNode tag is a function (component), instantiate or call
  function createComponent(Tag, props, children) {
    if (Tag.prototype && Tag.prototype.render) {
      // Class component
      const instance = new Tag(Object.assign({}, props, { children }));
      const el = instance.__mount();
      // store linkage on element for future updates
      el.__ew_instance = instance;
      return el;
    } else {
      // Functional component
      const vnode = Tag(Object.assign({}, props, { children }));
      return createElement(vnode);
    }
  }

  // Diff algorithm (very small, keyed children supported)
  function diff(oldVNode, newVNode, parent) {
    if (!oldVNode) {
      const el = createElement(newVNode);
      if (parent) parent.appendChild(el);
      return newVNode;
    }
    if (!newVNode) {
      // remove
      if (oldVNode.el && oldVNode.el.parentNode) {
        oldVNode.el.parentNode.removeChild(oldVNode.el);
      }
      return null;
    }

    // Text node
    if (oldVNode.tag === null && newVNode.tag === null) {
      if (oldVNode.value !== newVNode.value) {
        oldVNode.el.textContent = newVNode.value;
        newVNode.el = oldVNode.el;
      } else {
        newVNode.el = oldVNode.el;
      }
      return newVNode;
    }

    // Different tags or component/function -> replace
    const oldTag = oldVNode.tag;
    const newTag = newVNode.tag;
    const oldIsComp = typeof oldTag === "function";
    const newIsComp = typeof newTag === "function";

    if (oldTag !== newTag || oldIsComp !== newIsComp) {
      const el = createElement(newVNode);
      if (oldVNode.el && oldVNode.el.parentNode) {
        oldVNode.el.parentNode.replaceChild(el, oldVNode.el);
      }
      return newVNode;
    }

    // Same tag, update props and diff children
    const el = (newVNode.el = oldVNode.el);
    updateProps(el, oldVNode.props || {}, newVNode.props || {});

    // If component instance existed on element, call its internal update
    if (el && el.__ew_instance) {
      el.__ew_instance.props = newVNode.props;
      el.__ew_instance.__update();
      newVNode.el = el.__ew_instance.__el;
      return newVNode;
    }

    // Diff children (simple keyed support)
    reconcileChildren(el, oldVNode.children || [], newVNode.children || []);
    return newVNode;
  }

  function updateProps(el, oldProps, newProps) {
    oldProps = oldProps || {};
    newProps = newProps || {};
    // remove old
    for (let k of Object.keys(oldProps)) {
      if (!(k in newProps)) {
        if (k === "className") el.className = "";
        else if (k.startsWith("on") && typeof oldProps[k] === "function") {
          el.removeEventListener(k.slice(2).toLowerCase(), oldProps[k]);
        } else {
          el.removeAttribute(k);
        }
      }
    }
    // set new
    setProps(el, newProps);
  }

  function reconcileChildren(parentEl, oldChildren, newChildren) {
    // Keyed diff: build map for old children
    const oldKeyed = {};
    const oldNonKeyed = [];
    oldChildren.forEach(c => {
      if (c && c.props && c.props.key != null) oldKeyed[c.props.key] = c;
      else oldNonKeyed.push(c);
    });
    const newEls = [];
    let lastPlaced = null;
    newChildren.forEach((c, i) => {
      const key = c && c.props && c.props.key;
      const old = key != null ? oldKeyed[key] : oldNonKeyed.shift();
      const newNode = diff(old || null, c, parentEl);
      if (newNode && newNode.el) {
        // insert or move DOM node to correct position
        const refNode = parentEl.childNodes[i] || null;
        if (newNode.el !== refNode) parentEl.insertBefore(newNode.el, refNode);
      }
      newEls.push(newNode);
    });
    // remove leftover old keyed/non-keyed nodes not reused
    (Object.values(oldKeyed).concat(oldNonKeyed)).forEach(c => {
      if (c && c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
    });
  }

  // mount top-level vnode (renders to container)
  function mount(vnode, container) {
    container = typeof container === "string" ? document.querySelector(container) : container;
    if (!container) throw new Error("Container not found for mount()");
    const newEl = createElement(vnode);
    container.innerHTML = "";
    container.appendChild(newEl);
    return newEl;
  }

  // Tiny reactive store helper using Proxy
  function store(initial = {}) {
    const subs = new Set();
    const state = new Proxy(Object.assign({}, initial), {
      set(target, prop, value) {
        target[prop] = value;
        subs.forEach(fn => fn(state));
        return true;
      }
    });
    return {
      state,
      subscribe(fn) {
        subs.add(fn);
        return () => subs.delete(fn);
      }
    };
  }

  // Small hash router
  function createRouter(routes = {}) {
    const listeners = [];
    function onHashChange() {
      const hash = location.hash.replace(/^#/, "") || "/";
      const route = Object.keys(routes).find(r => matchRoute(r, hash)) || "*";
      const handler = routes[route];
      listeners.forEach(l => l(hash, route));
      if (typeof handler === "function") handler({ path: hash, route });
    }
    window.addEventListener("hashchange", onHashChange);
    // initial
    setTimeout(onHashChange, 0);
    return {
      on(fn) {
        listeners.push(fn);
        return () => {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      navigate(path) {
        location.hash = path;
      },
      destroy() {
        window.removeEventListener("hashchange", onHashChange);
      }
    };
  }

  function matchRoute(pattern, path) {
    if (pattern === "*") return true;
    // very small param-free matching and wildcard support
    if (pattern.endsWith("*")) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return pattern === path;
  }

  // Expose API
  return {
    h,
    text,
    createElement,
    mount,
    diff,
    Component,
    store,
    createRouter,
  };
})();
