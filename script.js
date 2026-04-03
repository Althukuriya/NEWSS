// ==================== CONFIGURATION FOR GITHUB PAGES ====================
const BLOG_URL = 'https://newwwwwsave.blogspot.com'; // YOUR BLOG URL
const USE_PROXY = true; // Use public CORS proxy
const PROXY_URL = 'https://api.allorigins.win/raw?url='; // Free CORS proxy

const POSTS_PER_PAGE = 9;

// Helper function to get API URL with proxy
function getApiUrl(endpoint) {
    const fullUrl = `${BLOG_URL}${endpoint}`;
    if (USE_PROXY) {
        return `${PROXY_URL}${encodeURIComponent(fullUrl)}`;
    }
    return fullUrl;
}

let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;

// ==================== HELPER FUNCTIONS ====================
async function fetchJSON(url) {
    try {
        console.log('Fetching:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

function parsePost(entry) {
    const content = entry.content.$t;
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    return {
        id: entry.id.$t.split('post-')[1],
        title: entry.title.$t,
        published: entry.published.$t,
        author: entry.author?.[0]?.name?.$t || 'Editor',
        content: content,
        summary: entry.summary?.$t || content.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
        image: imgMatch ? imgMatch[1] : 'https://via.placeholder.com/800x400?text=News+Image',
        labels: entry.category?.map(c => c.term) || []
    };
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function calculateReadTime(content) {
    const text = content.replace(/<[^>]*>/g, '');
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
}

// ==================== BOOKMARKS ====================
function getBookmarks() {
    return JSON.parse(localStorage.getItem('bookmarks') || '[]');
}

function saveBookmark(postId) {
    let bookmarks = getBookmarks();
    if (!bookmarks.includes(postId)) {
        bookmarks.push(postId);
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }
    updateBookmarkCount();
}

function removeBookmark(postId) {
    let bookmarks = getBookmarks();
    bookmarks = bookmarks.filter(id => id !== postId);
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    updateBookmarkCount();
}

function isBookmarked(postId) {
    return getBookmarks().includes(postId);
}

function updateBookmarkCount() {
    const count = getBookmarks().length;
    const countElem = document.getElementById('bookmarkCount');
    if (countElem) countElem.textContent = count;
}

function renderBookmarkButton(postId) {
    const bookmarked = isBookmarked(postId);
    return `<button class="bookmark-btn ${bookmarked ? 'active' : ''}" data-id="${postId}">
        <i class="fas fa-bookmark"></i>
    </button>`;
}

// ==================== SOCIAL SHARE ====================
function renderShareButtons(title, url) {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    return `
        <div class="share-buttons">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="share-btn share-fb">
                <i class="fab fa-facebook-f"></i> Facebook
            </a>
            <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" class="share-btn share-twitter">
                <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" class="share-btn share-linkedin">
                <i class="fab fa-linkedin-in"></i> LinkedIn
            </a>
        </div>
    `;
}

// ==================== BREADCRUMBS ====================
function renderBreadcrumbs(category, title) {
    return `
        <div class="breadcrumbs">
            <a href="index.html">Home</a>
            <span>›</span>
            ${category ? `<a href="category.html?cat=${encodeURIComponent(category)}">${escapeHtml(category)}</a><span>›</span>` : ''}
            <span>${escapeHtml(title)}</span>
        </div>
    `;
}

// ==================== RELATED POSTS ====================
async function loadRelatedPosts(currentLabels, currentId) {
    const url = getApiUrl(`/feeds/posts/default?alt=json&max-results=30`);
    const data = await fetchJSON(url);
    if (!data?.feed?.entry) return [];
    
    const posts = data.feed.entry.map(parsePost);
    const related = posts.filter(post => 
        post.id !== currentId && 
        post.labels.some(label => currentLabels.includes(label))
    ).slice(0, 4);
    
    return related;
}

function renderRelatedPosts(posts) {
    if (posts.length === 0) return '';
    return `
        <div class="related-posts">
            <h3><i class="fas fa-link"></i> Related Articles</h3>
            <div class="related-grid">
                ${posts.map(post => `
                    <div class="related-card">
                        <img src="${post.image}" alt="${escapeHtml(post.title)}" loading="lazy">
                        <div style="padding: 12px;">
                            <h4><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h4>
                            <small><i class="far fa-clock"></i> ${calculateReadTime(post.content)}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ==================== RENDER CARD ====================
function renderCard(post) {
    return `
        <div class="news-card">
            <img src="${post.image}" class="card-img" alt="${escapeHtml(post.title)}" loading="lazy">
            <div class="card-content">
                <div class="card-category">${escapeHtml(post.labels[0] || 'News')}</div>
                <h3 class="card-title"><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                <div class="card-meta">
                    <span><i class="far fa-calendar"></i> ${formatDate(post.published)}</span>
                    <span><i class="far fa-user"></i> ${escapeHtml(post.author)}</span>
                    <span class="read-time"><i class="far fa-clock"></i> ${calculateReadTime(post.content)}</span>
                </div>
                <p class="card-excerpt">${escapeHtml(post.summary)}</p>
                ${renderBookmarkButton(post.id)}
            </div>
        </div>
    `;
}

// ==================== DARK MODE ====================
function initDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
    }
    
    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        });
    }
}

// ==================== READING PROGRESS ====================
function initReadingProgress() {
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const progressBar = document.getElementById('readingProgressBar');
        if (progressBar) progressBar.style.width = scrolled + '%';
    });
}

// ==================== LIVE SEARCH ====================
function initLiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('liveSearchResults');
    if (!searchInput) return;
    
    let debounceTimer;
    searchInput.addEventListener('input', async (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            resultsDiv.classList.remove('active');
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            const url = getApiUrl(`/feeds/posts/default?alt=json&q=${encodeURIComponent(query)}&max-results=5`);
            const data = await fetchJSON(url);
            if (data?.feed?.entry) {
                const posts = data.feed.entry.map(parsePost);
                resultsDiv.innerHTML = posts.map(post => `
                    <div class="live-search-item" onclick="window.location.href='post.html?id=${post.id}'">
                        <img src="${post.image}" alt="">
                        <div>
                            <div class="title">${escapeHtml(post.title)}</div>
                            <small>${calculateReadTime(post.content)}</small>
                        </div>
                    </div>
                `).join('');
                resultsDiv.classList.add('active');
            } else {
                resultsDiv.innerHTML = '<div class="live-search-item">No results found</div>';
                resultsDiv.classList.add('active');
            }
        }, 300);
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.classList.remove('active');
        }
    });
    
    const searchSubmit = document.getElementById('searchSubmitBtn');
    if (searchSubmit) {
        searchSubmit.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        });
    }
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    });
}

// ==================== CATEGORY DROPDOWN ====================
async function loadCategories() {
    const url = getApiUrl(`/feeds/posts/default?alt=json&max-results=50`);
    const data = await fetchJSON(url);
    if (!data) {
        console.error('Failed to load categories');
        return;
    }
    const categories = new Set();
    data?.feed?.entry?.forEach(entry => {
        entry.category?.forEach(cat => categories.add(cat.term));
    });
    
    const navUl = document.getElementById('categoryNav');
    if (navUl) {
        const currentPath = window.location.pathname;
        navUl.innerHTML = `
            <li><a href="index.html" class="${currentPath.includes('index.html') || currentPath === '/' ? 'active' : ''}">Home</a></li>
            ${Array.from(categories).slice(0, 8).map(cat => `
                <li><a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>
            `).join('')}
        `;
    }
    
    const dropdownContent = document.getElementById('dropdownContent');
    if (dropdownContent) {
        dropdownContent.innerHTML = Array.from(categories).slice(0, 15).map(cat => `
            <a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>
        `).join('');
    }
}

// ==================== BREAKING TICKER ====================
async function loadBreakingTicker() {
    const url = getApiUrl(`/feeds/posts/default?alt=json&max-results=5`);
    const data = await fetchJSON(url);
    if (data?.feed?.entry) {
        const titles = data.feed.entry.map(e => e.title.$t);
        const ticker = document.getElementById('breakingTicker');
        if (ticker) {
            ticker.innerHTML = `<div class="ticker-item">🔥 ${titles.join('  •  ')}</div>`;
        }
    }
}

// ==================== PUSH NOTIFICATIONS ====================
function initPushNotifications() {
    const notifyBtn = document.getElementById('pushNotifyBtn');
    if (!notifyBtn) return;
    
    if ('Notification' in window) {
        notifyBtn.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                notifyBtn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
                notifyBtn.style.background = '#27ae60';
                localStorage.setItem('notificationsEnabled', 'true');
            }
        });
        
        if (localStorage.getItem('notificationsEnabled') === 'true') {
            notifyBtn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
            notifyBtn.style.background = '#27ae60';
        }
    } else {
        notifyBtn.style.display = 'none';
    }
}

// ==================== BOOKMARKS PAGE ====================
async function loadBookmarks() {
    const bookmarkIds = getBookmarks();
    const container = document.getElementById('bookmarksList');
    
    if (bookmarkIds.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">No saved articles yet. <a href="index.html">Browse news</a> to bookmark your favorites.</p>';
        return;
    }
    
    container.innerHTML = '<div class="loader-spinner"><i class="fas fa-spinner fa-spin"></i> Loading bookmarks...</div>';
    
    const posts = [];
    for (const id of bookmarkIds) {
        const url = getApiUrl(`/feeds/posts/default/${id}?alt=json`);
        const data = await fetchJSON(url);
        if (data?.entry) {
            posts.push(parsePost(data.entry));
        }
    }
    
    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">No valid bookmarks found.</p>';
    } else {
        container.innerHTML = posts.map(renderCard).join('');
        attachBookmarkEvents();
    }
}

// ==================== HOME PAGE ====================
async function loadHome(page = 1) {
    const startIndex = (page - 1) * POSTS_PER_PAGE + 1;
    const url = getApiUrl(`/feeds/posts/default?alt=json&max-results=${POSTS_PER_PAGE}&start-index=${startIndex}`);
    const data = await fetchJSON(url);
    
    if (!data?.feed?.entry) {
        document.getElementById('dynamicContent').innerHTML = `
            <div style="padding:40px;text-align:center">
                <h3>⚠️ Unable to load news</h3>
                <p>Please check your Blogger URL in script.js</p>
                <p>Current URL: ${BLOG_URL}</p>
                <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#e63946;color:white;border:none;border-radius:8px;">Retry</button>
            </div>
        `;
        return;
    }
    
    const posts = data.feed.entry.map(parsePost);
    const total = parseInt(data.feed.openSearch$totalResults?.$t || 0);
    const totalPages = Math.ceil(total / POSTS_PER_PAGE);
    
    const recentUrl = getApiUrl(`/feeds/posts/default?alt=json&max-results=5`);
    const recentData = await fetchJSON(recentUrl);
    const recentPosts = recentData?.feed?.entry?.map(parsePost) || [];
    
    const catUrl = getApiUrl(`/feeds/posts/default?alt=json&max-results=50`);
    const catData = await fetchJSON(catUrl);
    const categories = new Set();
    catData?.feed?.entry?.forEach(entry => {
        entry.category?.forEach(cat => categories.add(cat.term));
    });
    
    const html = `
        <div class="two-column">
            <div class="main-col">
                <h2 style="font-size:28px;margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px">
                    <i class="fas fa-fire"></i> Latest Headlines
                </h2>
                <div class="news-grid">
                    ${posts.map(renderCard).join('')}
                </div>
                ${totalPages > 1 ? `
                <div class="pagination">
                    ${Array.from({length: Math.min(totalPages, 5)}, (_, i) => `
                        <button class="${page === i+1 ? 'active' : ''}" data-page="${i+1}">${i+1}</button>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            <aside class="sidebar">
                <div class="sidebar-widget">
                    <h3><i class="fas fa-clock"></i> Recent Posts</h3>
                    <ul class="recent-list">
                        ${recentPosts.map(p => `<li><a href="post.html?id=${p.id}">${escapeHtml(p.title)}</a></li>`).join('')}
                    </ul>
                </div>
                <div class="sidebar-widget">
                    <h3><i class="fas fa-tags"></i> Categories</h3>
                    <ul class="category-list">
                        ${Array.from(categories).slice(0, 10).map(cat => `<li><a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>`).join('')}
                    </ul>
                </div>
            </aside>
        </div>
    `;
    
    document.getElementById('dynamicContent').innerHTML = html;
    attachBookmarkEvents();
    
    document.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => loadHome(parseInt(btn.dataset.page)));
    });
}

// ==================== CATEGORY PAGE ====================
async function loadCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('cat');
    if (!category) return loadHome();
    
    const url = getApiUrl(`/feeds/posts/default/-/${encodeURIComponent(category)}?alt=json&max-results=${POSTS_PER_PAGE}`);
    const data = await fetchJSON(url);
    const posts = data?.feed?.entry?.map(parsePost) || [];
    
    const recentUrl = getApiUrl(`/feeds/posts/default?alt=json&max-results=5`);
    const recentData = await fetchJSON(recentUrl);
    const recentPosts = recentData?.feed?.entry?.map(parsePost) || [];
    
    const html = `
        <div class="two-column">
            <div class="main-col">
                <h2 style="font-size:28px;margin-bottom:28px;border-left:5px solid #e63946;padding-left:18px">
                    <i class="fas fa-folder"></i> ${escapeHtml(category)}
                </h2>
                <div class="news-grid">
                    ${posts.map(renderCard).join('')}
                </div>
                ${posts.length === 0 ? '<p style="text-align:center;padding:40px;">No posts in this category.</p>' : ''}
            </div>
            <aside class="sidebar">
                <div class="sidebar-widget">
                    <h3>Recent Posts</h3>
                    <ul class="recent-list">
                        ${recentPosts.map(p => `<li><a href="post.html?id=${p.id}">${escapeHtml(p.title)}</a></li>`).join('')}
                    </ul>
                </div>
            </aside>
        </div>
    `;
    
    document.getElementById('dynamicContent').innerHTML = html;
    attachBookmarkEvents();
}

// ==================== POST PAGE ====================
async function loadPost() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    if (!postId) return loadHome();
    
    const url = getApiUrl(`/feeds/posts/default/${postId}?alt=json`);
    const data = await fetchJSON(url);
    
    if (!data?.entry) {
        document.getElementById('dynamicContent').innerHTML = '<div style="padding:40px;text-align:center">Post not found</div>';
        return;
    }
    
    const post = parsePost(data.entry);
    const relatedPosts = await loadRelatedPosts(post.labels, post.id);
    
    document.title = `${post.title} - NewsPortal`;
    
    const html = `
        ${renderBreadcrumbs(post.labels[0], post.title)}
        <div class="article-full">
            <h1 class="post-title">${escapeHtml(post.title)}</h1>
            <div class="post-meta">
                <span><i class="far fa-calendar-alt"></i> ${formatDate(post.published)}</span>
                <span><i class="far fa-user"></i> ${escapeHtml(post.author)}</span>
                <span class="read-time"><i class="far fa-clock"></i> ${calculateReadTime(post.content)}</span>
            </div>
            ${renderShareButtons(post.title, window.location.href)}
            <img src="${post.image}" class="post-featured-img" alt="${escapeHtml(post.title)}">
            <div class="post-content">${post.content}</div>
            <div class="post-labels">
                ${post.labels.map(label => `<span class="label-badge">${escapeHtml(label)}</span>`).join('')}
            </div>
            ${renderRelatedPosts(relatedPosts)}
        </div>
    `;
    
    document.getElementById('dynamicContent').innerHTML = html;
    
    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": post.title,
        "datePublished": post.published,
        "dateModified": post.published,
        "author": { "@type": "Person", "name": post.author },
        "image": post.image
    });
    document.head.appendChild(schemaScript);
}

// ==================== SEARCH PAGE ====================
async function loadSearch() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return loadHome();
    
    const url = getApiUrl(`/feeds/posts/default?alt=json&q=${encodeURIComponent(query)}&max-results=20`);
    const data = await fetchJSON(url);
    const posts = data?.feed?.entry?.map(parsePost) || [];
    
    const html = `
        <div style="margin: 48px 0;">
            <h2 style="margin-bottom: 28px; border-left: 5px solid #e63946; padding-left: 18px;">
                <i class="fas fa-search"></i> Search results for: "${escapeHtml(query)}"
            </h2>
            <div class="news-grid">
                ${posts.map(renderCard).join('')}
            </div>
            ${posts.length === 0 ? '<p style="text-align:center;padding:40px;">No posts found. Try different keywords.</p>' : ''}
        </div>
    `;
    
    document.getElementById('dynamicContent').innerHTML = html;
    attachBookmarkEvents();
}

// ==================== BOOKMARK EVENT HANDLERS ====================
function attachBookmarkEvents() {
    document.querySelectorAll('.bookmark-btn').forEach(btn => {
        btn.removeEventListener('click', handleBookmarkClick);
        btn.addEventListener('click', handleBookmarkClick);
    });
}

function handleBookmarkClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    const postId = btn.dataset.id;
    
    if (isBookmarked(postId)) {
        removeBookmark(postId);
        btn.classList.remove('active');
    } else {
        saveBookmark(postId);
        btn.classList.add('active');
    }
}

// ==================== UI TOGGLES ====================
function initUIToggles() {
    const searchToggle = document.getElementById('searchToggleBtn');
    const searchBar = document.getElementById('searchBarContainer');
    if (searchToggle && searchBar) {
        searchToggle.addEventListener('click', () => {
            searchBar.classList.toggle('active');
            if (searchBar.classList.contains('active')) {
                document.getElementById('searchInput')?.focus();
            }
        });
    }
    
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const navUl = document.querySelector('.main-nav ul');
    if (mobileToggle && navUl) {
        mobileToggle.addEventListener('click', () => {
            navUl.classList.toggle('open');
        });
    }
    
    const bookmarkNav = document.getElementById('bookmarkNavBtn');
    if (bookmarkNav) {
        bookmarkNav.addEventListener('click', () => {
            window.location.href = 'bookmarks.html';
        });
    }
}

// ==================== FIX MISSING ICONS ====================
function fixMissingIcons() {
    // Remove manifest link to fix 404 errors
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        manifestLink.remove();
    }
}

// ==================== INITIALIZATION ====================
async function init() {
    fixMissingIcons();
    initDarkMode();
    initReadingProgress();
    initLiveSearch();
    initPushNotifications();
    initUIToggles();
    updateBookmarkCount();
    
    await loadCategories();
    await loadBreakingTicker();
    
    const path = window.location.pathname;
    if (path.includes('post.html')) {
        await loadPost();
    } else if (path.includes('category.html')) {
        await loadCategory();
    } else if (path.includes('search.html')) {
        await loadSearch();
    } else if (path.includes('bookmarks.html')) {
        await loadBookmarks();
    } else {
        await loadHome(1);
    }
}

init();