(function () {
  "use strict";

  const STORAGE_KEY = "easychat-doc-lang";
  const NAV_PATH = "doc-shell/nav.json";
  /** One markdown per language, split with <!-- doc-shell:page slug="..." --> */
  const DOCS_FILE = (lang) => `content/${lang}/docs.md`;

  const pagesByLang = { es: null, en: null };

  const PAGE_SLUGS = new Set([
    "overview",
    "features",
    "requirements",
    "installation",
    "architecture",
    "first-use",
    "node-easychat",
    "config-resource",
    "chatcommand-resource",
    "singleton",
    "signals",
    "keyboard",
    "messages",
    "commands",
    "multiplayer",
    "animations",
    "notifications",
    "sounds",
    "editor-preview",
    "limitations",
    "scaling",
    "modifying",
    "troubleshooting",
    "credits",
  ]);

  const LEGACY_HASH_TO_PAGE = {
    "tabla-de-contenidos": "overview",
    "table-of-contents": "overview",
    caracteristicas: "features",
    características: "features",
    features: "features",
    "requisitos-y-dependencias": "requirements",
    "requirements-and-dependencies": "requirements",
    instalacion: "installation",
    instalación: "installation",
    installation: "installation",
    "arquitectura-del-addon": "architecture",
    "addon-architecture": "architecture",
    "primer-uso-paso-a-paso": "first-use",
    "first-time-use-step-by-step": "first-use",
    "nodo-easychat-control": "node-easychat",
    "easychat-node-control": "node-easychat",
    "recurso-easychatconfig": "config-resource",
    easychatconfig: "config-resource",
    "easychatconfig-resource": "config-resource",
    "recurso-chatcommand": "chatcommand-resource",
    chatcommand: "chatcommand-resource",
    "chatcommand-resource": "chatcommand-resource",
    "singleton-global-easychat": "singleton",
    "global-easychat-singleton": "singleton",
    senales: "signals",
    señales: "signals",
    signals: "signals",
    "entrada-de-teclado-y-foco": "keyboard",
    "keyboard-input-and-focus": "keyboard",
    "mensajes-formato-y-colores": "messages",
    "messages-formatting-and-colours": "messages",
    "messages-formatting-and-colors": "messages",
    "comandos--y-autocompletado": "commands",
    "commands--and-autocomplete": "commands",
    "multijugador-con-linkux": "multiplayer",
    "multiplayer-with-linkux": "multiplayer",
    animaciones: "animations",
    animations: "animations",
    "notificaciones-flotantes": "notifications",
    "floating-notifications": "notifications",
    sonidos: "sounds",
    sounds: "sounds",
    "vista-previa-en-el-editor": "editor-preview",
    "editor-preview": "editor-preview",
    "limitaciones-y-convenciones": "limitations",
    "limitations-and-conventions": "limitations",
    "escalar-el-chat-en-produccion": "scaling",
    "escalar-el-chat-en-producción": "scaling",
    "scaling-chat-in-production": "scaling",
    "modificar-el-addon-internamente": "modifying",
    "modifying-the-addon-internally": "modifying",
    "solucion-de-problemas": "troubleshooting",
    "solución-de-problemas": "troubleshooting",
    troubleshooting: "troubleshooting",
    creditos: "credits",
    créditos: "credits",
    credits: "credits",
  };

  const UI = {
    es: {
      skip: "Saltar al contenido",
      tagline: "Documentación oficial",
      language: "Idioma",
      navHeading: "Documentación",
      onThisPage: "En esta página",
      loading: "Cargando…",
      footerNote: "Documentación basada en el código fuente del addon",
      serveHint: "Por IUX Games Team",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      docTitle: "EasyChat",
      search: "Buscar",
      searchPlaceholder: "Propiedades, API, comandos…",
      searchEmpty: "Sin resultados",
      searchHint: "↑↓ navegar · Enter abrir · Esc cerrar",
    },
    en: {
      skip: "Skip to content",
      tagline: "Official documentation",
      language: "Language",
      navHeading: "Documentation",
      onThisPage: "On this page",
      loading: "Loading…",
      footerNote: "Documentation based on the addon source code.",
      serveHint: "By IUX Games Team",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      docTitle: "EasyChat",
      search: "Search",
      searchPlaceholder: "Properties, API, commands…",
      searchEmpty: "No results",
      searchHint: "↑↓ navigate · Enter open · Esc close",
    },
  };

  let navData = null;
  let searchIndex = [];
  let searchFiltered = [];
  let searchActiveIndex = 0;

  const docEl = document.getElementById("doc-content");
  const tocEl = document.getElementById("toc");
  const navMount = document.getElementById("nav-groups");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  const navToggle = document.getElementById("nav-toggle");
  const langEs = document.getElementById("lang-es");
  const langEn = document.getElementById("lang-en");
  const brandLink = document.getElementById("brand-link");
  const searchModal = document.getElementById("search-modal");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const searchTrigger = document.getElementById("search-trigger");

  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
    const nav = navigator.language || "";
    return nav.toLowerCase().startsWith("es") ? "es" : "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === "es" ? "es" : "en";
    applyChromeI18n(lang);
    langEs.setAttribute("aria-pressed", lang === "es" ? "true" : "false");
    langEn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
  }

  function humanPageLabel(slug, lang) {
    const labels = {
      es: {
        overview: "Descripción general",
        features: "Características",
        requirements: "Requisitos",
        installation: "Instalación",
        architecture: "Arquitectura",
        "first-use": "Primer uso",
        "node-easychat": "Nodo EasyChat",
        "config-resource": "EasyChatConfig",
        "chatcommand-resource": "ChatCommand",
        singleton: "Singleton EasyChat",
        signals: "Señales",
        keyboard: "Teclado y foco",
        messages: "Mensajes",
        commands: "Comandos",
        multiplayer: "LinkUx",
        animations: "Animaciones",
        notifications: "Notificaciones",
        sounds: "Sonidos",
        "editor-preview": "Vista en editor",
        limitations: "Limitaciones",
        scaling: "Escalar",
        modifying: "Modificar internamente",
        troubleshooting: "Problemas",
        credits: "Créditos",
      },
      en: {
        overview: "Overview",
        features: "Features",
        requirements: "Requirements",
        installation: "Installation",
        architecture: "Architecture",
        "first-use": "First-time use",
        "node-easychat": "EasyChat node",
        "config-resource": "EasyChatConfig",
        "chatcommand-resource": "ChatCommand",
        singleton: "EasyChat singleton",
        signals: "Signals",
        keyboard: "Keyboard & focus",
        messages: "Messages",
        commands: "Commands",
        multiplayer: "LinkUx",
        animations: "Animations",
        notifications: "Notifications",
        sounds: "Sounds",
        "editor-preview": "Editor preview",
        limitations: "Limitations",
        scaling: "Scaling",
        modifying: "Internal changes",
        troubleshooting: "Troubleshooting",
        credits: "Credits",
      },
    };
    return labels[lang]?.[slug] || slug;
  }

  function applyChromeI18n(lang) {
    const t = UI[lang];
    const slug = getPageFromHash();
    document.title = `${t.docTitle} — ${humanPageLabel(slug, lang)}`;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && t[key]) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key && t[key]) el.setAttribute("placeholder", t[key]);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key && t[key]) el.setAttribute("aria-label", t[key]);
    });
    if (navToggle && !sidebar.classList.contains("is-open")) {
      navToggle.setAttribute("aria-label", t.openMenu);
    }
    const lbl = searchTrigger?.querySelector(".search-trigger-label");
    if (lbl) lbl.textContent = t.search;
    const mac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || "");
    const kbd = searchTrigger?.querySelectorAll("kbd");
    if (kbd && kbd.length >= 2) {
      kbd[0].textContent = mac ? "⌘" : "Ctrl";
      kbd[1].textContent = "K";
    }
  }

  function closeMobileNav() {
    sidebar.classList.remove("is-open");
    backdrop.hidden = true;
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", UI[getLang()].openMenu);
    }
  }

  function openMobileNav() {
    sidebar.classList.add("is-open");
    backdrop.hidden = false;
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", UI[getLang()].closeMenu);
    }
  }

  function normalizeHashKey(h) {
    try {
      h = decodeURIComponent(h).normalize("NFD").replace(/\p{M}/gu, "");
    } catch (_) {
      try {
        h = decodeURIComponent(h).toLowerCase();
      } catch (_) {
        h = String(h).toLowerCase();
      }
    }
    return h.toLowerCase().replace(/\s+/g, "-");
  }

  function getPageFromHash() {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) return navData?.defaultPage || "overview";
    const base = raw.split("/")[0].split("?")[0];
    if (PAGE_SLUGS.has(base)) return base;
    const legacy = LEGACY_HASH_TO_PAGE[normalizeHashKey(base)];
    if (legacy && PAGE_SLUGS.has(legacy)) return legacy;
    return navData?.defaultPage || "overview";
  }

  function getSubHash() {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    const parts = raw.split("/");
    if (parts.length < 2) return "";
    return parts.slice(1).join("/");
  }

  function configureMarked() {
    if (typeof marked === "undefined") return;
    if (typeof marked.setOptions === "function") {
      marked.setOptions({
        gfm: true,
        breaks: false,
        headerIds: true,
        mangle: false,
      });
    }
    if (typeof marked.use === "function") {
      try {
        marked.use({ gfm: true, mangle: false, headerIds: true });
      } catch (_) {}
    }
  }

  function slugify(text) {
    try {
      text = text.normalize("NFD").replace(/\p{M}/gu, "");
    } catch (_) {}
    let slug = text.toLowerCase().trim().replace(/\s+/g, "-");
    try {
      slug = slug.replace(/[^\p{L}\p{N}-]/gu, "");
    } catch (_) {
      slug = slug.replace(/[^a-z0-9-]/g, "");
    }
    return slug.replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  function ensureHeadingIds(container) {
    const used = new Set();
    container.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
      if (h.id) {
        used.add(h.id);
        return;
      }
      let base = slugify(h.textContent || "");
      if (!base) base = "section";
      let id = base;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      h.id = id;
      used.add(id);
    });
  }

  function rewriteInternalLinks(container) {
    container.querySelectorAll('a[href^="#"]').forEach((a) => {
      let raw = a.getAttribute("href").slice(1);
      const segments = raw.split("/").filter(Boolean);
      let targetPage = "";
      let targetAnchor = "";

      if (segments.length >= 2 && PAGE_SLUGS.has(segments[0])) {
        targetPage = segments[0];
        targetAnchor = segments.slice(1).join("/");
      } else if (segments.length === 1) {
        const key = normalizeHashKey(segments[0]);
        const legacy = LEGACY_HASH_TO_PAGE[key];
        if (legacy) {
          targetPage = legacy;
        } else if (PAGE_SLUGS.has(segments[0])) {
          targetPage = segments[0];
        }
      }

      if (!targetPage) return;

      const href = targetAnchor ? `#${targetPage}/${targetAnchor}` : `#${targetPage}`;
      a.setAttribute("href", href);
      a.onclick = function (e) {
        e.preventDefault();
        const cur = getPageFromHash();
        if (cur === targetPage && targetAnchor) {
          const el = docEl.querySelector(`#${CSS.escape(targetAnchor)}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", href);
        } else {
          location.hash = href;
        }
        closeMobileNav();
      };
    });
  }

  function buildToc(container) {
    tocEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    const page = getPageFromHash();
    container.querySelectorAll("h2, h3").forEach((h) => {
      if (!h.id) return;
      const a = document.createElement("a");
      a.href = `#${page}/${h.id}`;
      a.textContent = h.textContent.replace(/\s+/g, " ").trim();
      if (h.tagName === "H3") a.classList.add("toc-h3");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        history.replaceState(null, "", `#${page}/${h.id}`);
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        closeMobileNav();
      });
      frag.appendChild(a);
    });
    tocEl.appendChild(frag);
  }

  function scrollToHeadingFromHash() {
    const sub = getSubHash();
    if (!sub) return;
    requestAnimationFrame(() => {
      const el = docEl.querySelector(`#${CSS.escape(sub)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function initScrollSpy(container) {
    const links = [...tocEl.querySelectorAll("a")];
    if (!links.length) return;
    const page = getPageFromHash();
    const topGap = 96;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((a) => {
            const on = a.getAttribute("href") === `#${page}/${id}`;
            a.classList.toggle("active", on);
          });
        });
      },
      { rootMargin: `-${topGap}px 0px -65% 0px`, threshold: 0 }
    );
    container.querySelectorAll("h2, h3").forEach((h) => {
      if (h.id) observer.observe(h);
    });
  }

  function renderNavSidebar(lang) {
    if (!navMount || !navData) return;
    navMount.innerHTML = "";
    const frag = document.createDocumentFragment();
    const current = getPageFromHash();
    navData.groups.forEach((g) => {
      const groupEl = document.createElement("div");
      groupEl.className = "nav-group";
      const label = document.createElement("p");
      label.className = "nav-group-label";
      label.textContent = g.titles[lang] || g.titles.en;
      groupEl.appendChild(label);
      const pages = document.createElement("div");
      pages.className = "nav-pages";
      g.items.forEach((slug) => {
        const a = document.createElement("a");
        a.href = `#${slug}`;
        a.textContent = humanPageLabel(slug, lang);
        if (slug === current) a.classList.add("active");
        a.addEventListener("click", () => closeMobileNav());
        pages.appendChild(a);
      });
      groupEl.appendChild(pages);
      frag.appendChild(groupEl);
    });
    navMount.appendChild(frag);
  }

  function updateNavActive() {
    if (!navMount) return;
    const cur = getPageFromHash();
    navMount.querySelectorAll("a").forEach((a) => {
      const slug = (a.getAttribute("href") || "").replace(/^#/, "");
      a.classList.toggle("active", slug === cur);
    });
  }

  async function loadNav() {
    const res = await fetch(NAV_PATH, { cache: "no-cache" });
    if (!res.ok) throw new Error(NAV_PATH);
    navData = await res.json();
  }

  function parseDocShellPages(md) {
    const pages = {};
    const re = /<!--\s*doc-shell:\s*page\s+slug="([^"]+)"\s*-->\s*/g;
    const matches = [...md.matchAll(re)];
    if (!matches.length) return pages;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const slug = m[1];
      const start = m.index + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
      pages[slug] = md.slice(start, end).trim();
    }
    return pages;
  }

  function firstHeadingFromMd(md) {
    for (const line of md.split("\n")) {
      if (line.startsWith("#")) return line.replace(/^#+\s*/, "").trim();
    }
    return "";
  }

  function stripMdForSearch(s, maxLen) {
    const lim = maxLen || 2000;
    let t = s.replace(/```[\s\S]*?```/g, " ");
    t = t.replace(/`([^`]+)`/g, "$1");
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    t = t.replace(/[#*_|\-]+/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    return t.length > lim ? t.slice(0, lim) + "…" : t;
  }

  function rebuildSearchIndex() {
    searchIndex = [];
    ["es", "en"].forEach((lang) => {
      const p = pagesByLang[lang];
      if (!p) return;
      Object.keys(p).forEach((slug) => {
        const body = p[slug];
        searchIndex.push({
          lang,
          slug,
          title: firstHeadingFromMd(body),
          text: stripMdForSearch(body, 2000),
        });
      });
    });
  }

  async function ensureDocsParsed(lang) {
    if (pagesByLang[lang]) return;
    const path = DOCS_FILE(lang);
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) {
      pagesByLang[lang] = {};
      rebuildSearchIndex();
      throw new Error(path);
    }
    const md = await res.text();
    pagesByLang[lang] = parseDocShellPages(md);
    rebuildSearchIndex();
  }

  async function loadPage(lang, slug) {
    const t = UI[lang];
    docEl.innerHTML = `<p class="loading">${t.loading}</p>`;
    try {
      await ensureDocsParsed(lang);
    } catch (e) {
      docEl.innerHTML = `<p class="loading">Error loading <code>${DOCS_FILE(lang)}</code>.</p>`;
      return;
    }
    const md = pagesByLang[lang][slug];
    if (md == null || md === "") {
      docEl.innerHTML = `<p class="loading">Página desconocida: <code>${slug}</code>.</p>`;
      return;
    }
    configureMarked();
    const html =
      typeof marked !== "undefined" && marked.parse
        ? marked.parse(md)
        : `<pre>${md.replace(/</g, "&lt;")}</pre>`;
    docEl.innerHTML = html;
    ensureHeadingIds(docEl);
    rewriteInternalLinks(docEl);
    buildToc(docEl);
    initScrollSpy(docEl);
    applyChromeI18n(lang);
    renderNavSidebar(lang);
    updateNavActive();
    if (brandLink) brandLink.href = `#${navData?.defaultPage || "overview"}`;
    scrollToHeadingFromHash();
  }

  function openSearch() {
    if (!searchModal) return;
    searchModal.hidden = false;
    applyChromeI18n(getLang());
    searchFiltered = filterSearch("");
    searchActiveIndex = 0;
    renderSearchResults();
    setTimeout(() => searchInput?.focus(), 10);
  }

  function closeSearch() {
    if (!searchModal) return;
    searchModal.hidden = true;
    if (searchInput) searchInput.value = "";
  }

  function filterSearch(q) {
    const lang = getLang();
    const needle = q.trim().toLowerCase();
    const pool = searchIndex.filter((e) => e.lang === lang);
    if (!needle) return pool.slice(0, 24);
    return pool
      .map((e) => {
        const t = `${e.title} ${e.text}`.toLowerCase();
        const idx = t.indexOf(needle);
        return { entry: e, score: idx === -1 ? -1 : idx };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title))
      .slice(0, 24)
      .map((x) => x.entry);
  }

  function renderSearchResults() {
    if (!searchResults) return;
    const t = UI[getLang()];
    searchResults.innerHTML = "";
    if (!searchFiltered.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = t.searchEmpty;
      searchResults.appendChild(empty);
      return;
    }
    searchFiltered.forEach((e, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "search-result";
      btn.setAttribute("aria-selected", i === searchActiveIndex ? "true" : "false");
      btn.innerHTML =
        "<div class=\"search-result-title\"></div><div class=\"search-result-meta\"></div><div class=\"search-result-snippet\"></div>";
      btn.querySelector(".search-result-title").textContent = e.title;
      btn.querySelector(".search-result-meta").textContent = e.slug;
      btn.querySelector(".search-result-snippet").textContent = e.text || "";
      btn.addEventListener("click", () => {
        location.hash = e.slug;
        closeSearch();
      });
      searchResults.appendChild(btn);
    });
  }

  function onSearchInput() {
    searchFiltered = filterSearch(searchInput.value);
    searchActiveIndex = 0;
    renderSearchResults();
  }

  function onSearchKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchActiveIndex = Math.min(
        searchActiveIndex + 1,
        Math.max(0, searchFiltered.length - 1)
      );
      renderSearchResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchActiveIndex = Math.max(searchActiveIndex - 1, 0);
      renderSearchResults();
    } else if (e.key === "Enter" && searchFiltered[searchActiveIndex]) {
      e.preventDefault();
      location.hash = searchFiltered[searchActiveIndex].slug;
      closeSearch();
    }
  }

  async function route() {
    const lang = getLang();
    const slug = getPageFromHash();
    await loadPage(lang, slug);
  }

  langEs.addEventListener("click", async () => {
    setLang("es");
    await route();
    if (searchModal && !searchModal.hidden) {
      onSearchInput();
    }
  });

  langEn.addEventListener("click", async () => {
    setLang("en");
    await route();
    if (searchModal && !searchModal.hidden) {
      onSearchInput();
    }
  });

  navToggle.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) closeMobileNav();
    else openMobileNav();
  });

  backdrop.addEventListener("click", closeMobileNav);

  window.addEventListener("hashchange", () => {
    route();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMobileNav();
      closeSearch();
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchModal && !searchModal.hidden) closeSearch();
      else openSearch();
    }
  });

  searchTrigger?.addEventListener("click", openSearch);
  searchModal?.addEventListener("click", (e) => {
    if (e.target === searchModal) closeSearch();
  });
  searchInput?.addEventListener("input", onSearchInput);
  searchInput?.addEventListener("keydown", onSearchKeydown);

  (async function init() {
    const lang = getLang();
    setLang(lang);
    try {
      await loadNav();
    } catch (e) {
      docEl.innerHTML = `<p class="loading">Missing <code>${NAV_PATH}</code>.</p>`;
      return;
    }
    const def = navData.defaultPage || "overview";
    if (!location.hash || location.hash === "#") {
      history.replaceState(null, "", `#${def}`);
    }
    await route();
  })();
})();
