document.addEventListener("DOMContentLoaded", () => {
  const searchBtns = document.querySelectorAll(".search-trigger-btn");
  const searchModal = document.getElementById("searchModal");
  const closeSearch = searchModal
    ? searchModal.querySelector(".close-modal-btn")
    : null;

  if (searchModal) {
    searchBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        searchModal.style.display = "flex";
      });
    });

    if (closeSearch) {
      closeSearch.addEventListener("click", () => {
        searchModal.style.display = "none";
      });
    }
  }

  const typePills = document.querySelectorAll(".g-type-pill");
  typePills.forEach((pill) => {
    pill.addEventListener("click", function () {
      typePills.forEach((p) => p.classList.remove("active"));
      this.classList.add("active");
    });
  });

  const resetBtn = document.querySelector(".g-reset-filter-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      typePills.forEach((p) => p.classList.remove("active"));
      if (typePills[0]) typePills[0].classList.add("active");

      const labels = ["Genre", "Rating", "Sort By", "Year"];
      document
        .querySelectorAll(
          ".g-css-dropdown .g-dropdown-selected span:first-child",
        )
        .forEach((span, idx) => {
          if (labels[idx]) span.textContent = labels[idx];
        });
    });
  }

  document
    .querySelectorAll(".g-css-dropdown .g-dropdown-item")
    .forEach((item) => {
      item.addEventListener("click", function () {
        const dd = this.closest("details");
        const label = dd.querySelector(".g-dropdown-selected span:first-child");
        if (label) label.textContent = this.textContent;
        dd.removeAttribute("open");
      });
    });

  document.querySelectorAll(".css-dropdown .dropdown-item").forEach((item) => {
    item.addEventListener("click", function () {
      const dd = this.closest("details");
      const label = dd.querySelector(".dropdown-selected span:first-child");
      if (label) label.textContent = this.textContent;
      dd.removeAttribute("open");
    });
  });

  window.selectDropdownOption = function (el, targetId) {
    const target = document.getElementById(targetId);
    if (target) target.textContent = el.textContent.trim();
    const dd = el.closest("details");
    if (dd) dd.removeAttribute("open");

    if (targetId === "seasonText") {
      const val = el.textContent.trim();
      if (val === "All Seasons") {
        const epList = document.getElementById("logEpisodeList");
        const epText = document.getElementById("episodeText");
        if (epText) epText.textContent = "All Episodes";
        if (epList) {
          epList.innerHTML =
            '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li>';
        }
      } else {
        const match = val.match(/\d+/);
        if (match) {
          window.updateLogModalEpisodes(parseInt(match[0], 10));
        }
      }
    }
  };

  window.updateLogModalEpisodes = async function (seasonNum) {
    const idInput = document.getElementById("logMediaId");
    const epList = document.getElementById("logEpisodeList");
    const epText = document.getElementById("episodeText");

    if (!idInput || !idInput.value || !epList) return;

    if (epText) epText.textContent = "All Episodes";
    epList.innerHTML =
      '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li><li class="dropdown-item" style="opacity: 0.5;">Loading...</li>';

    try {
      const res = await fetch(`/api/tv/${idInput.value}/season/${seasonNum}`);
      const episodes = await res.json();

      epList.innerHTML =
        '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li>';

      if (Array.isArray(episodes) && episodes.length > 0) {
        episodes.forEach((ep) => {
          const li = document.createElement("li");
          li.className = "dropdown-item";
          li.textContent = `Episode ${ep.episode_number}`;
          li.onclick = function () {
            window.selectDropdownOption(this, "episodeText");
          };
          epList.appendChild(li);
        });
      }
    } catch (err) {
      epList.innerHTML =
        '<li class="dropdown-item" onclick="selectDropdownOption(this, \'episodeText\')">All Episodes</li>';
    }
  };

  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal");
  const navLogBtn = document.getElementById("navLogBtn");
  const closeLogBtn = document.getElementById("closeLogModalBtn");
  const cancelLogBtn = document.getElementById("cancelLogBtn");

  const dateInput = document.getElementById("watchDate");
  const reviewInput = document.getElementById("reviewText");
  const stars = document.querySelectorAll("#logModal .rate-star");
  let rating = 0;
  const logSearchInput = document.getElementById("logSearchInput");
  const logResults = document.getElementById("logSearchResults");
  let logTimer = null;

  if (logSearchInput && logResults) {
    logSearchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      clearTimeout(logTimer);

      if (q.length < 2) {
        logResults.innerHTML = "";
        logResults.style.display = "none";
        return;
      }

      logTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const items = await res.json();

          if (!Array.isArray(items) || items.length === 0) {
            logResults.innerHTML =
              '<div style="padding: 12px; color: #94a3b8; font-size: 13px; text-align: center;">No results found</div>';
            logResults.style.display = "block";
            return;
          }

          logResults.innerHTML = "";
          items.forEach((item) => {
            const div = document.createElement("div");
            div.className = "search-result-item";
            div.innerHTML = `
              <img src="${item.poster}" class="search-result-thumb">
              <div class="search-result-info">
                <span class="search-result-title">${item.title}</span>
                <span class="search-result-meta">${item.badge} • ${item.year || "N/A"}</span>
              </div>
            `;
            div.onclick = () => pickLogMedia(item);
            logResults.appendChild(div);
          });

          logResults.style.display = "block";
        } catch (err) {
          logResults.style.display = "none";
        }
      }, 300);
    });
  }

  async function pickLogMedia(item) {
    logResults.style.display = "none";
    logSearchInput.value = "";

    const idInput = document.getElementById("logMediaId");
    const typeInput = document.getElementById("logMediaType");
    const poster = document.getElementById("logItemPoster");
    const title = document.getElementById("logItemTitle");
    const badge = document.getElementById("logItemBadge");
    const selectors = document.getElementById("logSeasonEpSelectors");
    const seasonList = document.getElementById("logSeasonList");
    const seasonText = document.getElementById("seasonText");
    const epText = document.getElementById("episodeText");

    if (idInput) idInput.value = item.id;
    if (typeInput) typeInput.value = item.mediaType;
    if (poster) poster.src = item.poster;
    if (title) title.textContent = item.title;
    if (badge) badge.textContent = item.badge.toUpperCase();

    const isMovie = item.mediaType === "movie";
    if (selectors) {
      selectors.classList.toggle("is-hidden", isMovie);
    }

    if (!isMovie) {
      if (seasonText) seasonText.textContent = "All Seasons";
      if (epText) epText.textContent = "All Episodes";

      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${item.id}?api_key=ea76631510d3901482064d17498c07b5`,
        );
        const data = await res.json();
        const seasons = data.number_of_seasons || 1;

        if (seasonList) {
          seasonList.innerHTML =
            '<li class="dropdown-item" onclick="selectDropdownOption(this, \'seasonText\')">All Seasons</li>';
          for (let s = 1; s <= seasons; s++) {
            const li = document.createElement("li");
            li.className = "dropdown-item";
            li.textContent = `Season ${s}`;
            li.onclick = function () {
              window.selectDropdownOption(this, "seasonText");
            };
            seasonList.appendChild(li);
          }
        }
      } catch (e) {}
    }
  }

  window.resetLogData = function () {
    rating = 0;
    stars.forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    document.querySelectorAll("#logModal .icon-toggle-btn").forEach((btn) => {
      btn.classList.remove("active", "spoiler-active");
    });
    if (document.getElementById("logReviewId")) {
      document.getElementById("logReviewId").value = "";
    }
    if (reviewInput) reviewInput.value = "";
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const searchInput = document.querySelector(
      "#logModal .log-global-search input",
    );
    if (searchInput) searchInput.value = "";
  };

  const openLog = () => {
    if (logModal) logModal.style.display = "flex";
  };

  if (openLogBtn) {
    openLogBtn.addEventListener("click", () => {
      window.resetLogData();
      openLog();
    });
  }

  if (navLogBtn) {
    navLogBtn.addEventListener("click", () => {
      window.resetLogData();
      const globalSearch = document.querySelector(
        "#logModal .log-global-search",
      );
      if (globalSearch) globalSearch.style.display = "flex";
      openLog();
    });
  }

  const closeLog = () => {
    if (logModal) logModal.style.display = "none";
  };

  if (closeLogBtn) closeLogBtn.addEventListener("click", closeLog);
  if (cancelLogBtn) cancelLogBtn.addEventListener("click", closeLog);

  const likeToggle = document.getElementById("likeToggle");
  const rewatchToggle = document.getElementById("rewatchToggle");
  const spoilerToggle = document.getElementById("spoilerToggle");

  function bindToggle(btn, activeClass) {
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (activeClass === "spoiler-active") {
        this.classList.toggle("spoiler-active");
        this.classList.remove("active");
      } else {
        this.classList.toggle("active");
        this.classList.remove("spoiler-active");
      }
    });
  }

  bindToggle(likeToggle, "active");
  bindToggle(rewatchToggle, "active");
  bindToggle(spoilerToggle, "spoiler-active");

  function renderStars(val) {
    stars.forEach((star, idx) => {
      star.classList.remove("fa-solid", "fa-regular", "fa-star-half-stroke");
      if (val >= idx + 1) star.classList.add("fa-solid", "fa-star");
      else if (val === idx + 0.5)
        star.classList.add("fa-solid", "fa-star-half-stroke");
      else star.classList.add("fa-regular", "fa-star");
    });
  }

  stars.forEach((star, idx) => {
    star.addEventListener("mousemove", function (e) {
      const rect = this.getBoundingClientRect();
      const half = e.clientX - rect.left < rect.width / 2;
      renderStars(idx + (half ? 0.5 : 1));
    });

    star.addEventListener("mouseout", () => renderStars(rating));

    star.addEventListener("click", function (e) {
      const rect = this.getBoundingClientRect();
      const half = e.clientX - rect.left < rect.width / 2;
      rating = idx + (half ? 0.5 : 1);
      renderStars(rating);
    });
  });

  document.querySelectorAll(".log-form").forEach((form) => {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const modal = this.closest(".log-modal-container");
      const saveBtn = modal.querySelector(".btn-save-log");

      const tmdb_id = modal.querySelector("input[id='logMediaId']")?.value;
      const media_type = modal.querySelector("input[id='logMediaType']")?.value;
      const review_text = modal
        .querySelector("textarea.review-textarea")
        ?.value.trim();
      const watch_date = modal.querySelector("input[type='date']")?.value;
      const finalRating = rating > 0 ? rating : null;

      const is_rewatch =
        modal.querySelector("#rewatchToggle")?.classList.contains("active") ||
        false;
      const has_spoilers =
        modal
          .querySelector("#spoilerToggle")
          ?.classList.contains("spoiler-active") || false;
      const liked =
        modal.querySelector("#likeToggle")?.classList.contains("active") ||
        false;

      let season_number = null;
      let episode_number = null;

      if (media_type !== "movie") {
        const sStr =
          modal.querySelector("span[id='seasonText']")?.textContent || "";
        const eStr =
          modal.querySelector("span[id='episodeText']")?.textContent || "";

        const sMatch = sStr.match(/\d+/);
        if (sMatch) season_number = parseInt(sMatch[0], 10);

        const eMatch = eStr.match(/\d+/);
        if (eMatch) episode_number = parseInt(eMatch[0], 10);
      }

      if (!tmdb_id || !media_type) {
        alert("Please select a movie, series, or anime first.");
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Logging...';
      }

      const revId = modal.querySelector("#logReviewId")?.value;
      const url = revId ? `/api/reviews/${revId}` : "/api/reviews/log";
      const method = revId ? "PUT" : "POST";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id,
            media_type,
            rating: finalRating,
            review_text,
            is_rewatch,
            has_spoilers,
            liked,
            season_number,
            episode_number,
            watch_date,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          closeLog();
          window.location.reload();
        } else {
          alert(data.error || "An error occurred.");
        }
      } catch (err) {
        alert("Network error.");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = "Log";
        }
      }
    });
  });

  const listModal = document.getElementById("createListModal");
  const openListBtn = document.getElementById("openCreateListBtn");
  const closeListBtn = document.getElementById("closeCreateListBtn");
  const cancelListBtn = document.getElementById("cancelListBtn");
  const itemsBox = document.getElementById("addedItemsContainer");
  const listSearchInput = document.getElementById("addMovieSearch");
  const listResults = document.getElementById("listSearchResults");
  const miniTpl = document.getElementById("miniCardTemplate");
  const searchItemTpl = document.getElementById("listSearchItemTemplate");
  let listTimer = null;
  let editListId = null;

  const openListModal = () => {
    if (listModal) listModal.style.display = "flex";
  };

  const closeListModal = () => {
    if (listModal) {
      listModal.style.display = "none";
      if (listResults) listResults.style.display = "none";
      if (listSearchInput) listSearchInput.value = "";
    }
  };

  if (openListBtn) {
    openListBtn.addEventListener("click", () => {
      editListId = null;
      const titleEl = document.querySelector(
        "#createListModal .modal-main-title",
      );
      const saveBtn = document.querySelector("#createListModal .btn-save-log");
      if (titleEl) titleEl.textContent = "Create New List";
      if (saveBtn) saveBtn.textContent = "Create List";

      if (document.getElementById("listTitle")) {
        document.getElementById("listTitle").value = "";
      }
      if (document.getElementById("privacyToggle")) {
        document.getElementById("privacyToggle").checked = false;
      }
      if (itemsBox) itemsBox.innerHTML = "";

      openListModal();
    });
  }

  window.addEventListener("openEditListMode", (e) => {
    const { list, items } = e.detail;
    editListId = list.id;
    openListModal();

    const titleEl = document.querySelector(
      "#createListModal .modal-main-title",
    );
    const saveBtn = document.querySelector("#createListModal .btn-save-log");
    if (titleEl) titleEl.textContent = "Edit List";
    if (saveBtn) saveBtn.textContent = "Save Changes";

    const titleInput =
      document.getElementById("listTitle") ||
      document.querySelector("#createListModal .list-basic-input");
    if (titleInput) titleInput.value = list.title;

    const privacyInput =
      document.getElementById("privacyToggle") ||
      document.querySelector("#createListModal input[type='checkbox']");
    if (privacyInput) privacyInput.checked = list.is_private;

    if (itemsBox && miniTpl) {
      itemsBox.innerHTML = "";

      items.forEach((item) => {
        const clone = miniTpl.content.cloneNode(true);
        const card = clone.querySelector(".modal-mini-card");
        if (!card) return;

        card.dataset.id = item.tmdb_id;
        card.dataset.type = item.media_type;
        card.dataset.rating = item.rating || "NR";

        const img = card.querySelector("img");
        if (img) {
          img.src = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : "/assets/posters/poster-odyssey.webp";
          img.alt = item.title;
        }

        const label = card.querySelector(".mini-title");
        if (label) label.textContent = item.title;

        bindDragEvents(card);
        itemsBox.appendChild(clone);
      });
    }
  });

  if (closeListBtn) closeListBtn.addEventListener("click", closeListModal);
  if (cancelListBtn) cancelListBtn.addEventListener("click", closeListModal);

  let draggedCard = null;

  function onDragStart() {
    draggedCard = this;
    setTimeout(() => this.classList.add("dragging"), 0);
  }

  function onDragEnd() {
    this.classList.remove("dragging");
    draggedCard = null;
    document
      .querySelectorAll(".modal-mini-card")
      .forEach((c) => c.classList.remove("drag-over"));
  }

  function onDragOver(e) {
    e.preventDefault();
    this.classList.add("drag-over");
  }

  function onDragLeave() {
    this.classList.remove("drag-over");
  }

  function onDrop(e) {
    e.preventDefault();
    this.classList.remove("drag-over");
    if (draggedCard && draggedCard !== this && itemsBox) {
      const cards = [...itemsBox.querySelectorAll(".modal-mini-card")];
      const fromIdx = cards.indexOf(draggedCard);
      const toIdx = cards.indexOf(this);

      if (fromIdx < toIdx) this.after(draggedCard);
      else this.before(draggedCard);
    }
  }

  function bindDragEvents(card) {
    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragend", onDragEnd);
    card.addEventListener("dragover", onDragOver);
    card.addEventListener("dragleave", onDragLeave);
    card.addEventListener("drop", onDrop);
  }

  document.querySelectorAll(".modal-mini-card").forEach(bindDragEvents);

  if (itemsBox) {
    itemsBox.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-mini-btn");
      if (btn) {
        const card = btn.closest(".modal-mini-card");
        if (card) {
          card.style.transform = "scale(0)";
          card.style.opacity = "0";
          setTimeout(() => card.remove(), 200);
        }
      }
    });
  }

  function appendMediaCard(item) {
    if (!miniTpl || !itemsBox) return;

    const clone = miniTpl.content.cloneNode(true);
    const card = clone.querySelector(".modal-mini-card");
    const img = clone.querySelector("img");

    card.dataset.id = item.id;
    card.dataset.type = item.mediaType;
    card.dataset.rating = item.numericScore || item.score;
    img.src = item.poster;
    img.alt = item.title;

    const label =
      card.querySelector(".mini-title") ||
      card.querySelector(".mini-card-title");
    if (label) label.textContent = item.title;

    bindDragEvents(card);
    itemsBox.prepend(card);

    if (listResults) {
      listResults.innerHTML = "";
      listResults.style.display = "none";
    }
    if (listSearchInput) listSearchInput.value = "";
  }

  if (listSearchInput && listResults && searchItemTpl) {
    listSearchInput.addEventListener("input", function () {
      const q = this.value.trim();
      clearTimeout(listTimer);

      if (q.length < 2) {
        listResults.innerHTML = "";
        listResults.style.display = "none";
        return;
      }

      listTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const items = await res.json();
          listResults.innerHTML = "";

          if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "search-result-item";
            empty.style.color = "#94a3b8";
            empty.style.fontSize = "13px";
            empty.style.justifyContent = "center";
            empty.textContent = "No results found";
            listResults.appendChild(empty);
            listResults.style.display = "block";
            return;
          }

          items.forEach((item) => {
            const clone = searchItemTpl.content.cloneNode(true);
            const row = clone.querySelector(".search-result-item");
            const thumb = clone.querySelector(".search-result-thumb");
            const title = clone.querySelector(".search-result-title");
            const meta = clone.querySelector(".search-result-meta");

            thumb.src = item.poster;
            title.textContent = item.title;
            meta.textContent = `${item.badge} • ${item.year || "N/A"}`;

            row.addEventListener("click", () => appendMediaCard(item));
            listResults.appendChild(clone);
          });

          listResults.style.display = "block";
        } catch (err) {
          listResults.style.display = "none";
        }
      }, 300);
    });

    document.addEventListener("click", (e) => {
      if (
        !listSearchInput.contains(e.target) &&
        !listResults.contains(e.target)
      ) {
        listResults.style.display = "none";
      }
    });
  }

  const listForm = document.querySelector("#createListModal .list-form");
  if (listForm) {
    listForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const titleInput = document.getElementById("listTitle");
      const privacyInput = document.getElementById("privacyToggle");
      const saveBtn = listForm.querySelector(".btn-save-log");

      const title = titleInput ? titleInput.value.trim() : "";
      const is_private = privacyInput ? privacyInput.checked : false;

      if (!title) {
        alert("Please enter a list name.");
        return;
      }

      const cards = document.querySelectorAll(
        "#addedItemsContainer .modal-mini-card",
      );
      const items = Array.from(cards).map((card, idx) => {
        const img = card.querySelector("img");
        let posterPath = img.src;
        if (posterPath.includes("image.tmdb.org/t/p/w500")) {
          posterPath = posterPath.split("image.tmdb.org/t/p/w500")[1];
        }

        return {
          tmdb_id: card.dataset.id,
          media_type: card.dataset.type,
          title: img.alt,
          poster_path: posterPath,
          rating: card.dataset.rating !== "NR" ? card.dataset.rating : null,
          order_index: idx + 1,
        };
      });

      const prevText = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      const url = editListId ? `/api/lists/${editListId}` : "/api/lists/create";
      const method = editListId ? "PUT" : "POST";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, is_private, items }),
        });

        const data = await res.json();
        if (res.ok) {
          listModal.style.display = "none";
          window.location.reload();
        } else {
          alert(data.error || "Failed to save list.");
          saveBtn.disabled = false;
          saveBtn.innerHTML = prevText;
        }
      } catch (err) {
        alert("Network error. Please try again.");
        saveBtn.disabled = false;
        saveBtn.innerHTML = prevText;
      }
    });
  }

  document.addEventListener("click", (e) => {
    document
      .querySelectorAll(".css-dropdown, .g-css-dropdown")
      .forEach((dd) => {
        if (!dd.contains(e.target)) dd.removeAttribute("open");
      });
  });

  let rawResults = [];
  let filters = {
    type: "all",
    genre: "all",
    rating: 0,
    sort: "default",
    year: "all",
  };

  const searchInput = document.getElementById("filterSearchInput");
  const resultsGrid = document.getElementById("globalSearchResults");
  const statusEl = document.getElementById("globalSearchStatus");
  const cardTpl = document.getElementById("globalCardTemplate");
  const globalPills = document.querySelectorAll(
    ".g-type-selector .g-type-pill",
  );
  const globalReset = document.getElementById("globalResetBtn");
  let searchTimer = null;

  globalPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      globalPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      filters.type = pill.getAttribute("data-type") || "all";
      if (searchInput && searchInput.value.trim().length >= 1) {
        runGlobalSearch(searchInput.value.trim());
      }
    });
  });

  function bindFilterDropdown(ddId, textId, key) {
    const dd = document.getElementById(ddId);
    const label = document.getElementById(textId);
    if (!dd || !label) return;

    dd.querySelectorAll(".g-dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        label.textContent = item.textContent.trim();
        dd.removeAttribute("open");
        filters[key] = item.getAttribute("data-value");
        renderSearchGrid();
      });
    });
  }

  bindFilterDropdown("filterGenreDropdown", "genreFilterText", "genre");
  bindFilterDropdown("filterRatingDropdown", "ratingFilterText", "rating");
  bindFilterDropdown("filterSortDropdown", "sortFilterText", "sort");
  bindFilterDropdown("filterYearDropdown", "yearFilterText", "year");

  if (globalReset) {
    globalReset.addEventListener("click", () => {
      filters = {
        type: "all",
        genre: "all",
        rating: 0,
        sort: "default",
        year: "all",
      };

      if (searchInput) searchInput.value = "";
      rawResults = [];
      if (resultsGrid) resultsGrid.innerHTML = "";

      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "Type to search movies, series, or anime...";
      }

      globalPills.forEach((p) => p.classList.remove("active"));
      if (globalPills[0]) globalPills[0].classList.add("active");

      const genreText = document.getElementById("genreFilterText");
      const ratingText = document.getElementById("ratingFilterText");
      const sortText = document.getElementById("sortFilterText");
      const yearText = document.getElementById("yearFilterText");

      if (genreText) genreText.textContent = "Genre";
      if (ratingText) ratingText.textContent = "Rating";
      if (sortText) sortText.textContent = "Sort By";
      if (yearText) yearText.textContent = "Year";
    });
  }

  if (searchInput && resultsGrid) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      clearTimeout(searchTimer);

      if (val.length < 1) {
        rawResults = [];
        resultsGrid.innerHTML = "";
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.textContent = "Type to search movies, series, or anime...";
        }
        return;
      }

      searchTimer = setTimeout(() => runGlobalSearch(val), 250);
    });
  }

  async function runGlobalSearch(q) {
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.textContent = "Searching...";
    }
    resultsGrid.innerHTML = "";

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${filters.type}`,
      );
      rawResults = await res.json();
      renderSearchGrid();
    } catch (err) {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "An error occurred while fetching results.";
      }
    }
  }

  function renderSearchGrid() {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = "";

    if (!Array.isArray(rawResults) || rawResults.length === 0) {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "No titles found matching your search.";
      }
      return;
    }

    const genreMap = {
      action: [28, 10759],
      scifi: [878, 10765],
      drama: [18],
      mystery: [9648],
      fantasy: [14, 10765],
      comedy: [35],
      animation: [16],
    };

    const list = rawResults.filter((item) => {
      if (filters.genre !== "all") {
        const ids = genreMap[filters.genre] || [];
        if (!item.genres.some((id) => ids.includes(id))) return false;
      }

      const minR = parseFloat(filters.rating);
      if (minR > 0 && item.numericScore < minR) return false;

      if (filters.year !== "all") {
        const y = item.numericYear;
        if (!y) return false;
        if (filters.year === "2010s" && (y < 2010 || y > 2019)) return false;
        if (filters.year === "2000s" && (y < 2000 || y > 2009)) return false;
        if (filters.year === "90s" && (y < 1990 || y > 1999)) return false;
        if (filters.year === "classics" && y >= 1990) return false;
        if (!isNaN(filters.year) && y !== parseInt(filters.year, 10))
          return false;
      }

      return true;
    });

    if (filters.sort === "newest") {
      list.sort((a, b) => (b.numericYear || 0) - (a.numericYear || 0));
    } else if (filters.sort === "oldest") {
      list.sort((a, b) => (a.numericYear || 0) - (b.numericYear || 0));
    } else if (filters.sort === "rating") {
      list.sort((a, b) => b.numericScore - a.numericScore);
    }

    if (list.length === 0) {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = "No results match the selected filters.";
      }
      return;
    }

    if (statusEl) statusEl.style.display = "none";

    const wlEl = document.getElementById("userWatchlistData");
    let watchlist = [];
    if (wlEl && wlEl.dataset.watchlist) {
      try {
        watchlist = JSON.parse(wlEl.dataset.watchlist);
      } catch (e) {}
    }

    list.forEach((item) => {
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
      meta.textContent = `${item.year} • ${item.badge}`;

      detailsLink.href = `/details?id=${item.id}&type=${item.mediaType}`;

      if (wlBtn) {
        wlBtn.classList.toggle("added", watchlist.includes(item.id.toString()));
        wlBtn.onclick = function () {
          toggleWatchlist(this, item.id, item.mediaType);
        };
      }

      resultsGrid.appendChild(clone);
    });
  }
});
