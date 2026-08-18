// Homepage — loads recent posts, hobby projects, and handles nav
const postsContainer = document.getElementById('postsContainer');
const homepageProjectsContainer = document.getElementById('homepageProjectsContainer');

// Load posts data from registry
async function loadPosts() {
    try {
        let postIds = [];
        try {
            const res = await fetch('./posts/posts.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            postIds = await res.json();
        } catch (err) {
            console.error('Error loading posts registry:', err);
            postIds = ['event-driven-architecture-patterns', 'distributed-systems-consistency-models', 'microservices-vs-monolith', 'load-balancer-deep-dive'];
        }

        const loaded = await Promise.all(
            postIds.map(async (id) => {
                try {
                    const res = await fetch(`./posts/${id}/metadata.json`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const meta = await res.json();
                    return { ...meta, image: `./posts/${id}/${meta.coverImage}` };
                } catch (err) {
                    console.error(`Error loading post ${id}:`, err);
                    return null;
                }
            })
        );

        return loaded.filter(Boolean);
    } catch (err) {
        console.error('Error loading posts:', err);
        return [];
    }
}

// Render post cards
function displayPosts(posts) {
    if (!postsContainer) return;
    postsContainer.innerHTML = '';

    if (posts.length === 0) {
        postsContainer.innerHTML = '<p class="no-results">No posts yet. Check back soon!</p>';
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.innerHTML = `
            <div class="post-image-wrapper">
                <img src="${post.image}" alt="${post.title}" class="post-image"
                     onerror="this.style.display='none'">
            </div>
            <div class="post-info">
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${post.excerpt}</p>
                <div class="post-meta">
                    <span><i class="far fa-calendar"></i> ${post.date}</span>
                    <span><i class="far fa-clock"></i> ${post.readTime}</span>
                </div>
                <div class="post-tags-inline">
                    ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            window.location.href = `post.html?id=${post.id}`;
        });
        postsContainer.appendChild(card);
    });
}

// Load first 3 projects from projects.json
async function loadHomepageProjects() {
    try {
        const res = await fetch('./projects/projects.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const projects = await res.json();
        return projects.slice(0, 3);
    } catch (err) {
        console.error('Error loading projects:', err);
        return [];
    }
}

// Render project cards on homepage
function displayHomepageProjects(projects) {
    if (!homepageProjectsContainer) return;
    homepageProjectsContainer.innerHTML = '';

    if (projects.length === 0) {
        homepageProjectsContainer.innerHTML = '<p class="no-results">No projects found.</p>';
        return;
    }

    projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card netflix-card' + (project.featured ? ' featured' : '');

        const tagsHtml = project.tags.map(t => `<span>${t}</span>`).join('');
        const githubLink = project.github
            ? `<a href="${project.github}" target="_blank" rel="noopener" class="project-github-link" onclick="event.stopPropagation()"><i class="fab fa-github"></i></a>`
            : '';
        const chromeLink = project.chromeWebStore
            ? `<a href="${project.chromeWebStore}" target="_blank" rel="noopener" class="project-chrome-link" onclick="event.stopPropagation()" title="Chrome Web Store"><i class="fab fa-chrome"></i></a>`
            : '';
        const featuredBadge = project.featured ? '<span class="featured-badge">FEATURED</span>' : '';

        card.innerHTML = `
            <a href="project.html?id=${encodeURIComponent(project.id)}" class="project-card-link">
                <div class="project-card-banner project-card-banner--icon">
                    <i class="${project.icon}"></i>
                </div>
                <div class="project-card-inner">
                    <div class="project-card-top">
                        <div class="project-icon"><i class="${project.icon}"></i></div>
                        ${featuredBadge}
                    </div>
                    <h3>${project.title}</h3>
                    <p>${project.tagline}</p>
                    <div class="project-tags">${tagsHtml}</div>
                    <div class="project-links">
                        <span class="view-details"><i class="fas fa-arrow-right"></i> View Details</span>
                        ${githubLink}
                        ${chromeLink}
                    </div>
                </div>
            </a>
        `;
        homepageProjectsContainer.appendChild(card);
    });
}

// Initialize homepage
document.addEventListener('DOMContentLoaded', async () => {
    // Nav logic
    const header = document.getElementById('header');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (header) {
        window.addEventListener('scroll', () => {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('open');
            }
        });
    }

    // Load and display recent posts (max 4 on homepage)
    try {
        const posts = await loadPosts();
        displayPosts(posts.slice(0, 3));
    } catch (err) {
        console.error('Failed to initialize:', err);
        if (postsContainer) {
            postsContainer.innerHTML = '<div class="error">Failed to load posts.</div>';
        }
    }

    // Load and display hobby projects (first 3 from projects.json)
    try {
        const projects = await loadHomepageProjects();
        displayHomepageProjects(projects);
    } catch (err) {
        console.error('Failed to load homepage projects:', err);
        if (homepageProjectsContainer) {
            homepageProjectsContainer.innerHTML = '<div class="error">Failed to load projects.</div>';
        }
    }
});
