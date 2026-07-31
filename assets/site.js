(() => {
  "use strict";

  const storageKey = "yuri-classification-theme";
  const allowedPreferences = new Set(["system", "light", "dark"]);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const desktopNavigation = window.matchMedia("(min-width: 921px)");

  function currentPreference() {
    const value = document.documentElement.dataset.themePreference;
    return allowedPreferences.has(value) ? value : "system";
  }

  function resolveTheme(preference) {
    if (preference === "dark" || preference === "light") return preference;
    return systemTheme.matches ? "dark" : "light";
  }

  function updateThemeColors(preference, theme) {
    const lightMeta = document.getElementById("theme-color-light");
    const darkMeta = document.getElementById("theme-color-dark");
    if (!lightMeta || !darkMeta) return;

    if (preference === "system") {
      lightMeta.content = "#f5f0e8";
      darkMeta.content = "#1c181c";
      return;
    }

    const color = theme === "dark" ? "#1c181c" : "#f5f0e8";
    lightMeta.content = color;
    darkMeta.content = color;
  }

  function updateGiscusTheme(theme) {
    for (const frame of document.querySelectorAll("iframe.giscus-frame")) {
      if (frame.dataset.themeReady !== "true") continue;
      frame.contentWindow?.postMessage(
        { giscus: { setConfig: { theme } } },
        "https://giscus.app",
      );
    }
  }

  function applyTheme(preference, persist = false) {
    const safePreference = allowedPreferences.has(preference)
      ? preference
      : "system";
    const theme = resolveTheme(safePreference);

    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = safePreference;
    document.documentElement.style.colorScheme = theme;
    updateThemeColors(safePreference, theme);

    const control = document.getElementById("theme-preference");
    if (control) control.value = safePreference;

    if (persist) {
      try {
        localStorage.setItem(storageKey, safePreference);
      } catch (_error) {
        // The page still keeps the selected theme for this visit.
      }
    }

    updateGiscusTheme(theme);
  }

  function loadGiscus(theme) {
    const config = document.querySelector(".giscus-config");
    if (!config || document.querySelector("script[data-giscus-client]")) return;

    const script = document.createElement("script");
    const attributes = {
      repo: config.dataset.repo,
      "repo-id": config.dataset.repoId,
      category: config.dataset.category,
      "category-id": config.dataset.categoryId,
      mapping: config.dataset.mapping,
      term: config.dataset.term,
      strict: config.dataset.strict,
      "reactions-enabled": config.dataset.reactionsEnabled,
      "emit-metadata": config.dataset.emitMetadata,
      "input-position": config.dataset.inputPosition,
      theme,
      lang: config.dataset.lang,
      loading: config.dataset.loading,
    };

    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.giscusClient = "";
    for (const [name, value] of Object.entries(attributes)) {
      if (value) script.setAttribute(`data-${name}`, value);
    }
    config.after(script);

    const host = document.querySelector(".giscus");
    if (!host) return;
    const observer = new MutationObserver(() => {
      const frame = host.querySelector("iframe.giscus-frame");
      if (!frame) return;
      frame.addEventListener(
        "load",
        () => {
          frame.dataset.themeReady = "true";
          updateGiscusTheme(document.documentElement.dataset.theme);
        },
        { once: true },
      );
      observer.disconnect();
    });
    observer.observe(host, { childList: true });
  }

  function setupMobileNavigation() {
    const header = document.querySelector(".site-header");
    const toggle = document.getElementById("menu-toggle");
    const navigation = document.getElementById("site-navigation");
    if (!header || !toggle || !navigation) return;

    function menuIsOpen() {
      return header.dataset.menuOpen === "true";
    }

    function setMenuOpen(open, returnFocus = false) {
      header.dataset.menuOpen = open ? "true" : "false";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open && returnFocus) toggle.focus();
    }

    toggle.addEventListener("click", () => {
      setMenuOpen(!menuIsOpen());
    });

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });

    document.addEventListener("click", (event) => {
      if (menuIsOpen() && !header.contains(event.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuIsOpen()) {
        setMenuOpen(false, true);
      }
    });

    const handleNavigationBreakpoint = () => {
      if (desktopNavigation.matches) setMenuOpen(false);
    };
    if (typeof desktopNavigation.addEventListener === "function") {
      desktopNavigation.addEventListener("change", handleNavigationBreakpoint);
    } else {
      desktopNavigation.addListener(handleNavigationBreakpoint);
    }

    setMenuOpen(false);
  }

  function openHashDisclosure(scroll = false) {
    const hashTarget = window.location.hash
      ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
      : null;
    if (!hashTarget) return;
    const details = hashTarget.closest("details");
    if (details) details.open = true;
    if (scroll) {
      requestAnimationFrame(() => {
        hashTarget.scrollIntoView({ block: "start" });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const preference = currentPreference();
    applyTheme(preference);
    setupMobileNavigation();

    const control = document.getElementById("theme-preference");
    control?.addEventListener("change", () => {
      applyTheme(control.value, true);
    });

    const handleSystemThemeChange = () => {
      if (currentPreference() === "system") applyTheme("system");
    };
    if (typeof systemTheme.addEventListener === "function") {
      systemTheme.addEventListener("change", handleSystemThemeChange);
    } else {
      systemTheme.addListener(handleSystemThemeChange);
    }

    loadGiscus(document.documentElement.dataset.theme);
    openHashDisclosure(true);
  });

  window.addEventListener("hashchange", () => openHashDisclosure(true));
})();
