// Blog listing page — full search, tag filtering, and all posts
const postsContainer = document.getElementById('postsContainer');
const tagsContainer = document.getElementById('tagsContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let blogPosts = [];
let allTags = [];
let activeTag = 'all';
let searchQuery = '';

// Load all posts
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

        blogPosts = loaded.filter(Boolean);
        allTags = [...new Set(blogPosts.flatMap(post => post.tags))];
        return blogPosts;
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
        postsContainer.innerHTML = '<p class="no-results">No posts found matching your criteria.</p>';
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

// Create tag filter buttons
function createTagFilters() {
    if (!tagsContainer) return;
    tagsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'tag-filter active';
    allBtn.textContent = 'All';
    allBtn.dataset.tag = 'all';
    allBtn.addEventListener('click', () => filterByTag('all'));
    tagsContainer.appendChild(allBtn);

    allTags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-filter';
        btn.textContent = tag;
        btn.dataset.tag = tag;
        btn.addEventListener('click', () => filterByTag(tag));
        tagsContainer.appendChild(btn);
    });
}

// Filter by tag
function filterByTag(tag) {
    activeTag = tag;
    document.querySelectorAll('.tag-filter').forEach(el => {
        el.classList.toggle('active', el.dataset.tag === tag);
    });
    filterPosts();
}

// Apply search + tag filter
function filterPosts() {
    let filtered = [...blogPosts];

    if (activeTag !== 'all') {
        filtered = filtered.filter(post => post.tags.includes(activeTag));
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(post =>
            post.title.toLowerCase().includes(q) ||
            post.excerpt.toLowerCase().includes(q) ||
            post.tags.some(tag => tag.toLowerCase().includes(q))
        );
    }

    displayPosts(filtered);
}

// Initialize
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

    // Search listeners
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            searchQuery = searchInput.value.trim();
            filterPosts();
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchQuery = searchInput.value.trim();
                filterPosts();
            }
        });
        searchInput.addEventListener('input', () => {
            searchQuery = searchInput.value.trim();
            filterPosts();
        });
    }

    // Load posts
    try {
        await loadPosts();
        createTagFilters();
        displayPosts(blogPosts);

        // Check for tag query param (from post page tag links)
        const urlTag = new URLSearchParams(window.location.search).get('tag');
        if (urlTag && allTags.includes(urlTag)) {
            filterByTag(urlTag);
        }
    } catch (err) {
        console.error('Failed to initialize blog:', err);
        if (postsContainer) {
            postsContainer.innerHTML = '<div class="error">Failed to load blog posts.</div>';
        }
    }
});
