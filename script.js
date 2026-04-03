// ==================== CONFIGURATION ====================
const BLOG_URL = 'https://newwwwwsave.blogspot.com';
const POSTS_PER_PAGE = 12;

// Cache for faster loading
let categoriesCache = null;
let postsCache = {};

// ==================== JSONP FUNCTION (No CORS issues!) ====================
function jsonpRequest(url, callbackName, callback) {
    const script = document.createElement('script');
    const callbackFunction = `jsonp_callback_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    window[callbackFunction] = function(data) {
        delete window[callbackFunction];
        document.body.removeChild(script);
        callback(data);
    };
    
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}alt=json-in-script&callback=${callbackFunction}`;
    document.body.appendChild(script);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        if (window[callbackFunction]) {
            delete window[callbackFunction];
            callback(null);
        }
    }, 10000);
}

// ==================== FETCH WITH JSONP ====================
function fetchPosts(endpoint, callback) {
    let url = `${BLOG_URL}${endpoint}`;
    // Remove any existing alt parameter
    url = url.replace(/[?&]alt=json[^&]*/, '');
    jsonpRequest(url, 'callback', callback);
}

// ==================== PARSE FUNCTIONS ====================
function parsePost(entry) {
    const content = entry.content.$t;
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    return {
        id: entry.id.$t.split('post-')[1],
        title: entry.title.$t || 'Untitled',
        published: entry.published.$t,
        author: entry.author?.[0]?.name?.$t || 'Editor',
        content: content,
        summary: entry.summary?.$t || content.replace(/<[^>]*>/g, '').substring(0, 120) + '...',
        image: imgMatch ? imgMatch[1] : 'https://via.placeholder.com/400x200?text=News',
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
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    } catch(e) {
        return dateStr;
    }
}

function calculateReadTime(content) {
    const words = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
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
    const newBookmarks = bookmarks.filter(id => id !== postId);
    localStorage.setItem('bookmarks', JSON.stringify(newBookmarks));
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

// ==================== SHARE BUTTONS ====================
function renderShareButtons(title, url) {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    return `
        <div class="share-buttons">
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="share-btn share-fb"><i class="fab fa-facebook-f"></i> Share</a>
            <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" class="share-btn share-twitter"><i class="fab fa-twitter"></i> Tweet</a>
            <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}" target="_blank" class="share-btn share-linkedin"><i class="fab fa-linkedin-in"></i> Share</a>
        </div>
    `;
}

// ==================== RENDER CARD ====================
function renderCard(post) {
    return `
        <div class="news-card">
            <img src="${post.image}" class="card-img" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200?text=News'">
            <div class="card-content">
                <div class="card-category">${escapeHtml(post.labels[0] || 'News')}</div>
                <h3 class="card-title"><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                <div class="card-meta">
                    <span><i class="far fa-calendar"></i> ${formatDate(post.published)}</span>
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
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
    });
}

// ==================== READING PROGRESS ====================
function initReadingProgress() {
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const bar = document.getElementById('readingProgressBar');
        if (bar) bar.style.width = scrolled + '%';
    });
}

// ==================== LOAD CATEGORIES ====================
function loadCategories() {
    fetchPosts('/feeds/posts/default?max-results=50', function(data) {
        if (!data || !data.feed || !data.feed.entry) {
            console.error('Failed to load categories');
            return;
        }
        
        const categoriesSet = new Set();
        data.feed.entry.forEach(entry => {
            if (entry.category) {
                entry.category.forEach(cat => categoriesSet.add(cat.term));
            }
        });
        
        const categories = Array.from(categoriesSet).slice(0, 12);
        
        const navUl = document.getElementById('categoryNav');
        if (navUl) {
            navUl.innerHTML = `
                <li><a href="index.html">Home</a></li>
                ${categories.map(cat => `<li><a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>`).join('')}
            `;
        }
        
        const dropdownContent = document.getElementById('dropdownContent');
        if (dropdownContent) {
            dropdownContent.innerHTML = categories.map(cat => `
                <a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>
            `).join('');
        }
    });
}

// ==================== LOAD BREAKING TICKER ====================
function loadBreakingTicker() {
    fetchPosts('/feeds/posts/default?max-results=5', function(data) {
        if (data?.feed?.entry) {
            const titles = data.feed.entry.map(e => e.title.$t);
            const ticker = document.getElementById('breakingTicker');
            if (ticker) {
                ticker.innerHTML = `<div class="ticker-item">🔥 ${titles.join('  •  ')}</div>`;
            }
        }
    });
}

// ==================== LOAD HOME PAGE ====================
function loadHome(page = 1) {
    const startIndex = (page - 1) * POSTS_PER_PAGE + 1;
    showLoader();
    
    fetchPosts(`/feeds/posts/default?max-results=${POSTS_PER_PAGE}&start-index=${startIndex}`, function(data) {
        if (!data?.feed?.entry) {
            document.getElementById('dynamicContent').innerHTML = `
                <div style="padding:40px;text-align:center">
                    <h3>⚠️ Unable to load news</h3>
                    <p>Please check your Blogger URL</p>
                    <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:#e63946;color:white;border:none;border-radius:8px;">Retry</button>
                </div>
            `;
            return;
        }
        
        const posts = data.feed.entry.map(parsePost);
        const total = parseInt(data.feed.openSearch$totalResults?.$t || 0);
        const totalPages = Math.ceil(total / POSTS_PER_PAGE);
        
        // Load recent posts for sidebar
        fetchPosts('/feeds/posts/default?max-results=5', function(recentData) {
            const recentPosts = recentData?.feed?.entry?.map(parsePost) || [];
            
            // Load categories for sidebar
            fetchPosts('/feeds/posts/default?max-results=50', function(catData) {
                const categoriesSet = new Set();
                catData?.feed?.entry?.forEach(entry => {
                    entry.category?.forEach(cat => categoriesSet.add(cat.term));
                });
                const categories = Array.from(categoriesSet).slice(0, 10);
                
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
                                    ${categories.map(cat => `<li><a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>`).join('')}
                                </ul>
                            </div>
                        </aside>
                    </div>
                `;
                
                document.getElementById('dynamicContent').innerHTML = html;
                attachBookmarkEvents();
                
                // Pagination events
                document.querySelectorAll('.pagination button').forEach(btn => {
                    btn.addEventListener('click', () => loadHome(parseInt(btn.dataset.page)));
                });
            });
        });
    });
}

// ==================== LOAD CATEGORY PAGE ====================
function loadCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('cat');
    if (!category) return loadHome();
    
    showLoader();
    
    fetchPosts(`/feeds/posts/default/-/${encodeURIComponent(category)}?max-results=${POSTS_PER_PAGE}`, function(data) {
        const posts = data?.feed?.entry?.map(parsePost) || [];
        
        fetchPosts('/feeds/posts/default?max-results=5', function(recentData) {
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
        });
    });
}

// ==================== LOAD POST PAGE ====================
function loadPost() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    if (!postId) return loadHome();
    
    showLoader();
    
    fetchPosts(`/feeds/posts/default/${postId}`, function(data) {
        if (!data?.entry) {
            document.getElementById('dynamicContent').innerHTML = '<div style="padding:40px;text-align:center">Post not found</div>';
            return;
        }
        
        const post = parsePost(data.entry);
        document.title = `${post.title} - NewsPortal`;
        
        // Load related posts
        fetchPosts('/feeds/posts/default?max-results=30', function(relatedData) {
            let relatedPosts = [];
            if (relatedData?.feed?.entry) {
                const allPosts = relatedData.feed.entry.map(parsePost);
                relatedPosts = allPosts.filter(p => 
                    p.id !== post.id && 
                    p.labels.some(label => post.labels.includes(label))
                ).slice(0, 4);
            }
            
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
                    <img src="${post.image}" class="post-featured-img" alt="${escapeHtml(post.title)}" onerror="this.src='https://via.placeholder.com/800x400?text=News'">
                    <div class="post-content">${post.content}</div>
                    <div class="post-labels">
                        ${post.labels.map(label => `<span class="label-badge">${escapeHtml(label)}</span>`).join('')}
                    </div>
                    ${renderRelatedPosts(relatedPosts)}
                </div>
            `;
            
            document.getElementById('dynamicContent').innerHTML = html;
            
            // Add JSON-LD Schema
            const schemaScript = document.createElement('script');
            schemaScript.type = 'application/ld+json';
            schemaScript.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "headline": post.title,
                "datePublished": post.published,
                "author": { "@type": "Person", "name": post.author },
                "image": post.image
            });
            document.head.appendChild(schemaScript);
        });
    });
}

// ==================== LOAD SEARCH PAGE ====================
function loadSearch() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return loadHome();
    
    showLoader();
    
    fetchPosts(`/feeds/posts/default?q=${encodeURIComponent(query)}&max-results=20`, function(data) {
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
    });
}

// ==================== LOAD BOOKMARKS PAGE ====================
function loadBookmarks() {
    const bookmarkIds = getBookmarks();
    const container = document.getElementById('bookmarksList');
    
    if (bookmarkIds.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">No saved articles yet. <a href="index.html">Browse news</a> to bookmark your favorites.</p>';
        return;
    }
    
    container.innerHTML = '<div class="loader-spinner"><i class="fas fa-spinner fa-spin"></i> Loading bookmarks...</div>';
    
    let loadedCount = 0;
    const posts = [];
    
    bookmarkIds.forEach((id, index) => {
        fetchPosts(`/feeds/posts/default/${id}`, function(data) {
            if (data?.entry) {
                posts.push(parsePost(data.entry));
            }
            loadedCount++;
            
            if (loadedCount === bookmarkIds.length) {
                if (posts.length === 0) {
                    container.innerHTML = '<p style="text-align:center; padding:40px;">No valid bookmarks found.</p>';
                } else {
                    container.innerHTML = posts.map(renderCard).join('');
                    attachBookmarkEvents();
                }
            }
        });
    });
}

// ==================== HELPER RENDER FUNCTIONS ====================
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

function renderRelatedPosts(posts) {
    if (posts.length === 0) return '';
    return `
        <div class="related-posts">
            <h3><i class="fas fa-link"></i> Related Articles</h3>
            <div class="related-grid">
                ${posts.map(post => `
                    <div class="related-card">
                        <img src="${post.image}" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x150?text=News'">
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

function showLoader() {
    document.getElementById('dynamicContent').innerHTML = `
        <div class="loader-spinner">
            <i class="fas fa-spinner fa-spin"></i> Loading...
        </div>
    `;
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

// ==================== LIVE SEARCH ====================
function initLiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('liveSearchResults');
    if (!searchInput) return;
    
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            resultsDiv.classList.remove('active');
            return;
        }
        
        debounceTimer = setTimeout(() => {
            fetchPosts(`/feeds/posts/default?q=${encodeURIComponent(query)}&max-results=5`, function(data) {
                if (data?.feed?.entry) {
                    const posts = data.feed.entry.map(parsePost);
                    resultsDiv.innerHTML = posts.map(post => `
                        <div class="live-search-item" onclick="window.location.href='post.html?id=${post.id}'">
                            <img src="${post.image}" alt="" onerror="this.src='https://via.placeholder.com/50x50?text=News'">
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
            });
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
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        manifestLink.remove();
    }
}

// ==================== INITIALIZATION ====================
function init() {
    fixMissingIcons();
    initDarkMode();
    initReadingProgress();
    initLiveSearch();
    initPushNotifications();
    initUIToggles();
    updateBookmarkCount();
    
    loadCategories();
    loadBreakingTicker();
    
    const path = window.location.pathname;
    if (path.includes('post.html')) {
        loadPost();
    } else if (path.includes('category.html')) {
        loadCategory();
    } else if (path.includes('search.html')) {
        loadSearch();
    } else if (path.includes('bookmarks.html')) {
        loadBookmarks();
    } else {
        loadHome(1);
    }
}

// Start the app
init();
