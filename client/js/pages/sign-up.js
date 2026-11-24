document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signUpForm");
  const userInput = document.getElementById("username");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const termsBox = document.getElementById("terms");
  const toggleBtn = document.getElementById("togglePasswordBtn");
  const submitBtn = document.getElementById("submitBtn");

  const userErr = document.getElementById("usernameError");
  const emailErr = document.getElementById("emailError");
  const passErr = document.getElementById("passwordError");
  const termsErr = document.getElementById("termsError");

  const reqLen = document.getElementById("req-length");
  const reqUpper = document.getElementById("req-uppercase");
  const reqSpecial = document.getElementById("req-number-special");

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

  function checkPassword(val) {
    const hasLen = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(val);

    setReqState(reqLen, hasLen);
    setReqState(reqUpper, hasUpper);
    setReqState(reqSpecial, hasSpecial);

    return hasLen && hasUpper && hasSpecial;
  }

  function setReqState(el, valid) {
    if (!el) return;
    const icon = el.querySelector(".req-icon");
    el.classList.toggle("valid", valid);
    if (icon) icon.textContent = valid ? "✓" : "•";
  }

  passInput.addEventListener("input", () => {
    checkPassword(passInput.value);
    if (passInput.value.length > 0) clearErr(passInput, passErr);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    let valid = true;
    const uname = userInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passInput.value;

    clearErr(userInput, userErr);
    clearErr(emailInput, emailErr);
    clearErr(passInput, passErr);
    if (termsErr) termsErr.classList.remove("show");

    if (!uname) {
      setErr(userInput, userErr, "Username is required");
      valid = false;
    } else if (uname.length < 3) {
      setErr(userInput, userErr, "Min 3 characters");
      valid = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(uname)) {
      setErr(userInput, userErr, "Letters, numbers, and _ only");
      valid = false;
    }

    if (!email) {
      setErr(emailInput, emailErr, "Email address is required");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr(emailInput, emailErr, "Enter a valid email address");
      valid = false;
    }

    if (!pass) {
      setErr(passInput, passErr, "Password is required");
      valid = false;
    } else if (!checkPassword(pass)) {
      setErr(passInput, passErr, "Password does not meet all requirements");
      valid = false;
    }

    if (!termsBox.checked) {
      if (termsErr) {
        termsErr.textContent = "You must agree to the Terms & Policy";
        termsErr.classList.add("show");
      }
      valid = false;
    }

    if (!valid) return;

    submitBtn.textContent = "Creating Account...";
    submitBtn.disabled = true;
    form.submit();
  });

  function setErr(input, errEl, msg) {
    input.closest(".form-group").classList.add("has-error");
    if (errEl) errEl.textContent = msg;
  }

  function clearErr(input, errEl) {
    input.closest(".form-group").classList.remove("has-error");
    if (errEl) errEl.textContent = "";
  }
});
