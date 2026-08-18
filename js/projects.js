// Projects listing page — loads projects from projects.json and images from GitHub
var container = document.getElementById('projectsContainer');

var GITHUB_API = 'https://api.github.com';
var IMAGE_EXTS = /\.(png|jpg|jpeg|gif|webp|svg)$/i;

async function loadProjects() {
    try {
        var res = await fetch('./projects/projects.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (err) {
        console.warn('Fetch failed (possibly file:// protocol), trying XHR fallback:', err.message);
        return await loadProjectsViaXHR();
    }
}

function loadProjectsViaXHR() {
    return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', './projects/projects.json', true);
        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    console.error('Error parsing projects JSON:', e);
                    resolve([]);
                }
            } else {
                console.error('XHR failed with status:', xhr.status);
                resolve([]);
            }
        };
        xhr.onerror = function () {
            console.error('XHR error loading projects.json');
            resolve([]);
        };
        xhr.send();
    });
}

/**
 * Fetches image file URLs from a GitHub repo directory via the GitHub Contents API.
 * Returns an array of raw image URLs (up to maxImages).
 * @param {string} repo - e.g. "vinayduvvada/custom-search-shortcuts"
 * @param {string} path - folder path within the repo, e.g. "screenshots"
 * @param {number} maxImages
 * @returns {Promise<string[]>}
 */
async function fetchRepoImages(repo, path, maxImages) {
    maxImages = maxImages || 6;
    if (!repo) return [];
    var url = GITHUB_API + '/repos/' + repo + '/contents/' + (path || '');
    try {
        var res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } });
        if (!res.ok) return [];
        var files = await res.json();
        if (!Array.isArray(files)) return [];
        return files
            .filter(function (f) { return f.type === 'file' && IMAGE_EXTS.test(f.name); })
            .slice(0, maxImages)
            .map(function (f) { return f.download_url; });
    } catch (e) {
        console.warn('Could not fetch images for', repo, e.message);
        return [];
    }
}

/**
 * Builds the image strip HTML for a card.
 * @param {string[]} images
 * @param {string} altPrefix
 * @returns {string}
 */
function buildImageStrip(images, altPrefix) {
    if (!images || images.length === 0) return '';
    return '<div class="project-card-images">' +
        images.map(function (src, i) {
            return '<div class="project-card-img-item">' +
                '<img src="' + src + '" alt="' + altPrefix + ' screenshot ' + (i + 1) + '" loading="lazy">' +
            '</div>';
        }).join('') +
    '</div>';
}

/**
 * Renders the primary hero image (first screenshot) as the card banner.
 * @param {string[]} images
 * @param {string} iconClass - fallback icon class
 * @returns {string}
 */
function buildCardBanner(images, iconClass) {
    if (images && images.length > 0) {
        return '<div class="project-card-banner">' +
            '<img src="' + images[0] + '" alt="Project screenshot" loading="lazy">' +
            '<div class="project-card-banner-overlay"></div>' +
        '</div>';
    }
    return '<div class="project-card-banner project-card-banner--icon">' +
        '<i class="' + iconClass + '"></i>' +
    '</div>';
}

async function renderProjects(projects) {
    if (!container) return;
    container.innerHTML = '<div class="projects-loading"><span class="spinner"></span> Loading projects…</div>';

    var rendered = await Promise.all(projects.map(async function (project) {
        var images = await fetchRepoImages(project.githubRepo, project.imagesPath, 6);

        var card = document.createElement('div');
        card.className = 'project-card netflix-card' + (project.featured ? ' featured' : '');
        card.id = project.id;

        var featuredBadge = project.featured
            ? '<span class="featured-badge">FEATURED</span>'
            : '';

        card.innerHTML =
            '<a href="project.html?id=' + encodeURIComponent(project.id) + '" class="project-card-link">' +
                buildCardBanner(images, project.icon) +
                '<div class="project-card-inner">' +
                    '<div class="project-card-top">' +
                        (images.length === 0 ? '<div class="project-icon"><i class="' + project.icon + '"></i></div>' : '') +
                        featuredBadge +
                    '</div>' +
                    '<h3>' + project.title + '</h3>' +
                    '<p>' + project.tagline + '</p>' +
                    '<div class="project-tags">' +
                        project.tags.map(function (t) { return '<span>' + t + '</span>'; }).join('') +
                    '</div>' +
                    (images.length > 1 ? buildImageStrip(images.slice(1), project.title) : '') +
                    '<div class="project-links">' +
                        '<span class="view-details"><i class="fas fa-arrow-right"></i> View Details</span>' +
                        (project.github
                            ? '<a href="' + project.github + '" target="_blank" rel="noopener" class="project-github-link" onclick="event.stopPropagation()"><i class="fab fa-github"></i></a>'
                            : '') +
                        (project.chromeWebStore
                            ? '<a href="' + project.chromeWebStore + '" target="_blank" rel="noopener" class="project-chrome-link" onclick="event.stopPropagation()" title="Chrome Web Store"><i class="fab fa-chrome"></i></a>'
                            : '') +
                    '</div>' +
                '</div>' +
            '</a>';

        return card;
    }));

    container.innerHTML = '';
    if (rendered.length === 0) {
        container.innerHTML = '<p class="no-results">No projects found.</p>';
        return;
    }
    rendered.forEach(function (card) { container.appendChild(card); });
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
    await renderProjects(projects);
});
