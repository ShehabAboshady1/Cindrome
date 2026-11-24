document.addEventListener("DOMContentLoaded", () => {
  const openLogBtn = document.getElementById("openLogModal");

  function resetLogState() {
    document.querySelectorAll("#logModal .rate-star").forEach((star) => {
      star.classList.remove("fa-solid", "fa-star-half-stroke");
      star.classList.add("fa-regular", "fa-star");
    });

    document.querySelectorAll("#logModal .icon-toggle-btn").forEach((btn) => {
      btn.classList.remove("active", "spoiler-active");
    });

    const reviewInput = document.getElementById("reviewText");
    if (reviewInput) reviewInput.value = "";

    const labels = ["Season 1", "All Episodes"];
    document
      .querySelectorAll("#logModal .dropdown-selected span:first-child")
      .forEach((span, idx) => {
        if (labels[idx]) span.textContent = labels[idx];
      });
  }

  if (openLogBtn) {
    openLogBtn.addEventListener("click", () => {
      resetLogState();

      const searchBox = document.querySelector("#logModal .log-global-search");
      const itemHeader = document.querySelector("#logModal .log-item-header");

      if (searchBox) searchBox.style.display = "none";
      if (itemHeader) itemHeader.style.display = "flex";
    });
  }

  document.querySelectorAll(".review-like-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();

      const revId = this.getAttribute("data-review-id");
      if (!revId) return;

      try {
        const res = await fetch(`/api/reviews/${revId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          const countEl =
            this.querySelector(".like-count") ||
            this.querySelector("span:last-child");
          const icon = this.querySelector("i");
          const count = parseInt(countEl.textContent, 10) || 0;

          if (data.status === "added") {
            this.classList.add("is-liked");
            countEl.textContent = count + 1;
            if (icon) icon.classList.replace("fa-regular", "fa-solid");
          } else if (data.status === "removed") {
            this.classList.remove("is-liked");
            countEl.textContent = Math.max(0, count - 1);
            if (icon) icon.classList.replace("fa-solid", "fa-regular");
          }
        } else if (res.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (err) {
        console.error("Like toggle error:", err);
      }
    });
  });

  const epSection = document.getElementById("sec-episodes");
  if (epSection) {
    const tvId = epSection.getAttribute("data-tv-id");
    const seasonBtns = epSection.querySelectorAll(".season-btn");
    const epListEl = document.getElementById("episodesListContainer");

    seasonBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        seasonBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const season = btn.getAttribute("data-season");
        if (!epListEl || !tvId) return;

        epListEl.innerHTML =
          '<p style="color: var(--accent-teal, #00b4d8); padding: 12px; font-size: 0.9rem;">Loading episodes...</p>';

        try {
          const res = await fetch(`/api/tv/${tvId}/season/${season}`);
          const episodes = await res.json();

          if (!episodes || episodes.length === 0) {
            epListEl.innerHTML =
              '<p style="color: #718096; padding: 12px; font-size: 0.9rem;">No episodes available for this season.</p>';
            return;
          }

          epListEl.innerHTML = episodes
            .map((ep) => {
              const num =
                ep.episode_number < 10
                  ? `0${ep.episode_number}`
                  : ep.episode_number;
              const mins = ep.runtime ? `${ep.runtime} min` : "45 min";
              return `
                <a href="javascript:void(0)" class="ep-row ep-link">
                    <span class="ep-num">E${num}</span>
                    <div class="ep-info-flex">
                        <span class="ep-title">${ep.name}</span>
                        <span class="ep-time">${mins}</span>
                    </div>
                </a>
              `;
            })
            .join("");
        } catch (err) {
          epListEl.innerHTML =
            '<p style="color: #ff4757; padding: 12px; font-size: 0.9rem;">Failed to load episodes. Please try again.</p>';
        }
      });
    });
  }

  document.querySelectorAll(".review-body.blurred").forEach((el) => {
    el.addEventListener("click", function () {
      if (this.classList.contains("blurred")) {
        this.classList.replace("blurred", "revealed");
        const fullText = this.getAttribute("data-full-text");
        if (fullText) this.innerText = fullText;
      }
    });
  });

  const revRow = document.getElementById("reviewsRow");
  const revPrev = document.getElementById("reviewPrev");
  const revNext = document.getElementById("reviewNext");
  if (revRow && revPrev && revNext) {
    revPrev.addEventListener("click", () => {
      const card = revRow.querySelector(".minimal-review-card");
      const step = card ? card.offsetWidth + 16 : 300;
      revRow.scrollBy({ left: -step, behavior: "smooth" });
    });
    revNext.addEventListener("click", () => {
      const card = revRow.querySelector(".minimal-review-card");
      const step = card ? card.offsetWidth + 16 : 300;
      revRow.scrollBy({ left: step, behavior: "smooth" });
    });
  }

  const castRow = document.getElementById("castCarousel");
  const castPrev = document.getElementById("castPrev");
  const castNext = document.getElementById("castNext");
  if (castRow && castPrev && castNext) {
    castPrev.addEventListener("click", () => {
      const card = castRow.querySelector(".cast-card");
      const step = card ? (card.offsetWidth + 16) * 2 : 300;
      castRow.scrollBy({ left: -step, behavior: "smooth" });
    });
    castNext.addEventListener("click", () => {
      const card = castRow.querySelector(".cast-card");
      const step = card ? (card.offsetWidth + 16) * 2 : 300;
      castRow.scrollBy({ left: step, behavior: "smooth" });
    });
  }
});
