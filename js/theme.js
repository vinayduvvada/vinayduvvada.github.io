// Theme engine — dark / light / system
// Cycles: dark → light → system → dark …
// Persists choice in localStorage, respects prefers-color-scheme for "system"
(function () {
    var STORAGE_KEY = 'theme';
    var MODES = ['dark', 'light', 'system'];
    var ICONS = { dark: 'fa-moon', light: 'fa-sun', system: 'fa-desktop' };
    var LABELS = { dark: 'Dark', light: 'Light', system: 'System' };

    function getSystemPreference() {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function resolveTheme(mode) {
        return mode === 'system' ? getSystemPreference() : mode;
    }

    function applyTheme(mode) {
        var resolved = resolveTheme(mode);
        document.documentElement.setAttribute('data-theme', resolved);

        // Update all toggle buttons on the page
        var btns = document.querySelectorAll('.theme-toggle');
        btns.forEach(function (btn) {
            var icon = btn.querySelector('i');
            if (icon) {
                icon.className = 'fas ' + ICONS[mode];
            }
            btn.setAttribute('aria-label', LABELS[mode] + ' theme');
            btn.setAttribute('title', LABELS[mode]);
        });
    }

    function getSavedMode() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved && MODES.indexOf(saved) !== -1) return saved;
        } catch (e) { /* storage blocked */ }
        return 'dark'; // default
    }

    function saveMode(mode) {
        try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* noop */ }
    }

    function cycleTheme() {
        var current = getSavedMode();
        var next = MODES[(MODES.indexOf(current) + 1) % MODES.length];
        saveMode(next);
        applyTheme(next);
    }

    // Apply immediately (before DOMContentLoaded) to prevent flash
    applyTheme(getSavedMode());

    // Once DOM is ready, wire up buttons
    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(getSavedMode()); // re-apply to update button icons

        document.querySelectorAll('.theme-toggle').forEach(function (btn) {
            btn.addEventListener('click', cycleTheme);
        });
    });

    // Listen for OS preference changes when mode is "system"
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
        if (getSavedMode() === 'system') {
            applyTheme('system');
        }
    });
})();
