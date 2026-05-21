(function () {
  "use strict";

  var toggle = document.querySelector(".nav-toggle");
  var mobile = document.querySelector(".mobile-menu");
  if (toggle && mobile) {
    toggle.addEventListener("click", function () {
      var open = mobile.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobile.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobile.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  document.querySelectorAll(".faq-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      var wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item").forEach(function (i) {
        i.classList.remove("open");
        i.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      });
      if (!wasOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  var nav = document.querySelector(".nav");
  window.addEventListener(
    "scroll",
    function () {
      if (!nav) return;
      nav.style.boxShadow =
        window.scrollY > 8 ? "0 8px 32px rgba(0,0,0,0.25)" : "none";
    },
    { passive: true },
  );
})();
