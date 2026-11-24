document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".diary-filter-section .dropdown-item")
    .forEach((item) => {
      item.addEventListener("click", function () {
        const dd = this.closest("details");
        const label = dd.querySelector(".dropdown-selected span:first-child");
        label.textContent = this.textContent;
        dd.removeAttribute("open");
      });
    });

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".diary-filter-section details").forEach((dd) => {
      if (!dd.contains(e.target)) dd.removeAttribute("open");
    });
  });

  const delBtns = document.querySelectorAll(".delete-btn");
  const confirmModal = document.getElementById("deleteConfirmModal");
  const cancelDelBtn = document.getElementById("cancelDeleteBtn");
  const confirmDelBtn = document.getElementById("confirmDeleteBtn");

  let pendingDelete = null;

  delBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      pendingDelete = {
        row: this.closest(".diary-entry-row"),
        id: this.getAttribute("data-id"),
      };
      if (confirmModal) confirmModal.style.display = "flex";
    });
  });

  if (cancelDelBtn) {
    cancelDelBtn.addEventListener("click", () => {
      pendingDelete = null;
      if (confirmModal) confirmModal.style.display = "none";
    });
  }

  if (confirmDelBtn) {
    confirmDelBtn.addEventListener("click", async () => {
      if (!pendingDelete) return;

      const { row, id } = pendingDelete;
      const prevHtml = confirmDelBtn.innerHTML;

      confirmDelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      confirmDelBtn.style.opacity = "0.7";
      confirmDelBtn.disabled = true;

      try {
        const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });

        if (res.ok) {
          if (confirmModal) confirmModal.style.display = "none";
          row.classList.add("fade-out");
          setTimeout(() => row.remove(), 400);
        } else {
          alert("Failed to delete the log. Please try again.");
        }
      } catch (err) {
        console.error("Delete error:", err);
      } finally {
        pendingDelete = null;
        confirmDelBtn.innerHTML = prevHtml;
        confirmDelBtn.style.opacity = "1";
        confirmDelBtn.disabled = false;
      }
    });
  }

  const editBtns = document.querySelectorAll(".edit-btn");
  const logModal = document.getElementById("logModal");
  const modalTitle = logModal
    ? logModal.querySelector(".modal-main-title")
    : null;
  const reviewInput = document.getElementById("reviewText");
  const likeToggle = document.getElementById("likeToggle");
  const rewatchToggle = document.getElementById("rewatchToggle");
  const spoilerToggle = document.getElementById("spoilerToggle");
  const stars = document.querySelectorAll("#logModal .rate-star");

  const searchBox = logModal
    ? logModal.querySelector(".log-global-search")
    : null;
  const itemHeader = logModal
    ? logModal.querySelector(".log-item-header")
    : null;
  const modalPoster = logModal
    ? logModal.querySelector(".log-item-poster")
    : null;
  const modalItemTitle = logModal
    ? logModal.querySelector(".log-item-title")
    : null;
  const modalBadge = logModal ? logModal.querySelector(".type-badge") : null;
  const seasonBox = logModal
    ? logModal.querySelector(".season-episode-selectors")
    : null;

  function renderStars(val) {
    stars.forEach((star, idx) => {
      star.className = "rate-star fa-star";
      if (val >= idx + 1) star.classList.add("fa-solid");
      else if (val === idx + 0.5)
        star.classList.add("fa-solid", "fa-star-half-stroke");
      else star.classList.add("fa-regular");
    });
  }

  editBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const rating = parseFloat(this.getAttribute("data-rating")) || 0;
      const liked = this.getAttribute("data-liked") === "true";
      const rewatched = this.getAttribute("data-rewatched") === "true";
      const spoiler = this.getAttribute("data-spoiler") === "true";
      const review = this.getAttribute("data-review") || "";

      const title = this.getAttribute("data-title");
      const season = this.getAttribute("data-season");
      const episode = this.getAttribute("data-episode");
      const type = this.getAttribute("data-type");
      const poster = this.getAttribute("data-poster");
      const revId = this.getAttribute("data-reviewid");
      const tmdbId = this.getAttribute("data-tmdbid");

      const revIdInput = document.getElementById("logReviewId");
      if (revIdInput) revIdInput.value = revId;
      const idInput = document.getElementById("logMediaId");
      const typeInput = document.getElementById("logMediaType");
      const rawDate = this.getAttribute("data-date");
      const dateInput = document.getElementById("watchDate");

      if (dateInput) {
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            dateInput.value = `${y}-${m}-${day}`;
          }
        } else {
          dateInput.value = new Date().toISOString().split("T")[0];
        }
      }
      if (idInput) idInput.value = tmdbId;
      if (typeInput) typeInput.value = type.toLowerCase();

      if (searchBox) searchBox.style.display = "none";
      if (itemHeader) itemHeader.style.display = "flex";

      if (modalTitle) modalTitle.textContent = "Edit Log";
      if (modalPoster && poster) modalPoster.src = poster;
      if (modalItemTitle && title) modalItemTitle.textContent = title;
      if (modalBadge && type) modalBadge.textContent = type;

      const seasonText = document.getElementById("seasonText");
      const epText = document.getElementById("episodeText");

      if (seasonText) {
        seasonText.textContent = season ? `Season ${season}` : "All Seasons";
      }
      if (epText) {
        epText.textContent = episode ? `Episode ${episode}` : "All Episodes";
      }

      if (seasonBox) {
        if (type.toUpperCase() === "MOVIE") {
          seasonBox.style.display = "none";
        } else {
          seasonBox.style.display = "flex";

          if (tmdbId) {
            fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=ea76631510d3901482064d17498c07b5`,
            )
              .then((res) => res.json())
              .then(async (data) => {
                const seasons = data.number_of_seasons || 1;
                const seasonList = document.getElementById("logSeasonList");

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

                if (window.updateLogModalEpisodes) {
                  await window.updateLogModalEpisodes(
                    season ? parseInt(season, 10) : 1,
                  );

                  if (epText) {
                    epText.textContent = episode
                      ? `Episode ${episode}`
                      : "All Episodes";
                  }
                }
              })
              .catch((err) => console.error("Seasons fetch error:", err));
          }
        }
      }

      if (reviewInput) reviewInput.value = review;
      renderStars(rating);

      if (likeToggle) likeToggle.classList.toggle("active", liked);
      if (rewatchToggle) rewatchToggle.classList.toggle("active", rewatched);

      if (spoilerToggle) {
        if (spoiler) {
          spoilerToggle.classList.add("spoiler-active");
          spoilerToggle.classList.remove("active");
        } else {
          spoilerToggle.classList.remove("spoiler-active");
        }
      }

      if (logModal) logModal.style.display = "flex";
    });
  });

  const logSearchResults = document.getElementById("logSearchResults");
  if (logSearchResults) {
    logSearchResults.addEventListener("click", () => {
      if (itemHeader) itemHeader.style.display = "flex";
      if (searchBox) searchBox.style.display = "none";
    });
  }
});
