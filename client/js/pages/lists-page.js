document.addEventListener("DOMContentLoaded", () => {
  const gridEl = document.getElementById("listsGrid");
  const loaderEl = document.getElementById("listsLoader");
  const emptyEl = document.getElementById("noListsMsg");
  const searchInput = document.querySelector(".lists-search-input");
  const filterDd = document.getElementById("listsFilterDropdown");
  const pagesEl = document.getElementById("paginationContainer");
  const cardTpl = document.getElementById("listCardTemplate");

  let query = "";
  let filter = "Popular";
  let page = 1;

  function bindLogToggles() {
    const likeBtn = document.getElementById("likeToggle");
    const rewatchBtn = document.getElementById("rewatchToggle");
    const spoilerBtn = document.getElementById("spoilerToggle");

    if (likeBtn && !likeBtn.dataset.listsBound) {
      likeBtn.dataset.listsBound = "true";
      likeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.toggle("active");
        this.classList.remove("spoiler-active");
      });
    }

    if (rewatchBtn && !rewatchBtn.dataset.listsBound) {
      rewatchBtn.dataset.listsBound = "true";
      rewatchBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.toggle("active");
        this.classList.remove("spoiler-active");
      });
    }

    if (spoilerBtn && !spoilerBtn.dataset.listsBound) {
      spoilerBtn.dataset.listsBound = "true";
      spoilerBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.toggle("spoiler-active");
        this.classList.remove("active");
      });
    }
  }

  bindLogToggles();

  async function loadLists() {
    if (gridEl) gridEl.innerHTML = "";
    if (loaderEl) loaderEl.style.display = "block";
    if (emptyEl) emptyEl.style.display = "none";

    try {
      const res = await fetch(
        `/api/lists/explore?search=${encodeURIComponent(query)}&filter=${filter}&page=${page}`,
      );
      const data = await res.json();
      renderLists(data.lists);
      renderPages(data.currentPage, data.totalPages);
    } catch (err) {
      console.error("Lists fetch error:", err);
      if (loaderEl) loaderEl.style.display = "none";
    }
  }

  function renderLists(lists) {
    if (loaderEl) loaderEl.style.display = "none";
    if (gridEl) gridEl.innerHTML = "";

    if (!lists || lists.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    lists.forEach((list) => {
      const clone = cardTpl.content.cloneNode(true);
      const card = clone.querySelector(".list-card");

      const posters = list.preview_posters || [];
      card.querySelectorAll(".stack-poster").forEach((img, idx) => {
        if (posters[idx]) {
          img.src = posters[idx].startsWith("http")
            ? posters[idx]
            : `https://image.tmdb.org/t/p/w500${posters[idx]}`;
          img.style.opacity = "1";
          img.style.filter = "none";
        } else {
          img.src = "/assets/posters/default-poster.png";
          img.style.opacity = "0.5";
          img.style.filter = "grayscale(100%)";
        }
        img.onerror = function () {
          this.onerror = null;
          this.src = "/assets/posters/default-poster.png";
        };
      });

      const listUrl = `/single-list?id=${list.list_id}`;
      const stack = card.querySelector(".poster-stack");
      if (stack) {
        stack.addEventListener("click", () => {
          window.location.href = listUrl;
        });
      }

      const titleEl = card.querySelector(".list-title");
      if (titleEl) {
        titleEl.textContent = list.title;
        titleEl.href = listUrl;
      }

      const authorEl = card.querySelector(".list-author-link");
      if (authorEl) {
        authorEl.textContent = `@${list.username}`;
        authorEl.href = `/profile/${list.username}`;
      }

      const countEl = card.querySelector(".count-num");
      if (countEl) countEl.textContent = list.total_items;

      const likeBtn = card.querySelector(".like-btn");
      if (likeBtn) {
        likeBtn.setAttribute("data-list-id", list.list_id);
        if (list.is_liked_by_user) likeBtn.classList.add("is-liked", "liked");
        const likeCountEl = card.querySelector(".like-count");
        if (likeCountEl) likeCountEl.textContent = fmtCount(list.likes_count);

        likeBtn.addEventListener("click", async function (e) {
          e.preventDefault();
          e.stopPropagation();

          try {
            const res = await fetch(`/api/lists/${list.list_id}/like`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            if (res.ok) {
              const data = await res.json();
              const span = this.querySelector(".like-count");
              const num = parseInt(span.textContent.replace(/,/g, ""), 10) || 0;
              if (data.status === "added") {
                this.classList.add("is-liked", "liked");
                span.textContent = fmtCount(num + 1);
              } else {
                this.classList.remove("is-liked", "liked");
                span.textContent = fmtCount(Math.max(0, num - 1));
              }
            } else if (res.status === 401) {
              window.location.href = "/sign-in";
            }
          } catch (err) {
            console.error("Like error:", err);
          }
        });
      }

      const commentBtn = card.querySelector(".comment-btn");
      if (commentBtn) {
        commentBtn.href = `${listUrl}#comments-section`;
        const commentCountEl = card.querySelector(".comment-count");
        if (commentCountEl) {
          commentCountEl.textContent = fmtCount(list.comments_count);
        }
      }

      gridEl.appendChild(card);
    });
  }

  function fmtCount(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n;
  }

  function renderPages(cur, total) {
    if (!pagesEl) return;
    pagesEl.innerHTML = "";
    if (total <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.className = `page-btn prev-next ${cur === 1 ? "disabled" : ""}`;
    prevBtn.textContent = "PREV";
    prevBtn.disabled = cur === 1;
    prevBtn.addEventListener("click", () => {
      if (cur > 1) {
        page--;
        loadLists();
      }
    });
    pagesEl.appendChild(prevBtn);

    let start = Math.max(1, cur - 1);
    let end = Math.min(total, cur + 1);
    if (cur === 1) end = Math.min(total, 3);
    if (cur === total) start = Math.max(1, total - 2);

    for (let i = start; i <= end; i++) {
      const btn = document.createElement("button");
      btn.className = `page-btn page-num-btn ${i === cur ? "active" : ""}`;
      btn.textContent = i;
      btn.addEventListener("click", () => {
        page = i;
        loadLists();
      });
      pagesEl.appendChild(btn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = `page-btn prev-next ${cur === total ? "disabled" : ""}`;
    nextBtn.textContent = "NEXT";
    nextBtn.disabled = cur === total;
    nextBtn.addEventListener("click", () => {
      if (cur < total) {
        page++;
        loadLists();
      }
    });
    pagesEl.appendChild(nextBtn);
  }

  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = e.target.value;
        page = 1;
        loadLists();
      }, 500);
    });
  }

  if (filterDd) {
    const label = filterDd.querySelector(".dropdown-label-text");
    filterDd.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const nextFilter = this.textContent.trim();
        if (label) label.textContent = nextFilter;
        filterDd.removeAttribute("open");

        if (filter !== nextFilter) {
          filter = nextFilter;
          page = 1;
          loadLists();
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (filterDd.hasAttribute("open") && !filterDd.contains(e.target)) {
        filterDd.removeAttribute("open");
      }
    });
  }

  loadLists();
});
