// Post page — loads markdown content + nav logic
function getPostIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
}

async function loadPost() {
    const postId = getPostIdFromUrl();
    const postContainer = document.getElementById('postContainer');

    if (!postId) {
        postContainer.innerHTML = '<div class="error">Post not found</div>';
        return;
    }

    try {
        const metaRes = await fetch(`./posts/${postId}/metadata.json`);
        const metadata = await metaRes.json();

        const contentRes = await fetch(`./posts/${postId}/index.md`);
        if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
        const markdown = await contentRes.text();

        document.title = `${metadata.title} — Vinay Duvvada`;

        const hasMarked = typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function';
        const contentHtml = hasMarked ? window.marked.parse(markdown) : `<pre>${escapeHtml(markdown)}</pre>`;

        postContainer.innerHTML = `
            <a href="blog.html" class="back-link"><i class="fas fa-arrow-left"></i> Back to Blog</a>
            <article>
                <header class="post-header">
                    <h1 class="post-title">${escapeHtml(metadata.title || '')}</h1>
                    <div class="post-meta">
                        <span><i class="far fa-calendar"></i> ${metadata.date}</span>
                        <span><i class="far fa-clock"></i> ${metadata.readTime}</span>
                    </div>
                    <div class="post-tags">
                        ${metadata.tags.map(tag => `
                            <a href="blog.html?tag=${encodeURIComponent(tag)}" class="tag">${tag}</a>
                        `).join('')}
                    </div>
                </header>
                <img src="./posts/${postId}/${metadata.coverImage}" alt="${escapeHtml(metadata.title || '')}"
                     class="post-cover" onerror="this.style.display='none'">
                <div class="post-content">${contentHtml}</div>
            </article>
        `;
    } catch (error) {
        console.error('Error loading post:', error);
        postContainer.innerHTML = '<div class="error">Failed to load post. <a href="blog.html" style="color: var(--primary);">Back to Blog</a></div>';
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateProgressBar() {
    const bar = document.getElementById('progressBar');
    if (!bar) return;
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    bar.style.width = height > 0 ? (winScroll / height) * 100 + '%' : '0%';
}

document.addEventListener('DOMContentLoaded', () => {
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

    // Load post + progress bar
    loadPost();
    window.addEventListener('scroll', updateProgressBar);
    updateProgressBar();
});
