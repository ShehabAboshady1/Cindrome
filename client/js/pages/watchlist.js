const section = document.querySelector(".watchlist-filter-section");

if (section) {
  const searchInput = document.getElementById("watchlistSearchInput");
  const pills = section.querySelectorAll(".type-pill");
  const resetBtn = document.getElementById("watchlistResetBtn");
  const cards = document.querySelectorAll(".mini-content-card");
  const countEl = document.querySelector(".grid-count-text");

  function applyFilter() {
    const q = searchInput.value.toLowerCase().trim();
    const activePill = section.querySelector(".type-pill.active");
    const type = activePill ? activePill.getAttribute("data-type") : "all";
    let visible = 0;

    cards.forEach((card) => {
      const title = (card.getAttribute("data-tooltip") || "").toLowerCase();
      const cardType = card.getAttribute("data-type") || "";
      const match = title.includes(q) && (type === "all" || type === cardType);

      card.style.display = match ? "block" : "none";
      if (match) visible++;
    });

    if (countEl) countEl.textContent = `${visible} Titles`;
  }

  if (searchInput) searchInput.addEventListener("input", applyFilter);

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      applyFilter();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      searchInput.value = "";
      pills.forEach((p) => p.classList.remove("active"));
      section
        .querySelector('.type-pill[data-type="all"]')
        .classList.add("active");
      applyFilter();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".mini-content-card");

  if (window.innerWidth <= 768 && cards.length > 0) {
    cards.forEach((card) => {
      card.addEventListener("click", function (e) {
        if (e.target.closest(".mini-bar-btn")) return;

        const open = this.classList.contains("show-bar");
        cards.forEach((c) => c.classList.remove("show-bar"));
        if (!open) this.classList.add("show-bar");
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".mini-content-card")) {
        cards.forEach((c) => c.classList.remove("show-bar"));
      }
    });
  }
});
