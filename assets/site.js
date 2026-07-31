document.addEventListener("DOMContentLoaded", () => {
  const hashTarget = window.location.hash
    ? document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    : null;
  if (hashTarget) {
    const details = hashTarget.closest("details");
    if (details) details.open = true;
  }
});
