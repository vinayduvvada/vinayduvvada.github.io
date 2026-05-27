// Project detail page — loads a single project from projects.json by ?id= param
var detailContainer = document.getElementById('projectDetail');

function getProjectId() {
    return new URLSearchParams(window.location.search).get('id');
}

async function loadProject() {
    var projectId = getProjectId();
    if (!projectId) {
        detailContainer.innerHTML = '<div class="error" style="padding-top:8rem;">Project not found. <a href="projects.html" style="color:var(--primary);">Back to Projects</a></div>';
        return;
    }

    try {
        var projects;

        try {
            var res = await fetch('./projects/projects.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var projects = await res.json();
        } catch (fetchErr) {
            console.warn('Fetch failed (Possible CORS issue), trying XHR fallback:', fetchErr.message);
            projects = new Promise(function (resolve) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', './projects/projects.json', true);
                xhr.onload = function () {
                    if (xhr.status === 200 || xhr.status === 0) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (err) {
                            resolve([]);
                        }
                    } else {
                        resolve([]);
                    }
                };
                xhr.onerror = function () {
                    resolve([]);
                };
                xhr.send();
            });
        }

        var project = projects.find(function (p) { return p.id === projectId; });

        if (!project) {
            detailContainer.innerHTML = '<div class="error" style="padding-top:8rem;">Project not found. <a href="projects.html" style="color:var(--primary);">Back to Projects</a></div>';
            return;
        }

        document.title = project.title + ' — Vinay Duvvada';

        var featuresHtml = '';
        if (project.features && project.features.length) {
            featuresHtml =
                '<h2 class="section-title" style="margin-top:3rem;">Features</h2>' +
                '<div class="feature-list">' +
                project.features.map(function (f) {
                    return '<div class="feature-item">' +
                        '<h4><i class="' + f.icon + '" style="color:var(--primary);margin-right:0.5rem;"></i>' + f.title + '</h4>' +
                        '<p>' + f.description + '</p>' +
                        '</div>';
                }).join('') +
                '</div>';
        }

        var sectionsHtml = '';
        if (project.sections && project.sections.length) {
            sectionsHtml = project.sections.map(function (s) {
                return '<div class="project-section">' +
                    '<h2>' + s.heading + '</h2>' +
                    '<p>' + s.content + '</p>' +
                    '</div>';
            }).join('');
        }

        detailContainer.innerHTML =
            '<div class="project-detail">' +
            '<a href="projects.html" class="back-link"><i class="fas fa-arrow-left"></i> Back to Projects</a>' +
            '<div class="project-detail-header">' +
            '<div class="project-detail-top">' +
            '<div class="project-icon project-icon-lg"><i class="' + project.icon + '"></i></div>' +
            (project.featured ? '<span class="featured-badge">FEATURED</span>' : '') +
            '</div>' +
            '<h1>' + project.title + '</h1>' +
            '<p class="project-detail-tagline">' + project.tagline + '</p>' +
            '<div class="project-tags" style="margin-top:1rem;">' +
            project.tags.map(function (t) { return '<span>' + t + '</span>'; }).join('') +
            '</div>' +
            '<div class="project-detail-actions">' +
            (project.github ? '<a href="' + project.github + '" target="_blank" rel="noopener" class="btn btn-primary"><i class="fab fa-github"></i> View on GitHub</a>' : '') +
            (project.download ? '<a href="' + project.download + '" target="_blank" rel="noopener" class="btn btn-outline"><i class="fas fa-download"></i> Download</a>' : '') +
            (project.demo ? '<a href="' + project.demo + '" target="_blank" rel="noopener" class="btn btn-outline"><i class="fas fa-external-link-alt"></i> Live Demo</a>' : '') +
            '</div>' +
            '</div>' +
            '<div class="project-detail-body">' +
            '<p>' + project.description + '</p>' +
            featuresHtml +
            sectionsHtml +
            '</div>' +
            '</div>';
    } catch (err) {
        console.error('Error loading project:', err);
        detailContainer.innerHTML = '<div class="error" style="padding-top:8rem;">Failed to load project. <a href="projects.html" style="color:var(--primary);">Back to Projects</a></div>';
    }
}

document.addEventListener('DOMContentLoaded', function () {
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

    loadProject();
});
