window.setFollowState = function (state) {
  const btn = document.getElementById("followBtn");
  if (!btn) return;

  const icon = btn.querySelector("i");
  const label = btn.querySelector(".btn-label");

  btn.classList.remove("is-active", "is-requested");

  if (state === "requested") {
    btn.classList.add("is-requested");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Follow request sent");
    if (icon) icon.className = "fa-solid fa-clock";
    if (label) label.textContent = "Requested";
  } else if (state === "following" || state === true) {
    btn.classList.add("is-active");
    btn.setAttribute("aria-pressed", "true");
    btn.setAttribute("aria-label", "Following user");
    if (icon) icon.className = "fa-solid fa-check";
    if (label) label.textContent = "Following";
  } else {
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Follow user");
    if (icon) icon.className = "fa-solid fa-user-plus";
    if (label) label.textContent = "Follow";
  }
};

window.switchProfileTab = function (tabId, btnEl) {
  document.querySelectorAll(".profile-tab-panel").forEach((panel) => {
    panel.style.display = "none";
  });

  const panel = document.getElementById(`panel-${tabId}`);
  if (panel) panel.style.display = "block";

  document.querySelectorAll(".profile-tab-btn").forEach((btn) => {
    btn.classList.remove("is-active");
  });
  if (btnEl) btnEl.classList.add("is-active");

  const container = document.getElementById("mainContainer");
  const overviewSide = document.getElementById("overview-sidebar-content");
  const reviewsSide = document.getElementById("reviews-sidebar-content");

  if (tabId === "overview") {
    if (container) container.classList.remove("hide-sidebar");
    if (overviewSide) overviewSide.style.display = "block";
    if (reviewsSide) reviewsSide.style.display = "none";
  } else if (tabId === "reviews") {
    if (container) container.classList.remove("hide-sidebar");
    if (overviewSide) overviewSide.style.display = "none";
    if (reviewsSide) reviewsSide.style.display = "block";
  } else {
    if (container) container.classList.add("hide-sidebar");
  }
};

window.revealSpoiler = function (el) {
  el.classList.replace("blurred", "revealed");
};

window.scrollFavorites = function (dir) {
  const row = document.getElementById("favoritesRow");
  const card = row?.querySelector(".content-card");
  if (!row || !card) return;
  row.scrollBy({ left: dir * (card.offsetWidth + 14), behavior: "smooth" });
};

window.scrollLists = function (dir) {
  const row = document.getElementById("listsRow");
  const card = row?.querySelector(".list-card");
  if (!row || !card) return;
  row.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: "smooth" });
};

window.setProfileMode = function (mode) {
  document.body.classList.remove("profile-page-self", "profile-page-other");
  document.body.classList.add(
    mode === "other" ? "profile-page-other" : "profile-page-self",
  );
};

window.setPrivacyMode = function (isPrivate) {
  document.body.classList.toggle("is-private", isPrivate);
};

window.expandInlineReview = function (btn) {
  const p = btn.parentElement;
  const full = p.getAttribute("data-full-text");
  p.innerHTML = `${full} <button class="inline-more-btn" onclick="collapseInlineReview(this)">less</button>`;
};

window.collapseInlineReview = function (btn) {
  const p = btn.parentElement;
  const full = p.getAttribute("data-full-text");
  p.innerHTML = `${full.substring(0, 150)}... <button class="inline-more-btn" onclick="expandInlineReview(this)">more</button>`;
};

window.selectDropdownOption = function (optEl, spanId) {
  const span = document.getElementById(spanId);
  if (span) span.textContent = optEl.textContent.trim();
  const dd = optEl.closest("details");
  if (dd) dd.removeAttribute("open");
};

function initEditModal() {
  const modal = document.getElementById("editProfileModal");
  const openBtn = document.getElementById("editProfileBtn");
  const closeBtn = document.getElementById("closeEditModal");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const saveBtn = modal ? modal.querySelector(".btn-save") : null;

  if (openBtn && modal) {
    openBtn.addEventListener("click", () => {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    });
  }

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  const avatarInput = document.getElementById("avatarUpload");
  const avatarImg = document.getElementById("editAvatarPreview");

  if (avatarInput && avatarImg) {
    avatarInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          avatarImg.src = e.target.result;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const bannerInput = document.getElementById("backdropUpload");
  const bannerBox = document.getElementById("editBannerPreview");

  if (bannerInput && bannerBox) {
    bannerInput.addEventListener("change", function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          bannerBox.style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const inputs = modal.querySelectorAll(".edit-input");
      if (inputs.length < 3) return;

      const selected = modal.querySelectorAll(".custom-option.selected");
      const form = new FormData();
      form.append("displayName", inputs[0].value.trim());
      form.append("username", inputs[1].value.trim());
      form.append("bio", inputs[2].value.trim());
      form.append(
        "genre1",
        selected.length > 0 ? selected[0].getAttribute("data-value") : "",
      );
      form.append(
        "genre2",
        selected.length > 1 ? selected[1].getAttribute("data-value") : "",
      );

      if (avatarInput && avatarInput.files[0]) {
        form.append("avatar", avatarInput.files[0]);
      }
      if (bannerInput && bannerInput.files[0]) {
        form.append("backdrop", bannerInput.files[0]);
      }

      const prevText = saveBtn.textContent;
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      try {
        const res = await fetch("/edit-profile", {
          method: "POST",
          body: form,
        });
        const data = await res.json();

        if (res.ok) {
          window.location.href = `/profile/${data.newUsername}`;
        } else {
          alert(data.error || "Failed to update profile");
          saveBtn.textContent = prevText;
          saveBtn.disabled = false;
        }
      } catch (err) {
        alert("Server connection failed.");
        saveBtn.textContent = prevText;
        saveBtn.disabled = false;
      }
    });
  }
}

function initProfileListModal() {
  const itemsBox = document.getElementById("addedItemsContainer");
  const modal = document.getElementById("createListModal");
  const openBtn = document.getElementById("openCreateListBtnProfile");
  const closeBtn = document.getElementById("closeCreateListBtn");
  const cancelBtn = document.getElementById("cancelListBtn");

  const openModal = () => {
    if (modal) modal.style.display = "flex";
  };
  const closeModal = () => {
    if (modal) modal.style.display = "none";
  };

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  let dragged = null;

  function onDragStart() {
    dragged = this;
    setTimeout(() => this.classList.add("dragging"), 0);
  }

  function onDragEnd() {
    this.classList.remove("dragging");
    dragged = null;
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
    if (dragged !== this && itemsBox) {
      const cards = [...itemsBox.querySelectorAll(".modal-mini-card")];
      const from = cards.indexOf(dragged);
      const to = cards.indexOf(this);

      if (from < to) this.after(dragged);
      else this.before(dragged);
    }
  }

  function bindDrag(card) {
    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragend", onDragEnd);
    card.addEventListener("dragover", onDragOver);
    card.addEventListener("dragleave", onDragLeave);
    card.addEventListener("drop", onDrop);
  }

  document.querySelectorAll(".modal-mini-card").forEach(bindDrag);

  if (itemsBox) {
    itemsBox.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-mini-btn");
      if (btn) {
        const card = btn.closest(".mini-content-card");
        if (card) {
          card.style.transform = "scale(0)";
          card.style.opacity = "0";
          setTimeout(() => card.remove(), 200);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  if (params.has("mode")) {
    window.setProfileMode(params.get("mode"));
  }
  if (params.has("private")) {
    window.setPrivacyMode(params.get("private") === "true");
  }

  document.querySelectorAll(".review-body").forEach((p) => {
    const full = p.getAttribute("data-full-text") || p.innerText.trim();
    p.setAttribute("data-full-text", full);

    if (full.length > 150 && !p.classList.contains("blurred")) {
      p.innerHTML = `${full.substring(0, 150)}... <button class="inline-more-btn" onclick="expandInlineReview(this)">more</button>`;
    } else if (!p.classList.contains("blurred")) {
      p.innerHTML = full;
    }
  });

  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    followBtn.addEventListener("click", async () => {
      const targetId = followBtn.getAttribute("data-id");
      const isPrivate = document.body.classList.contains("is-private");
      if (!targetId) return;

      followBtn.disabled = true;
      const labelEl = followBtn.querySelector(".btn-label");
      const prevLabel = labelEl.textContent;
      labelEl.textContent = "...";

      try {
        const res = await fetch("/api/follow/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followingId: targetId }),
        });
        const data = await res.json();

        if (res.ok) {
          if (data.status === "followed") {
            window.setFollowState(isPrivate ? "requested" : "following");
          } else if (data.status === "unfollowed") {
            window.setFollowState("none");
          }
        } else {
          alert(data.error || "Something went wrong.");
          labelEl.textContent = prevLabel;
        }
      } catch (err) {
        alert("Failed to connect to the server.");
        labelEl.textContent = prevLabel;
      } finally {
        followBtn.disabled = false;
      }
    });
  }

  document.querySelectorAll(".custom-select-wrapper").forEach((wrapper) => {
    const trigger = wrapper.querySelector(".custom-select-trigger");
    const label = trigger ? trigger.querySelector("span") : null;
    const menu = wrapper.querySelector(".custom-select-options");
    const opts = wrapper.querySelectorAll(".custom-option");

    if (trigger && menu) {
      trigger.addEventListener("click", (e) => {
        document.querySelectorAll(".custom-select-options").forEach((m) => {
          if (m !== menu) m.classList.remove("open");
        });
        menu.classList.toggle("open");
        e.stopPropagation();
      });
    }

    opts.forEach((opt) => {
      opt.addEventListener("click", function (e) {
        if (label) label.textContent = this.textContent.trim();
        opts.forEach((o) => o.classList.remove("selected"));
        this.classList.add("selected");
        if (menu) menu.classList.remove("open");
        e.stopPropagation();
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select-options").forEach((m) => {
      m.classList.remove("open");
    });
  });

  document.querySelectorAll(".list-action-btn.like-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const listId = this.getAttribute("data-list-id");
      if (!listId) return;

      try {
        const res = await fetch(`/api/lists/${listId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          const countEl =
            this.querySelector(".like-count") || this.querySelector("span");
          const count = parseInt(countEl.textContent, 10) || 0;

          if (data.status === "added") {
            this.classList.add("is-liked");
            countEl.textContent = count + 1;
          } else if (data.status === "removed") {
            this.classList.remove("is-liked");
            countEl.textContent = Math.max(0, count - 1);
          }
        } else if (res.status === 401) {
          window.location.href = "/sign-in";
        }
      } catch (err) {
        console.error("List like error:", err);
      }
    });
  });

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
            this.querySelector(".like-count") || this.querySelector("span");
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

  initEditModal();
  initProfileListModal();

  window.toggleFavoriteProfile = async function (btn, tmdbId, mediaType) {
    const prevHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.1rem; color: #a0aec0;"></i>`;
    btn.disabled = true;

    try {
      const res = await fetch("/api/like/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdb_id: tmdbId, media_type: mediaType }),
      });

      if (res.ok) {
        const card = btn.closest(".content-card");
        if (card) {
          card.style.transition = "all 0.3s ease";
          card.style.transform = "scale(0.8)";
          card.style.opacity = "0";
          setTimeout(() => card.remove(), 300);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Something went wrong.");
        btn.innerHTML = prevHtml;
        btn.disabled = false;
      }
    } catch (err) {
      alert("Failed to connect to the server.");
      btn.innerHTML = prevHtml;
      btn.disabled = false;
    }
  };

  const spoilerInput = document.querySelector(
    '.spoiler-toggle-wrapper input[type="checkbox"]',
  );
  const feed = document.querySelector(".minimal-reviews-feed");

  function filterReviews() {
    if (!feed) return;

    const cards = Array.from(feed.querySelectorAll(".minimal-review-card"));
    const menus = document.querySelectorAll(
      "#reviews-sidebar-content .custom-select-options",
    );

    const mediaOpt = menus[0]?.querySelector(".custom-option.selected");
    const ratingOpt = menus[1]?.querySelector(".custom-option.selected");
    const sortOpt = menus[2]?.querySelector(".custom-option.selected");

    const showSpoilers = spoilerInput ? spoilerInput.checked : true;
    const mediaFilter = mediaOpt ? mediaOpt.getAttribute("data-value") : "all";
    const ratingFilter = ratingOpt
      ? ratingOpt.getAttribute("data-value")
      : "any";
    const sortOrder = sortOpt ? sortOpt.getAttribute("data-value") : "newest";

    const visible = [];

    cards.forEach((card) => {
      const type = card.dataset.type;
      const rating = parseFloat(card.dataset.rating) || 0;
      const hasSpoiler = card.dataset.spoiler === "true";

      let show = true;
      if (!showSpoilers && hasSpoiler) show = false;
      if (mediaFilter !== "all") {
        const expected = mediaFilter === "movies" ? "movie" : mediaFilter;
        if (type !== expected) show = false;
      }
      if (ratingFilter !== "any" && rating < parseFloat(ratingFilter)) {
        show = false;
      }

      card.style.display = show ? "flex" : "none";
      if (show) visible.push(card);
    });

    visible.sort((a, b) => {
      const tA = parseInt(a.dataset.timestamp, 10) || 0;
      const tB = parseInt(b.dataset.timestamp, 10) || 0;
      const rA = parseFloat(a.dataset.rating) || 0;
      const rB = parseFloat(b.dataset.rating) || 0;

      if (sortOrder === "oldest") return tA - tB;
      if (sortOrder === "highest") return rB - rA;
      if (sortOrder === "lowest") return rA - rB;
      return tB - tA;
    });

    feed.querySelectorAll(".review-divider").forEach((hr) => hr.remove());
    const emptyEl = document.getElementById("filterEmptyState");

    if (visible.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      visible.forEach((card, idx) => {
        feed.appendChild(card);
        if (idx < visible.length - 1) {
          const hr = document.createElement("hr");
          hr.className = "review-divider";
          feed.appendChild(hr);
        }
      });
      if (emptyEl) feed.appendChild(emptyEl);
    }
  }

  if (spoilerInput) spoilerInput.addEventListener("change", filterReviews);

  document
    .querySelectorAll("#reviews-sidebar-content .custom-option")
    .forEach((opt) => {
      opt.addEventListener("click", () => setTimeout(filterReviews, 50));
    });
});
