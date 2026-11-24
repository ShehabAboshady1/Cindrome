document.addEventListener("DOMContentLoaded", () => {
  const filters = {
    q: "",
    type: "all",
    genre: "all",
    rating: "0",
    sort: "popular",
    year: "all",
    page: 1,
    totalPages: 1,
  };

  const searchInput = document.getElementById("discoverSearchInput");
  const typePills = document.querySelectorAll(
    "#discoverTypeSelector .type-pill",
  );
  const resetBtn = document.getElementById("discoverResetBtn");
  const gridEl = document.getElementById("discoverCardsGrid");
  const statusEl = document.getElementById("discoverStatusMsg");
  const navEl = document.getElementById("discoverPagination");
  const cardTpl = document.getElementById("discoverCardTemplate");
  const headingEl = document.getElementById("discoverGridTitle");

  let timer = null;

  function bindDropdown(ddId, textId, key) {
    const dd = document.getElementById(ddId);
    const label = document.getElementById(textId);
    if (!dd || !label) return;

    dd.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        label.textContent = item.textContent.trim();
        dd.removeAttribute("open");
        filters[key] = item.getAttribute("data-value");
        filters.page = 1;
        loadDiscover();
      });
    });
  }

  bindDropdown("discoverGenreDropdown", "discoverGenreText", "genre");
  bindDropdown("discoverRatingDropdown", "discoverRatingText", "rating");
  bindDropdown("discoverSortDropdown", "discoverSortText", "sort");
  bindDropdown("discoverYearDropdown", "discoverYearText", "year");

  typePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      typePills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      filters.type = pill.getAttribute("data-type") || "all";
      filters.page = 1;

      if (headingEl) {
        if (filters.type === "movie") headingEl.textContent = "Movies";
        else if (filters.type === "tv") headingEl.textContent = "Series";
        else if (filters.type === "anime") headingEl.textContent = "Anime";
        else headingEl.textContent = "All Content";
      }

      loadDiscover();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(timer);
      filters.q = e.target.value.trim();
      filters.page = 1;
      timer = setTimeout(loadDiscover, 250);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      Object.assign(filters, {
        q: "",
        type: "all",
        genre: "all",
        rating: "0",
        sort: "popular",
        year: "all",
        page: 1,
      });

      if (searchInput) searchInput.value = "";
      typePills.forEach((p) => p.classList.remove("active"));
      if (typePills[0]) typePills[0].classList.add("active");

      const gText = document.getElementById("discoverGenreText");
      const rText = document.getElementById("discoverRatingText");
      const sText = document.getElementById("discoverSortText");
      const yText = document.getElementById("discoverYearText");

      if (gText) gText.textContent = "Genre";
      if (rText) rText.textContent = "Rating";
      if (sText) sText.textContent = "Sort By";
      if (yText) yText.textContent = "Year";
      if (headingEl) headingEl.textContent = "All Content";

      loadDiscover();
    });
  }

  async function loadDiscover() {
    if (!gridEl) return;

    gridEl.innerHTML = "";
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = "Loading content...";
    }

    try {
      const params = new URLSearchParams({
        q: filters.q,
        type: filters.type,
        genre: filters.genre,
        rating: filters.rating,
        sort: filters.sort,
        year: filters.year,
        page: filters.page,
      });

      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = await res.json();

      filters.totalPages = data.totalPages || 1;
      renderGrid(data.results || []);
      renderPages();
    } catch (err) {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "Failed to load content. Please try again.";
      }
    }
  }

  function renderGrid(items) {
    gridEl.innerHTML = "";

    if (!items || items.length === 0) {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "No content matches the selected filters.";
      }
      return;
    }

    if (statusEl) statusEl.style.display = "none";

    items.forEach((item) => {
      const clone = cardTpl.content.cloneNode(true);
      const poster = clone.querySelector(".card-poster");
      const badge = clone.querySelector(".type-badge");
      const scoreEl = clone.querySelector(".rating-score");
      const title = clone.querySelector(".card-title");
      const meta = clone.querySelector(".meta-row");
      const detailsLink = clone.querySelector(".btn-details");
      const wlBtn = clone.querySelector(".btn-watchlist");

      poster.src = item.poster;
      poster.alt = item.title;
      badge.textContent = item.badge.toUpperCase();
      scoreEl.textContent = `★ ${item.score}`;
      title.textContent = item.title;
      title.title = item.title;
      meta.textContent = `${item.genres} • ${item.year}`;
      detailsLink.href = `/details?id=${item.id}&type=${item.mediaType}`;

      if (wlBtn) {
        const mType =
          item.mediaType === "tv"
            ? "tv"
            : item.mediaType === "anime"
              ? "anime"
              : "movie";

        wlBtn.setAttribute(
          "onclick",
          `toggleWatchlist(this, ${item.id}, '${mType}')`,
        );

        if (item.is_watchlisted) {
          wlBtn.classList.add("added");
          wlBtn.setAttribute("title", "Remove from Watchlist");
        }
      }

      gridEl.appendChild(clone);
    });
  }

  function renderPages() {
    if (!navEl) return;
    navEl.innerHTML = "";
    if (filters.totalPages <= 1) return;

    const scrollTop = () => {
      const box = document.querySelector(".discover-filter-section");
      if (box) box.scrollIntoView({ behavior: "smooth" });
    };

    const prevBtn = document.createElement("button");
    prevBtn.className = `page-btn prev-next ${filters.page === 1 ? "disabled" : ""}`;
    prevBtn.type = "button";
    prevBtn.textContent = "PREV";
    if (filters.page === 1) prevBtn.disabled = true;
    prevBtn.onclick = () => {
      if (filters.page > 1) {
        filters.page--;
        loadDiscover();
        scrollTop();
      }
    };
    navEl.appendChild(prevBtn);

    calcPageList(filters.page, filters.totalPages).forEach((p) => {
      if (p === "...") {
        const dots = document.createElement("span");
        dots.className = "pagination-dots";
        dots.textContent = "...";
        navEl.appendChild(dots);
      } else {
        const btn = document.createElement("button");
        btn.className = `page-btn ${p === filters.page ? "active" : ""}`;
        btn.type = "button";
        btn.textContent = p;
        btn.onclick = () => {
          if (p !== filters.page) {
            filters.page = p;
            loadDiscover();
            scrollTop();
          }
        };
        navEl.appendChild(btn);
      }
    });

    const nextBtn = document.createElement("button");
    nextBtn.className = `page-btn prev-next ${filters.page === filters.totalPages ? "disabled" : ""}`;
    nextBtn.type = "button";
    nextBtn.textContent = "NEXT";
    if (filters.page === filters.totalPages) nextBtn.disabled = true;
    nextBtn.onclick = () => {
      if (filters.page < filters.totalPages) {
        filters.page++;
        loadDiscover();
        scrollTop();
      }
    };
    navEl.appendChild(nextBtn);
  }

  function calcPageList(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4) return [1, 2, 3, 4, 5, "...", total];
    if (cur >= total - 3)
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    return [1, "...", cur - 1, cur, cur + 1, "...", total];
  }

  loadDiscover();
});
