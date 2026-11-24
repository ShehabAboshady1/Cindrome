document.addEventListener("DOMContentLoaded", () => {
  const section = document.getElementById("comments-section");
  const listEl = document.getElementById("commentsListContainer");
  const mainInput = document.querySelector(
    ".add-comment-box .comment-textarea",
  );
  const mainBtn = document.querySelector(".add-comment-box .modern-post-btn");
  const countHeader = document.querySelector(".comments-count");
  const template = document.getElementById("commentTemplate");
  const fallbackAvatar = "/assets/avatars/default-avatar.jpeg";

  let targetId = null;
  let targetType = "review";

  if (section) {
    targetId = section.getAttribute("data-target-id");
    targetType = section.getAttribute("data-target-type") || "review";

    if (!targetId && targetType === "review") {
      targetId = window.location.pathname.split("/").pop();
    }
  }

  function updateCount(delta = 1) {
    if (!countHeader) return;
    const total = parseInt(countHeader.textContent, 10) || 0;
    countHeader.textContent = total + delta;
  }

  function buildCommentEl(data, isReply = false) {
    if (!template) return null;
    const clone = template.content.cloneNode(true);
    const root = clone.querySelector(
      isReply ? ".single-comment" : ".comment-thread",
    );
    const box = isReply ? root : root.querySelector(".single-comment");

    if (isReply) box.classList.add("sub-reply-comment");

    const userLink = box.querySelector(".comment-user-link");
    const nameLink = box.querySelector(".comment-user-link-text");
    const avatar = box.querySelector(".comment-avatar:not(.reply-avatar)");

    if (userLink) userLink.href = `/profile/${data.username}`;
    if (nameLink) {
      nameLink.href = `/profile/${data.username}`;
      nameLink.textContent = `@${data.username}`;
    }
    if (avatar) avatar.src = data.avatar_url || fallbackAvatar;

    const replyAvatar = root.querySelector(".reply-avatar");
    const curAvatar = document.getElementById("currentUserMainAvatar");
    if (replyAvatar) {
      replyAvatar.src = curAvatar ? curAvatar.src : fallbackAvatar;
    }

    box.querySelector(".comment-text").innerHTML = data.content;

    const likeBtn = box.querySelector(".comment-like-btn");
    if (likeBtn) likeBtn.dataset.commentId = data.comment_id;

    return root;
  }

  async function submitMainComment() {
    if (!mainInput || !targetId) return;
    const text = mainInput.value.trim();
    if (!text) {
      mainInput.focus();
      return;
    }

    const url =
      targetType === "list"
        ? `/api/lists/${targetId}/comment`
        : `/api/reviews/${targetId}/comment`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const threadEl = buildCommentEl(
          {
            username: data.username,
            avatar_url: data.avatar_url,
            content: text,
            comment_id: data.comment_id,
          },
          false,
        );

        if (threadEl) {
          const emptyMsg = listEl.querySelector(".no-comments-msg");
          if (emptyMsg) emptyMsg.remove();
          listEl.prepend(threadEl);
        }

        mainInput.value = "";
        updateCount(1);
      } else if (res.status === 401) {
        window.location.href = "/sign-in";
      }
    } catch (err) {
      console.error("Comment post error:", err);
    }
  }

  if (mainBtn) mainBtn.addEventListener("click", submitMainComment);

  if (mainInput) {
    mainInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitMainComment();
      }
    });
  }

  if (listEl) {
    listEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const replyArea = e.target.closest(
          ".inline-reply-box .comment-textarea",
        );
        if (replyArea) {
          e.preventDefault();
          const sendBtn = replyArea
            .closest(".inline-reply-box")
            .querySelector(".modern-post-btn");
          if (sendBtn) sendBtn.click();
        }
      }
    });

    listEl.addEventListener("click", async (e) => {
      const replyTrigger = e.target.closest(".reply-trigger");
      if (replyTrigger) {
        const thread = replyTrigger.closest(".comment-thread");
        const replyBox = thread.querySelector(".inline-reply-box");

        if (replyBox) {
          document
            .querySelectorAll(".inline-reply-box.is-active")
            .forEach((b) => {
              if (b !== replyBox) b.classList.remove("is-active");
            });

          const wrapper = replyTrigger.closest(".comment-content-wrapper");
          const actions = wrapper.querySelector(".comment-interactions");

          if (
            replyBox.previousElementSibling === actions &&
            replyBox.classList.contains("is-active")
          ) {
            replyBox.classList.remove("is-active");
            return;
          }

          actions.after(replyBox);

          const handle =
            wrapper
              .querySelector(".comment-user-link-text")
              ?.textContent.trim() ||
            wrapper.querySelector(".comment-user a")?.textContent.trim() ||
            "";

          replyBox.dataset.replyTo = handle;
          replyBox.classList.add("is-active");

          const area = replyBox.querySelector(".comment-textarea");
          if (area) {
            area.placeholder = handle ? `Reply to ${handle}...` : "Reply...";
            area.focus();
          }
        }
        return;
      }

      const cancelBtn = e.target.closest(".reply-cancel-btn");
      if (cancelBtn) {
        const replyBox = cancelBtn.closest(".inline-reply-box");
        if (replyBox) {
          replyBox.classList.remove("is-active");
          const area = replyBox.querySelector(".comment-textarea");
          if (area) area.value = "";
        }
        return;
      }

      const sendBtn = e.target.closest(".inline-reply-box .modern-post-btn");
      if (sendBtn) {
        const replyBox = sendBtn.closest(".inline-reply-box");
        const area = replyBox.querySelector(".comment-textarea");
        const text = area.value.trim();

        if (!text) {
          area.focus();
          return;
        }

        const thread = replyBox.closest(".comment-thread");
        const parentId =
          thread.dataset.commentId ||
          thread.querySelector(".comment-like-btn").dataset.commentId;
        const replyTo = replyBox.dataset.replyTo || "";

        const content =
          replyTo && !text.startsWith(replyTo) ? `${replyTo} ${text}` : text;
        const html =
          replyTo && !text.startsWith(replyTo)
            ? `<span class="comment-mention">${replyTo}</span> ${text}`
            : text;

        const url =
          targetType === "list"
            ? `/api/lists/${targetId}/comment`
            : `/api/reviews/${targetId}/comment`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content,
              parent_comment_id: parentId,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let repliesBox = thread.querySelector(".nested-replies");
            if (!repliesBox) {
              repliesBox = document.createElement("div");
              repliesBox.className = "nested-replies";
              thread.appendChild(repliesBox);
            }

            const replyEl = buildCommentEl(
              {
                username: data.username,
                avatar_url: data.avatar_url,
                content: html,
                comment_id: data.comment_id,
              },
              true,
            );

            if (replyEl) repliesBox.appendChild(replyEl);

            area.value = "";
            replyBox.classList.remove("is-active");
            updateCount(1);
          } else if (res.status === 401) {
            window.location.href = "/sign-in";
          }
        } catch (err) {
          console.error("Reply post error:", err);
        }
        return;
      }

      const likeBtn = e.target.closest(".comment-like-btn");
      if (likeBtn) {
        const cid = likeBtn.dataset.commentId;
        if (!cid) return;

        const url =
          targetType === "list"
            ? `/api/list-comments/${cid}/like`
            : `/api/comments/${cid}/like`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (res.ok) {
            const data = await res.json();
            const span = likeBtn.querySelector("span");
            const count = parseInt(span.textContent.trim(), 10) || 0;

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
          console.error("Comment like error:", err);
        }
      }
    });
  }
});
