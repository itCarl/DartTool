document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('dialog#navigation-drawer a[href]');

    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        const currentPath = window.location.pathname;

        if (linkPath === currentPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
});
