document.addEventListener("DOMContentLoaded", () => {
  const loginInput = document.getElementById("loginInput");
  const passInput = document.getElementById("password");
  const rememberBox = document.getElementById("remember");
  const toggleBtn = document.getElementById("togglePasswordBtn");

  const savedId = localStorage.getItem("cindrome_remembered_identifier");
  if (savedId && loginInput) {
    loginInput.value = savedId;
    if (rememberBox) rememberBox.checked = true;
  }

  if (toggleBtn && passInput) {
    toggleBtn.addEventListener("click", () => {
      const hidden = passInput.type === "password";
      passInput.type = hidden ? "text" : "password";

      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.className = hidden
          ? "fa-regular fa-eye-slash"
          : "fa-regular fa-eye";
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const errorEl = document.getElementById("loginError");

  if (params.has("error") && loginInput && passInput) {
    loginInput.closest(".form-group").classList.add("has-error");
    passInput.closest(".form-group").classList.add("has-error");
    if (errorEl) errorEl.textContent = "Invalid email/username or password.";
  }
});
