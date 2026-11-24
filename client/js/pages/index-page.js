document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".list-action-btn.like-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      this.classList.toggle("is-liked");
    });
  });
});
