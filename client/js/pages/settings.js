document.addEventListener("DOMContentLoaded", () => {
  const tabBtns = document.querySelectorAll(".settings-tab-btn");
  const panels = document.querySelectorAll(".settings-panel");

  function openTab(tabId, activeBtn) {
    panels.forEach((p) => {
      p.style.display = "none";
    });
    const target = document.getElementById(`tab-${tabId}`);
    if (target) target.style.display = "block";

    tabBtns.forEach((b) => b.classList.remove("is-active"));
    if (activeBtn) activeBtn.classList.add("is-active");
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      openTab(this.getAttribute("data-tab"), this);
    });
  });

  async function savePrefs(btn) {
    const isPrivate =
      document.getElementById("privateAccountToggle")?.checked || false;
    const notifyFollowers =
      document.getElementById("notifyFollowersToggle")?.checked || false;
    const notifyReviews =
      document.getElementById("notifyReviewsToggle")?.checked || false;

    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_private: isPrivate,
          notify_new_follower: notifyFollowers,
          notify_review_interaction: notifyReviews,
        }),
      });

      if (res.ok) {
        const prevText = btn.textContent;
        btn.textContent = "Saved Successfully";
        btn.style.backgroundColor = "#0be3e3";
        setTimeout(() => {
          btn.textContent = prevText;
          btn.style.backgroundColor = "";
        }, 2000);
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      alert("Server connection failed.");
    }
  }

  const savePrivacyBtn = document.getElementById("savePrivacyBtn");
  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener("click", () => savePrefs(savePrivacyBtn));
  }

  const saveNotifBtn = document.getElementById("saveNotificationsBtn");
  if (saveNotifBtn) {
    saveNotifBtn.addEventListener("click", () => savePrefs(saveNotifBtn));
  }

  const updatePassBtn = document.getElementById("updatePasswordBtn");
  const changeEmailBtn = document.getElementById("changeEmailBtn");

  async function saveSecurity(btn, mode) {
    const newEmail = document.getElementById("newEmailInput")?.value.trim();
    const currentPassword = document
      .getElementById("currentPasswordInput")
      ?.value.trim();
    const newPassword = document
      .getElementById("newPasswordInput")
      ?.value.trim();
    const confirmPassword = document
      .getElementById("confirmPasswordInput")
      ?.value.trim();

    const body = {};

    if (mode === "email") {
      if (!newEmail) return alert("Please enter a new email.");
      body.newEmail = newEmail;
    } else if (mode === "password") {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return alert("Please fill in all password fields.");
      }
      if (newPassword !== confirmPassword) {
        return alert("New passwords do not match.");
      }
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    try {
      const res = await fetch("/api/settings/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        const prevText = btn.textContent;
        btn.textContent = "Updated Successfully";
        setTimeout(() => {
          btn.textContent = prevText;
          if (mode === "email") {
            document.getElementById("newEmailInput").value = "";
          }
          if (mode === "password") {
            document.getElementById("currentPasswordInput").value = "";
            document.getElementById("newPasswordInput").value = "";
            document.getElementById("confirmPasswordInput").value = "";
          }
        }, 2000);
      } else {
        alert(data.error || "Failed to update security settings.");
      }
    } catch (err) {
      alert("Server connection failed.");
    }
  }

  if (changeEmailBtn) {
    changeEmailBtn.addEventListener("click", () =>
      saveSecurity(changeEmailBtn, "email"),
    );
  }
  if (updatePassBtn) {
    updatePassBtn.addEventListener("click", () =>
      saveSecurity(updatePassBtn, "password"),
    );
  }

  const delModal = document.getElementById("deleteAccountModal");
  const openDelBtn = document.getElementById("openDeleteModalBtn");
  const closeDelBtn = document.getElementById("closeDeleteModalBtn");
  const cancelDelBtn = document.getElementById("cancelDeleteBtn");
  const confirmDelBtn = document.getElementById("confirmDeleteBtn");

  const closeModal = () => {
    if (delModal) delModal.style.display = "none";
  };

  if (openDelBtn) {
    openDelBtn.addEventListener("click", () => {
      if (delModal) delModal.style.display = "flex";
    });
  }
  if (closeDelBtn) closeDelBtn.addEventListener("click", closeModal);
  if (cancelDelBtn) cancelDelBtn.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => {
    if (e.target === delModal) closeModal();
  });

  if (confirmDelBtn) {
    confirmDelBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/settings/account", { method: "DELETE" });
        if (res.ok) {
          localStorage.clear();
          window.location.href = "/sign-in";
        } else {
          alert("Failed to delete account. Please try again.");
        }
      } catch (err) {
        alert("Server connection failed.");
      }
    });
  }
});
