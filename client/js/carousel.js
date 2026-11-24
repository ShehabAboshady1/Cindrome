document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(
    ".carousel-section, .lists-section",
  );

  sections.forEach((section) => {
    const track = section.querySelector(".carousel-track, .lists-track");
    const prevBtn = section.querySelector(
      '.carousel-btn[aria-label="Previous"]',
    );
    const nextBtn = section.querySelector('.carousel-btn[aria-label="Next"]');

    if (track && prevBtn && nextBtn) {
      nextBtn.addEventListener("click", () => {
        track.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" });
      });

      prevBtn.addEventListener("click", () => {
        track.scrollBy({
          left: -(track.clientWidth * 0.8),
          behavior: "smooth",
        });
      });
    }
  });
});
