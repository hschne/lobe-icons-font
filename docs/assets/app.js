// Lobe Icons cheat sheet — search filtering and copy interactions.

(() => {
  "use strict";

  const grid = document.getElementById("grid");
  const searchInput = document.getElementById("search-input");
  const emptyState = document.getElementById("empty-state");
  const toast = document.querySelector(".toast");
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll(".card"));

  // ----- Copy strings derived from card data -----
  function copyValue(card, kind) {
    const slug = card.dataset.slug;
    const hex = card.dataset.hex;
    switch (kind) {
      case "glyph":
        return String.fromCodePoint(parseInt(hex, 16));
      case "class":
        return `<i class="li li-${slug}"></i>`;
      case "hex":
        return hex;
      case "unicode":
        return `U+${hex}`;
      default:
        return "";
    }
  }

  const LABELS = {
    glyph: "glyph",
    class: "class",
    hex: "hex code point",
    unicode: "unicode",
  };

  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1600);
  }

  async function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for non-secure contexts.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "absolute";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function flashButton(button) {
    button.classList.add("is-copied");
    // Match the bounce animation so a rapid re-click can replay it.
    setTimeout(() => button.classList.remove("is-copied"), 300);
  }

  grid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const card = button.closest(".card");
    if (!card) return;

    const kind = button.dataset.copy;
    const value = copyValue(card, kind);
    try {
      await writeClipboard(value);
      flashButton(button);
      showToast(`Copied ${LABELS[kind]} for ${card.dataset.title}`);
    } catch {
      showToast("Copy failed");
    }
  });

  // ----- Search filtering -----
  function normalize(value) {
    return value.trim().toLowerCase();
  }

  function applyFilter(query) {
    const needle = normalize(query);
    let visible = 0;
    for (const card of cards) {
      const haystack =
        `${card.dataset.title} ${card.dataset.slug}`.toLowerCase();
      const match = needle === "" || haystack.includes(needle);
      card.hidden = !match;
      if (match) visible += 1;
    }
    if (emptyState) emptyState.hidden = visible !== 0;
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      applyFilter(event.target.value);
    });
  }
})();
