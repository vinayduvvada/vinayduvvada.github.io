// Project detail page — loads a single project from projects.json by ?id= param
var detailContainer = document.getElementById('projectDetail');

var GITHUB_API_DETAIL = 'https://api.github.com';
var GITHUB_RAW = 'https://raw.githubusercontent.com';
var IMAGE_EXTS_DETAIL = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

function getProjectId() {
    return new URLSearchParams(window.location.search).get('id');
}

/**
 * Fetches image URLs from a GitHub repo directory.
 * @param {string} repo
 * @param {string} path
 * @returns {Promise<string[]>}
 */
async function fetchDetailImages(repo, path) {
    if (!repo) return [];
    var url = GITHUB_API_DETAIL + '/repos/' + repo + '/contents/' + (path || '');
    try {
        var res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } });
        if (!res.ok) return [];
        var files = await res.json();
        if (!Array.isArray(files)) return [];
        return files
            .filter(function (f) { return f.type === 'file' && IMAGE_EXTS_DETAIL.test(f.name); })
            .map(function (f) { return f.download_url; });
    } catch (e) {
        console.warn('Could not fetch images for', repo, e.message);
        return [];
    }
}

/**
 * Fetches the raw README.md content from a GitHub repo.
 * @param {string} repo
 * @param {string} readmePath
 * @returns {Promise<string|null>}
 */
async function fetchReadme(repo, readmePath) {
    if (!repo) return null;
    var branch = 'main';
    var file = readmePath || 'README.md';
    var url = GITHUB_RAW + '/' + repo + '/' + branch + '/' + file;
    try {
        var res = await fetch(url);
        if (!res.ok) {
            // Try master branch as fallback
            var url2 = GITHUB_RAW + '/' + repo + '/master/' + file;
            var res2 = await fetch(url2);
            if (!res2.ok) return null;
            return await res2.text();
        }
        return await res.text();
    } catch (e) {
        console.warn('Could not fetch README for', repo, e.message);
        return null;
    }
}

/**
 * Renders a Netflix-style image gallery for the detail page.
 * @param {string[]} images
 * @param {string} title
 * @returns {string}
 */
function buildDetailGallery(images, title) {
    if (!images || images.length === 0) return '';
    return '<section class="project-gallery">' +
        '<h2 class="project-gallery-title"><i class="fas fa-images" style="color:var(--primary);margin-right:0.5rem;"></i>Screenshots</h2>' +
        '<div class="project-gallery-grid">' +
            images.map(function (src, i) {
                return '<div class="project-gallery-item" onclick="openLightbox(\'' + src + '\')">' +
                    '<img src="' + src + '" alt="' + title + ' screenshot ' + (i + 1) + '" loading="lazy">' +
                    '<div class="project-gallery-zoom"><i class="fas fa-expand"></i></div>' +
                '</div>';
            }).join('') +
        '</div>' +
    '</section>';
}

/**
 * Renders parsed README markdown as an HTML section.
 * @param {string} markdown
 * @returns {string}
 */
function buildReadmeSection(markdown) {
    var rendered;
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        rendered = marked.parse(markdown);
    } else {
        // Plain text fallback — escape HTML and wrap in <pre>
        rendered = '<pre>' + markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
    }
    return '<section class="project-readme">' +
        '<h2 class="project-readme-title"><i class="fab fa-github" style="color:var(--primary);margin-right:0.5rem;"></i>README</h2>' +
        '<div class="project-readme-body markdown-body">' + rendered + '</div>' +
    '</section>';
}

/** Simple lightbox for gallery images */
function openLightbox(src) {
    var existing = document.getElementById('imgLightbox');
    if (existing) existing.remove();
    var lb = document.createElement('div');
    lb.id = 'imgLightbox';
    lb.className = 'img-lightbox';
    lb.innerHTML =
        '<div class="img-lightbox-backdrop"></div>' +
        '<div class="img-lightbox-content">' +
            '<button class="img-lightbox-close" aria-label="Close"><i class="fas fa-times"></i></button>' +
            '<img src="' + src + '" alt="Screenshot">' +
        '</div>';
    document.body.appendChild(lb);
    requestAnimationFrame(function () { lb.classList.add('open'); });

    function closeLb() { lb.classList.remove('open'); setTimeout(function () { lb.remove(); }, 300); }
    lb.querySelector('.img-lightbox-backdrop').addEventListener('click', closeLb);
    lb.querySelector('.img-lightbox-close').addEventListener('click', closeLb);
    document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { closeLb(); document.removeEventListener('keydown', onKey); }
    });
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
            projects = await res.json();
        } catch (fetchErr) {
            console.warn('Fetch failed, trying XHR fallback:', fetchErr.message);
            projects = await new Promise(function (resolve) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', './projects/projects.json', true);
                xhr.onload = function () {
                    if (xhr.status === 200 || xhr.status === 0) {
                        try { resolve(JSON.parse(xhr.responseText)); } catch (e) { resolve([]); }
                    } else { resolve([]); }
                };
                xhr.onerror = function () { resolve([]); };
                xhr.send();
            });
        }
        var project = projects.find(function (p) { return p.id === projectId; });

        if (!project) {
            detailContainer.innerHTML = '<div class="error" style="padding-top:8rem;">Project not found. <a href="projects.html" style="color:var(--primary);">Back to Projects</a></div>';
            return;
        }

        document.title = project.title + ' — Vinay Duvvada';

        // Kick off GitHub fetches in parallel
        var imagesPromise = fetchDetailImages(project.githubRepo, project.imagesPath);
        var readmePromise = fetchReadme(project.githubRepo, project.readmePath);

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

        // Render the static shell first — fast
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
                        (project.chromeWebStore ? '<a href="' + project.chromeWebStore + '" target="_blank" rel="noopener" class="btn btn-chrome"><i class="fab fa-chrome"></i> Chrome Web Store</a>' : '') +
                        (project.demo ? '<a href="' + project.demo + '" target="_blank" rel="noopener" class="btn btn-outline"><i class="fas fa-external-link-alt"></i> Live Demo</a>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="project-detail-body">' +
                    '<p>' + project.description + '</p>' +
                    featuresHtml +
                    sectionsHtml +
                '</div>' +
                '<div id="githubContent">' +
                    '<div class="github-loading"><span class="spinner"></span> Loading GitHub content…</div>' +
                '</div>' +
            '</div>';

        // Now await GitHub data and inject
        var images = await imagesPromise;
        var readmeText = await readmePromise;
        var githubContent = document.getElementById('githubContent');
        if (githubContent) {
            var galleryHtml = buildDetailGallery(images, project.title);
            var readmeHtml = readmeText ? buildReadmeSection(readmeText) : '';
            githubContent.innerHTML = galleryHtml + readmeHtml;
            if (!galleryHtml && !readmeHtml) {
                githubContent.innerHTML = '';
            }
        }

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
