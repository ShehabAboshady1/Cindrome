document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("dromeInput");
  const inputBox = document.getElementById("dromeInputBox");
  const sendBtn = document.getElementById("mainSendBtn");
  const sendIcon = document.getElementById("sendBtnIcon");
  const newChatBtn = document.getElementById("newChatBtn");
  const authBanner = document.getElementById("dromeAuthBanner");

  const chatBox = document.getElementById("chatContainer");
  const chatInner = document.getElementById("chatInner");
  const emptyState = document.getElementById("emptyState");
  const typingEl = document.getElementById("typingIndicator");

  const promptBtns = document.querySelectorAll(".prompt-btn");
  const focusItems = document.querySelectorAll(
    "#dromeFocusList .dropdown-item",
  );
  const focusLabel = document.getElementById("currentFocusText");
  const focusDropdown = document.getElementById("contentDropdown");

  const userTpl = document.getElementById("userBubbleTemplate");
  const dromeTpl = document.getElementById("dromeBubbleTemplate");
  const stopTpl = document.getElementById("stopBubbleTemplate");
  const cardTpl = document.getElementById("chatMovieCardTemplate");

  const isAuth = Boolean(window.IS_AUTHENTICATED);
  const uid = window.CURRENT_USER_ID || null;
  const storeKey = isAuth && uid ? `cindrome_chat_${uid}` : null;

  let busy = false;
  let controller = null;
  let history = [];

  function checkAuth() {
    if (!isAuth) {
      if (authBanner) authBanner.classList.remove("is-hidden");
      if (inputBox) inputBox.classList.add("disabled");
      if (inputEl) {
        inputEl.disabled = true;
        inputEl.placeholder =
          "Please sign in to start chatting with Cindrome...";
      }
      if (sendBtn) sendBtn.disabled = true;
      promptBtns.forEach((btn) => (btn.disabled = true));
      return false;
    }

    if (authBanner) authBanner.classList.add("is-hidden");
    if (inputBox) inputBox.classList.remove("disabled");
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.placeholder = "Type a message...";
    }
    if (sendBtn) sendBtn.disabled = false;
    promptBtns.forEach((btn) => (btn.disabled = false));
    return true;
  }

  function saveChat() {
    if (!storeKey) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(history));
    } catch (err) {}
  }

  function loadChat() {
    if (!storeKey) {
      resetChatDom();
      return;
    }

    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return;

      history = JSON.parse(raw) || [];
      if (history.length > 0) {
        if (emptyState) emptyState.classList.add("is-hidden");

        history.forEach((msg) => {
          if (msg.role === "user") addUserMsg(msg.text);
          else if (msg.role === "drome")
            addDromeMsg(msg.message, msg.results || []);
          else if (msg.role === "stopped") addStopMsg();
        });

        setTimeout(() => {
          chatBox.scrollTop = chatBox.scrollHeight;
        }, 50);
      }
    } catch (err) {
      localStorage.removeItem(storeKey);
      history = [];
    }
  }

  function resetChatDom() {
    history = [];
    if (chatInner) {
      chatInner
        .querySelectorAll(".chat-bubble:not(.typing-indicator-bubble)")
        .forEach((b) => b.remove());
    }
    if (emptyState) emptyState.classList.remove("is-hidden");
  }

  function addUserMsg(text) {
    const clone = userTpl.content.cloneNode(true);
    clone.querySelector(".message-text").textContent = text;
    chatInner.insertBefore(clone, typingEl);
  }

  function addDromeMsg(message, results = []) {
    const clone = dromeTpl.content.cloneNode(true);
    clone.querySelector(".message-text").textContent = message;

    const row = clone.querySelector(".chat-cards-row");
    if (results && results.length > 0) {
      results.forEach((item) => row.appendChild(buildCard(item)));
    }

    chatInner.insertBefore(clone, typingEl);
  }

  function addStopMsg() {
    const clone = stopTpl.content.cloneNode(true);
    chatInner.insertBefore(clone, typingEl);
  }

  function buildCard(item) {
    const clone = cardTpl.content.cloneNode(true);
    clone.querySelector(".chat-movie-poster").src =
      item.poster || "/assets/posters/default-poster.png";
    clone.querySelector(".chat-movie-title").textContent = item.title;
    clone.querySelector(".chat-movie-year").textContent =
      item.meta || item.year || "";
    clone.querySelector(".rating-val").textContent = item.score || "NR";
    clone.querySelector(".chat-btn-details").href =
      `/details?id=${item.id}&type=${item.mediaType}`;

    const wlBtn = clone.querySelector(".chat-btn-watchlist");
    const minusIcon = wlBtn.querySelector(".icon-minus");
    const plusIcon = wlBtn.querySelector(".icon-plus");

    if (item.inWatchlist) {
      wlBtn.classList.add("added");
      wlBtn.title = "Remove from Watchlist";
      minusIcon.style.display = "inline-block";
      plusIcon.style.display = "none";
    } else {
      wlBtn.classList.remove("added");
      wlBtn.title = "Add to Watchlist";
      minusIcon.style.display = "none";
      plusIcon.style.display = "inline-block";
    }

    wlBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      if (!isAuth) {
        window.location.href = "/sign-in";
        return;
      }
      if (this.disabled) return;
      this.disabled = true;

      try {
        const res = await fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: item.id,
            media_type: item.mediaType,
          }),
        });

        if (res.status === 401 || res.redirected) {
          window.location.href = "/sign-in";
          return;
        }

        const data = await res.json();
        if (res.ok) {
          const added = data.status === "added";
          item.inWatchlist = added;
          saveChat();

          this.classList.toggle("added", added);
          minusIcon.style.display = added ? "inline-block" : "none";
          plusIcon.style.display = added ? "none" : "inline-block";
          this.title = added ? "Remove from Watchlist" : "Add to Watchlist";
        } else {
          alert(data.error || "Failed to update watchlist");
        }
      } catch (err) {
        console.error("Watchlist toggle error:", err);
      } finally {
        this.disabled = false;
      }
    });

    return clone;
  }

  function resizeInput() {
    inputEl.style.height = "auto";
    inputEl.style.height = `${inputEl.scrollHeight}px`;
  }

  if (inputEl) {
    inputEl.addEventListener("input", resizeInput);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!busy) sendPrompt();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      if (busy) cancelPrompt();
      else sendPrompt();
    });
  }

  promptBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      if (!checkAuth() || busy) return;
      inputEl.value = this.getAttribute("data-prompt");
      resizeInput();
      sendPrompt();
    });
  });

  focusItems.forEach((item) => {
    item.addEventListener("click", function () {
      focusLabel.textContent = this.textContent;
      focusDropdown.removeAttribute("open");
      if (isAuth && inputEl && window.innerWidth > 768) {
        inputEl.focus();
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (
      focusDropdown &&
      focusDropdown.hasAttribute("open") &&
      !focusDropdown.contains(e.target)
    ) {
      focusDropdown.removeAttribute("open");
    }
  });

  async function sendPrompt() {
    if (!checkAuth()) return;

    const text = inputEl.value.trim();
    if (!text || busy) return;

    const focusType = focusLabel.textContent.trim().toLowerCase();

    busy = true;
    syncInputState();
    if (emptyState) emptyState.classList.add("is-hidden");

    const slimHistory = history
      .filter((msg) => msg.role === "user" || msg.role === "drome")
      .map((msg) =>
        msg.role === "user"
          ? { role: "user", text: msg.text }
          : {
              role: "drome",
              results: Array.isArray(msg.results)
                ? msg.results.map((r) => ({ id: r.id }))
                : [],
            },
      );

    addUserMsg(text);
    history.push({ role: "user", text });
    saveChat();

    inputEl.value = "";
    inputEl.style.height = "auto";
    if (window.innerWidth <= 768) inputEl.blur();

    typingEl.classList.remove("is-hidden");
    chatBox.scrollTop = chatBox.scrollHeight;

    controller = new AbortController();

    try {
      const res = await fetch("/api/drome/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          focusType,
          history: slimHistory,
        }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        window.location.href = "/sign-in";
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Network error");

      typingEl.classList.add("is-hidden");
      addDromeMsg(data.message, data.results || []);
      history.push({
        role: "drome",
        message: data.message,
        results: data.results || [],
      });
      saveChat();
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
      if (err.name !== "AbortError") {
        typingEl.classList.add("is-hidden");
        const fallbackMsg =
          "Sorry, I ran into a technical issue. Please try again.";
        addDromeMsg(fallbackMsg, []);
        history.push({ role: "drome", message: fallbackMsg, results: [] });
        saveChat();
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    } finally {
      endPrompt();
    }
  }

  function cancelPrompt() {
    if (controller) controller.abort();
    typingEl.classList.add("is-hidden");
    addStopMsg();
    history.push({ role: "stopped" });
    saveChat();
    chatBox.scrollTop = chatBox.scrollHeight;
    endPrompt();
  }

  function endPrompt() {
    busy = false;
    syncInputState();
    setTimeout(() => {
      if (isAuth && inputEl && window.innerWidth > 768) inputEl.focus();
    }, 50);
  }

  function syncInputState() {
    if (!isAuth) return;
    if (busy) {
      sendIcon.className = "fa-solid fa-stop";
      inputEl.readOnly = true;
      inputEl.placeholder = "Drome is thinking...";
    } else {
      sendIcon.className = "fa-solid fa-arrow-up";
      inputEl.readOnly = false;
      inputEl.placeholder = "Type a message...";
    }
  }

  function clearChat() {
    history = [];
    if (storeKey) localStorage.removeItem(storeKey);
    resetChatDom();
    chatBox.scrollTop = 0;
    if (isAuth && inputEl && window.innerWidth > 768) inputEl.focus();
  }

  if (newChatBtn) newChatBtn.addEventListener("click", clearChat);

  document
    .querySelectorAll('a[href="/logout"], a[href="/sign-out"], .logout-btn')
    .forEach((link) => {
      link.addEventListener("click", () => {
        if (storeKey) localStorage.removeItem(storeKey);
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("cindrome_chat_")) localStorage.removeItem(k);
        });
      });
    });

  checkAuth();
  loadChat();
});
