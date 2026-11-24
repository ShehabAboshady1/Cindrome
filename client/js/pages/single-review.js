document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("reviewTextWrapper");
  const badge = document.getElementById("spoilerBadge");

  function showSpoiler() {
    if (wrapper && wrapper.classList.contains("is-spoiler")) {
      wrapper.classList.remove("is-spoiler");
      wrapper.classList.add("revealed");
      wrapper.removeAttribute("title");
      if (badge) badge.style.display = "none";
    }
  }

  if (wrapper) wrapper.addEventListener("click", showSpoiler);
  if (badge) badge.addEventListener("click", showSpoiler);

  const likeBtn = document.getElementById("reviewLikeBtn");
  const shareBtn = document.getElementById("reviewShareBtn");

  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      const revId = window.location.pathname.split("/").pop();
      try {
        const res = await fetch(`/api/reviews/${revId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          const span = likeBtn.querySelector("span");
          const count = parseInt(span.textContent, 10) || 0;

          if (data.status === "added") {
            likeBtn.classList.add("is-liked");
            span.textContent = count + 1;
          } else if (data.status === "removed") {
            likeBtn.classList.remove("is-liked");
            span.textContent = Math.max(0, count - 1);
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
      try {
        await navigator.clipboard.writeText(window.location.href);
        shareBtn.classList.add("is-copied");
        shareBtn.setAttribute("title", "Copied!");
        setTimeout(() => {
          shareBtn.classList.remove("is-copied");
          shareBtn.setAttribute("title", "Copy link");
        }, 800);
      } catch (err) {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.value = window.location.href;
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);

        shareBtn.classList.add("is-copied");
        setTimeout(() => shareBtn.classList.remove("is-copied"), 800);
      }
    });
  }
});
