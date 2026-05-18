// Projects listing page — loads all projects from projects.json
var container = document.getElementById('projectsContainer');

async function loadProjects() {
    try {
        var res = await fetch('./projects/projects.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (err) {
        console.warn('Fetch failed (Possible CORS issue), trying script fallback:', err.message);
        return await loadProjectsViaScript();
    }
}

function loadProjectsViaScript() {
    return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', './projects/projects.json', true);
        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (err) {
                    console.error('Error parsing projects JSON:', err);
                    resolve([]);
                }
            } else {
                console.error('XHR failed with status:', xhr.status);
                resolve([]);
            }
        };
        xhr.onerror = function () {
            console.error('XHR error while loading projects.json');
            resolve([]);
        };

        xhr.send();
    });
}

function renderProjects(projects) {
    if (!container) return;
    container.innerHTML = '';

    if (projects.length === 0) {
        container.innerHTML = '<p class="no-results">No projects found.</p>';
        return;
    }

    projects.forEach(function (project) {
        var card = document.createElement('div');
        card.className = 'project-card' + (project.featured ? ' featured' : '');
        card.id = project.id;

        var featuredBadge = project.featured
            ? '<span class="featured-badge">FEATURED</span>'
            : '';

        card.innerHTML =
            '<a href="project.html?id=' + encodeURIComponent(project.id) + '" class="project-card-link">' +
            '<div class="project-card-inner">' +
            '<div class="project-card-top">' +
            '<div class="project-icon"><i class="' + project.icon + '"></i></div>' +
            featuredBadge +
            '</div>' +
            '<h3>' + project.title + '</h3>' +
            '<p>' + project.tagline + '</p>' +
            '<div class="project-tags">' +
            project.tags.map(function (t) { return '<span>' + t + '</span>'; }).join('') +
            '</div>' +
            '<div class="project-links">' +
            '<span class="view-details"><i class="fas fa-arrow-right"></i> View Details</span>' +
            '</div>' +
            '</div>' +
            '</a>';

        container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    // Nav
    var header = document.getElementById('header');
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');

    if (header) {
        window.addEventListener('scroll', function () {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () { navLinks.classList.toggle('open'); });
        document.addEventListener('click', function (e) {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
            }
        });
    }

    // Load & render
    var projects = await loadProjects();
    renderProjects(projects);
});
