(function initAuthGuard() {
  const isLoggedOut = () =>
    document.body && document.body.classList.contains("logged-out");

  let toastTimer = null;

  window.showAuthToast = function (msg) {
    let toast = document.getElementById("cindromeAuthToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cindromeAuthToast";
      toast.className = "auth-toast";
      toast.setAttribute("role", "status");
      toast.innerHTML = `
        <div class="auth-toast-content">
          <i class="fa-solid fa-lock auth-toast-icon" aria-hidden="true"></i>
          <span class="auth-toast-msg"></span>
        </div>
        <div class="auth-toast-actions">
          <a href="/sign-in" class="auth-toast-signin">Sign In</a>
          <button type="button" class="auth-toast-close" aria-label="Close">&times;</button>
        </div>
      `;
      document.body.appendChild(toast);

      toast.querySelector(".auth-toast-close").addEventListener("click", () => {
        toast.classList.remove("visible");
      });
    }

    toast.querySelector(".auth-toast-msg").textContent =
      msg || "Sign in to interact with movies, lists, and reviews.";

    requestAnimationFrame(() => toast.classList.add("visible"));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4500);
  };

  window.requireAuth = function (msg) {
    if (isLoggedOut()) {
      window.showAuthToast(msg);
      return false;
    }
    return true;
  };

  const baseFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await baseFetch.apply(this, args);
    if (
      res.status === 401 ||
      (res.redirected && res.url && res.url.includes("/sign-in"))
    ) {
      window.showAuthToast("Please sign in to perform this action.");
    }
    return res;
  };
})();

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

  const logModal = document.getElementById("logModal");
  const openLogBtn = document.getElementById("openLogModal");
  const navLogBtn = document.getElementById("navLogBtn");
  const closeLogBtn = document.getElementById("closeLogModalBtn");
  const cancelLogBtn = document.getElementById("cancelLogBtn");

  const openLog = () => {
    if (!window.requireAuth("Sign in to log and rate movies or shows.")) return;
    if (logModal) logModal.style.display = "flex";
  };

  const closeLog = () => {
    if (logModal) logModal.style.display = "none";
  };

  if (openLogBtn) openLogBtn.addEventListener("click", openLog);
  if (navLogBtn) navLogBtn.addEventListener("click", openLog);
  if (closeLogBtn) closeLogBtn.addEventListener("click", closeLog);
  if (cancelLogBtn) cancelLogBtn.addEventListener("click", closeLog);

  const createListBtn = document.getElementById("openCreateListBtn");
  if (createListBtn) {
    createListBtn.addEventListener(
      "click",
      (e) => {
        if (!window.requireAuth("Sign in to create your own lists.")) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  }

  window.addEventListener("click", (e) => {
    if (e.target === searchModal) searchModal.style.display = "none";
    if (e.target === logModal) closeLog();
  });

  const dateInput = document.getElementById("watchDate");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  document
    .querySelectorAll("#logModal .icon-toggle-btn:not(.spoiler-btn)")
    .forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("active"));
    });

  const spoilerBtn = document.querySelector("#logModal .spoiler-btn");
  if (spoilerBtn) {
    spoilerBtn.addEventListener("click", () =>
      spoilerBtn.classList.toggle("spoiler-active"),
    );
  }

  const stars = document.querySelectorAll("#logModal .rate-star");
  let rating = 0;

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

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".css-dropdown").forEach((dd) => {
      if (!dd.contains(e.target)) dd.removeAttribute("open");
    });
  });
});

async function toggleWatchlist(btn, tmdbId, mediaType) {
  if (!window.requireAuth("Sign in to add titles to your watchlist.")) return;

  const isHero = btn.classList.contains("hero-watchlist-btn");
  const prevHtml = btn.innerHTML;

  btn.innerHTML = isHero
    ? `<span class="default-content"><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>`
    : `<i class="fa-solid fa-spinner fa-spin"></i>`;
  btn.disabled = true;

  try {
    const res = await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    if (res.status === 200 && !res.redirected) {
      await res.json();
      btn.classList.toggle("added");

      if (btn.classList.contains("mini-bar-btn")) {
        const added = btn.classList.contains("added");
        const minusSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        const plusSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

        btn.innerHTML = added ? minusSvg : plusSvg;
        btn.setAttribute(
          "title",
          added ? "Remove from Watchlist" : "Add to Watchlist",
        );
      } else {
        btn.innerHTML = prevHtml;
      }
    } else {
      btn.innerHTML = prevHtml;
    }
  } catch (err) {
    console.error("Network error:", err);
    btn.innerHTML = prevHtml;
  } finally {
    btn.disabled = false;
  }
}

async function toggleLike(btn, tmdbId, mediaType) {
  if (!window.requireAuth("Sign in to like movies and shows.")) return;

  const prevHtml = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  btn.disabled = true;

  try {
    const res = await fetch("/api/like/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
    });

    if (res.status === 200 && !res.redirected) {
      await res.json();
      btn.classList.toggle("liked");

      if (btn.classList.contains("btn-fav")) {
        btn.classList.toggle("is-favorited");
        btn.innerHTML = prevHtml;
      } else {
        const liked = btn.classList.contains("liked");
        btn.innerHTML = `<i class="${liked ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
      }
    } else {
      btn.innerHTML = prevHtml;
    }
  } catch (err) {
    console.error("Network error:", err);
    btn.innerHTML = prevHtml;
  } finally {
    btn.disabled = false;
  }
}
