document.addEventListener("DOMContentLoaded", () => {
  const likeToggle = document.getElementById("likeToggle");
  const rewatchToggle = document.getElementById("rewatchToggle");
  const spoilerToggle = document.getElementById("spoilerToggle");

  function bindToggle(btn, cls) {
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle(cls);
      this.classList.remove(
        cls === "spoiler-active" ? "active" : "spoiler-active",
      );
    });
  }

  bindToggle(likeToggle, "active");
  bindToggle(rewatchToggle, "active");
  bindToggle(spoilerToggle, "spoiler-active");

  const listLikeBtn = document.querySelector(
    ".single-list-actions-inline .like-btn",
  );
  const shareBtn = document.querySelector(
    ".single-list-actions-inline .share-btn",
  );

  if (listLikeBtn) {
    listLikeBtn.addEventListener("click", async () => {
      const listId = listLikeBtn.getAttribute("data-list-id");
      if (!listId) return;

      try {
        const res = await fetch(`/api/lists/${listId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          const countEl =
            listLikeBtn.querySelector(".like-count") ||
            listLikeBtn.querySelector("span");
          const count = parseInt(countEl.textContent, 10) || 0;

          if (data.status === "added") {
            listLikeBtn.classList.add("is-liked");
            countEl.textContent = count + 1;
          } else if (data.status === "removed") {
            listLikeBtn.classList.remove("is-liked");
            countEl.textContent = Math.max(0, count - 1);
          }
        } else if (res.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (err) {
        console.error("Like error:", err);
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const span = shareBtn.querySelector("span");
      const prevText = span.textContent;
      try {
        await navigator.clipboard.writeText(window.location.href);
        span.textContent = "Copied!";
        shareBtn.classList.add("is-copied");
        setTimeout(() => {
          span.textContent = prevText;
          shareBtn.classList.remove("is-copied");
        }, 2000);
      } catch (err) {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.value = window.location.href;
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = prevText;
        }, 2000);
      }
    });
  }

  const delBtn = document.getElementById("deleteListBtn");
  const delModal = document.getElementById("deleteListModal");
  const cancelDelBtn = document.getElementById("cancelDeleteListBtn");
  const confirmDelBtn = document.getElementById("confirmDeleteListBtn");

  if (delBtn && delModal) {
    delBtn.addEventListener("click", () => {
      delModal.style.display = "flex";
    });
    cancelDelBtn.addEventListener("click", () => {
      delModal.style.display = "none";
    });
    delModal.addEventListener("click", (e) => {
      if (e.target === delModal) delModal.style.display = "none";
    });

    confirmDelBtn.addEventListener("click", async () => {
      const listId = delBtn.getAttribute("data-list-id");
      const prevHtml = confirmDelBtn.innerHTML;

      confirmDelBtn.innerHTML = "Deleting...";
      confirmDelBtn.disabled = true;
      confirmDelBtn.style.opacity = "0.7";

      try {
        const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
        const data = await res.json();

        if (res.ok) {
          window.location.href = `/profile/${data.username}`;
        } else {
          alert(data.error || "Failed to delete the list. Please try again.");
          confirmDelBtn.innerHTML = prevHtml;
          confirmDelBtn.disabled = false;
          confirmDelBtn.style.opacity = "1";
          delModal.style.display = "none";
        }
      } catch (err) {
        alert("Network error.");
        confirmDelBtn.innerHTML = prevHtml;
        confirmDelBtn.disabled = false;
        confirmDelBtn.style.opacity = "1";
        delModal.style.display = "none";
      }
    });
  }

  const gridEl = document.querySelector(".single-list-cards-grid");
  const plusSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  const minusSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

  if (gridEl) {
    gridEl.addEventListener("click", (e) => {
      const card = e.target.closest(".mini-content-card");
      if (!card) return;

      const tmdb_id = card.dataset.id;
      const media_type = card.dataset.type;

      const addBtn = e.target.closest(".btn-add");
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();

        fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdb_id, media_type }),
        });

        const added = addBtn.classList.toggle("is-added");
        addBtn.innerHTML = added ? minusSvg : plusSvg;
        addBtn.setAttribute(
          "title",
          added ? "Remove from Watchlist" : "Add to Watchlist",
        );
        return;
      }

      const favBtn = e.target.closest(".btn-fav");
      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();

        fetch("/api/like/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdb_id, media_type }),
        });

        favBtn.classList.toggle("is-favorited");
        return;
      }

      if (window.innerWidth <= 768) {
        document
          .querySelectorAll(".mini-content-card.show-bar")
          .forEach((c) => {
            if (c !== card) c.classList.remove("show-bar");
          });
        card.classList.toggle("show-bar");
      }
    });
  }

  const editBtn = document.getElementById("editListTriggerBtn");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const helper = document.getElementById("listDataHelper");
      if (!helper) {
        alert("Error: Data helper not found.");
        return;
      }

      try {
        const list = JSON.parse(helper.getAttribute("data-list"));
        const items = JSON.parse(helper.getAttribute("data-items"));

        if (!list || !list.id) {
          alert("Data is still loading, please wait...");
          return;
        }

        window.dispatchEvent(
          new CustomEvent("openEditListMode", { detail: { list, items } }),
        );
      } catch (err) {
        alert("Failed to load list data for editing.");
      }
    });
  }
});
