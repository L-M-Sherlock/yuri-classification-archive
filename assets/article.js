(() => {
  "use strict";

  function setCopyStatus(button, message) {
    const toolbar = button.closest(".copy-toolbar");
    const status = toolbar?.querySelector(".copy-status");
    if (status) status.textContent = message;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }

  function setupCopyButtons() {
    for (const button of document.querySelectorAll("[data-copy-target]")) {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.dataset.copyTarget);
        if (!target) return;
        try {
          await copyText(target.textContent.trim());
          setCopyStatus(button, "已复制");
        } catch (_error) {
          setCopyStatus(button, "复制失败，请手动选择");
        }
      });
    }
  }

  function setupDisclosureControls() {
    for (const scope of document.querySelectorAll("[data-details-scope]")) {
      const details = [...scope.querySelectorAll("details")];
      scope.querySelector("[data-expand-all]")?.addEventListener("click", () => {
        for (const item of details) item.open = true;
      });
      scope.querySelector("[data-collapse-all]")?.addEventListener("click", () => {
        for (const item of details) item.open = false;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupCopyButtons();
    setupDisclosureControls();
  });
})();
