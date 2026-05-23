(function () {
  function bootParallax() {
    if (!window.simpleParallax) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.querySelectorAll("img[data-parallax]").forEach(function (image) {
      new simpleParallax(image, {
        orientation: image.dataset.orientation || "up",
        scale: Number(image.dataset.scale || 1.24),
        delay: Number(image.dataset.delay || 0.45),
        overflow: image.dataset.overflow === "true",
        transition: "cubic-bezier(0,0,0,1)"
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootParallax);
  } else {
    bootParallax();
  }
})();
