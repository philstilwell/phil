const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const navItems = Array.from(document.querySelectorAll(".nav-links a"));
const sectionNavItems = navItems.filter(
  (link) => link.hash && link.pathname === window.location.pathname,
);
const yearSlot = document.querySelector("[data-year]");
const progress = document.querySelector("[data-scroll-progress]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const root = document.documentElement;

const savedTheme = localStorage.getItem("phil-theme");
if (savedTheme === "light" || savedTheme === "dark") {
  root.dataset.theme = savedTheme;
}

if (yearSlot) {
  yearSlot.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("is-open", !isOpen);
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
    }
  });
}

const openHashPanel = (hash) => {
  if (!hash || hash === "#top") return;

  const target = document.querySelector(hash);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
  }
};

sectionNavItems.forEach((link) => {
  link.addEventListener("click", () => {
    openHashPanel(link.hash);
  });
});

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    localStorage.setItem("phil-theme", nextTheme);
  });
}

const updateProgress = () => {
  if (!progress) return;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
};

const observeSections = () => {
  const sections = Array.from(document.querySelectorAll("section[id], details[id]"));
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        sectionNavItems.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 },
  );

  sections.forEach((section) => observer.observe(section));
};

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
window.addEventListener("hashchange", () => openHashPanel(window.location.hash));
openHashPanel(window.location.hash);
updateProgress();
observeSections();
