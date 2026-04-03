// ==================== WORKING VERSION - NO ERRORS ====================
const BLOG_URL = 'https://newwwwwsave.blogspot.com';
const POSTS_PER_PAGE = 12;

// JSONP function - bypasses CORS completely
function loadBloggerData(endpoint, callback) {
    const callbackName = 'blogger_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const script = document.createElement('script');
    
    window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        callback(data);
    };
    
    let url = BLOG_URL + endpoint;
    url += (url.includes('?') ? '&' : '?') + 'alt=json-in-script&callback=' + callbackName;
    
    script.src = url;
    script.onerror = function() {
        callback(null);
    };
    document.body.appendChild(script);
}

// Parse blog post - FIXED: Working fallback image
function parsePost(entry) {
    const content = entry.content.$t;
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    // FIXED: Using picsum.photos which is reliable
    const fallbackImage = 'https://picsum.photos/400/250?random=' + Math.floor(Math.random() * 1000);
    return {
        id: entry.id.$t.split('post-')[1],
        title: entry.title.$t || 'Untitled',
        published: entry.published.$t,
        author: entry.author?.[0]?.name?.$t || 'Editor',
        content: content,
        summary: entry.summary?.$t || content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
        image: imgMatch ? imgMatch[1] : fallbackImage,
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
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch(e) {
        return dateStr;
    }
}

function calculateReadTime(content) {
    const words = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

// Render a news card
function renderCard(post) {
    return `
        <div class="news-card">
            <img src="${post.image}" class="card-img" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.src='https://picsum.photos/400/250?random=1'">
            <div class="card-content">
                <div class="card-category">${escapeHtml(post.labels[0] || 'News')}</div>
                <h3 class="card-title"><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                <div class="card-meta">
                    <span><i class="far fa-calendar"></i> ${formatDate(post.published)}</span>
                    <span class="read-time"><i class="far fa-clock"></i> ${calculateReadTime(post.content)}</span>
                </div>
                <p class="card-excerpt">${escapeHtml(post.summary)}</p>
            </div>
        </div>
    `;
}

// ==================== PAGE LOADERS ====================

function loadHome() {
    showLoader();
    
    loadBloggerData(`/feeds/posts/default?max-results=${POSTS_PER_PAGE}`, function(data) {
        if (!data || !data.feed || !data.feed.entry) {
            document.getElementById('dynamicContent').innerHTML = `
                <div style="padding:60px 20px;text-align:center">
                    <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#e63946"></i>
                    <h2 style="margin:20px 0">Unable to Load News</h2>
                    <p>Your Blogger URL: ${BLOG_URL}</p>
                    <p>Make sure your blog is public and accessible.</p>
                    <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#e63946;color:white;border:none;border-radius:8px;cursor:pointer">Retry</button>
                </div>
            `;
            return;
        }
        
        const posts = data.feed.entry.map(parsePost);
        const total = parseInt(data.feed.openSearch$totalResults?.$t || 0);
        const totalPages = Math.ceil(total / POSTS_PER_PAGE);
        
        // Load categories for sidebar
        loadBloggerData('/feeds/posts/default?max-results=50', function(catData) {
            const categories = new Set();
            if (catData?.feed?.entry) {
                catData.feed.entry.forEach(entry => {
                    entry.category?.forEach(cat => categories.add(cat.term));
                });
            }
            
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
                                <button class="${i === 0 ? 'active' : ''}" data-page="${i+1}">${i+1}</button>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                    <aside class="sidebar">
                        <div class="sidebar-widget">
                            <h3><i class="fas fa-clock"></i> Recent Posts</h3>
                            <ul class="recent-list">
                                ${posts.slice(0, 5).map(p => `<li><a href="post.html?id=${p.id}">${escapeHtml(p.title)}</a></li>`).join('')}
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
            
            // Pagination
            document.querySelectorAll('.pagination button').forEach(btn => {
                btn.addEventListener('click', () => loadPage(parseInt(btn.dataset.page)));
            });
        });
    });
}

function loadPage(page) {
    showLoader();
    const startIndex = (page - 1) * POSTS_PER_PAGE + 1;
    
    loadBloggerData(`/feeds/posts/default?max-results=${POSTS_PER_PAGE}&start-index=${startIndex}`, function(data) {
        if (data?.feed?.entry) {
            const posts = data.feed.entry.map(parsePost);
            const grid = document.querySelector('.news-grid');
            if (grid) grid.innerHTML = posts.map(renderCard).join('');
            
            document.querySelectorAll('.pagination button').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.page) === page);
            });
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function loadCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('cat');
    if (!category) return loadHome();
    
    showLoader();
    
    loadBloggerData(`/feeds/posts/default/-/${encodeURIComponent(category)}?max-results=${POSTS_PER_PAGE}`, function(data) {
        const posts = data?.feed?.entry?.map(parsePost) || [];
        
        const html = `
            <div style="margin: 48px 0;">
                <h2 style="margin-bottom: 28px; border-left: 5px solid #e63946; padding-left: 18px;">
                    <i class="fas fa-folder"></i> ${escapeHtml(category)}
                </h2>
                <div class="news-grid">
                    ${posts.map(renderCard).join('')}
                </div>
                ${posts.length === 0 ? '<p style="text-align:center;padding:40px;">No posts in this category.</p>' : ''}
            </div>
        `;
        
        document.getElementById('dynamicContent').innerHTML = html;
    });
}

function loadPost() {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    if (!postId) return loadHome();
    
    showLoader();
    
    loadBloggerData(`/feeds/posts/default/${postId}`, function(data) {
        if (!data?.entry) {
            document.getElementById('dynamicContent').innerHTML = '<div style="padding:40px;text-align:center">Post not found</div>';
            return;
        }
        
        const post = parsePost(data.entry);
        document.title = `${post.title} - NewsPortal`;
        
        // Load related posts
        loadBloggerData('/feeds/posts/default?max-results=20', function(relatedData) {
            let relatedPosts = [];
            if (relatedData?.feed?.entry) {
                const allPosts = relatedData.feed.entry.map(parsePost);
                relatedPosts = allPosts.filter(p => 
                    p.id !== post.id && 
                    p.labels.some(l => post.labels.includes(l))
                ).slice(0, 4);
            }
            
            const html = `
                <div class="breadcrumbs" style="margin:24px 0 0 0;font-size:14px">
                    <a href="index.html">Home</a>
                    <span> › </span>
                    ${post.labels[0] ? `<a href="category.html?cat=${encodeURIComponent(post.labels[0])}">${escapeHtml(post.labels[0])}</a><span> › </span>` : ''}
                    <span>${escapeHtml(post.title)}</span>
                </div>
                <div class="article-full">
                    <h1 class="post-title">${escapeHtml(post.title)}</h1>
                    <div class="post-meta">
                        <span><i class="far fa-calendar-alt"></i> ${formatDate(post.published)}</span>
                        <span><i class="far fa-user"></i> ${escapeHtml(post.author)}</span>
                        <span class="read-time"><i class="far fa-clock"></i> ${calculateReadTime(post.content)}</span>
                    </div>
                    <div class="share-buttons" style="display:flex;gap:12px;margin:20px 0">
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank" class="share-btn share-fb" style="background:#1877f2;color:white;padding:8px 16px;border-radius:40px;text-decoration:none"><i class="fab fa-facebook-f"></i> Share</a>
                        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}" target="_blank" class="share-btn share-twitter" style="background:#1da1f2;color:white;padding:8px 16px;border-radius:40px;text-decoration:none"><i class="fab fa-twitter"></i> Tweet</a>
                    </div>
                    <img src="${post.image}" class="post-featured-img" alt="${escapeHtml(post.title)}" style="width:100%;max-height:500px;object-fit:cover;border-radius:16px;margin:20px 0" onerror="this.src='https://picsum.photos/800/400?random=1'">
                    <div class="post-content" style="font-size:18px;line-height:1.7">${post.content}</div>
                    <div class="post-labels" style="display:flex;gap:10px;margin-top:30px;flex-wrap:wrap">
                        ${post.labels.map(label => `<span class="label-badge" style="background:#eef2fa;padding:5px 14px;border-radius:30px">${escapeHtml(label)}</span>`).join('')}
                    </div>
                    ${relatedPosts.length > 0 ? `
                    <div class="related-posts" style="margin-top:48px;padding-top:32px;border-top:2px solid #eef2f5">
                        <h3>Related Articles</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px;margin-top:20px">
                            ${relatedPosts.map(p => `
                                <div style="background:#f8f9fa;border-radius:12px;overflow:hidden">
                                    <img src="${p.image}" style="width:100%;height:140px;object-fit:cover">
                                    <div style="padding:12px">
                                        <h4><a href="post.html?id=${p.id}" style="text-decoration:none;color:inherit">${escapeHtml(p.title)}</a></h4>
                                        <small>${calculateReadTime(p.content)}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            document.getElementById('dynamicContent').innerHTML = html;
        });
    });
}

function loadSearch() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return loadHome();
    
    showLoader();
    
    loadBloggerData(`/feeds/posts/default?q=${encodeURIComponent(query)}&max-results=20`, function(data) {
        const posts = data?.feed?.entry?.map(parsePost) || [];
        
        const html = `
            <div style="margin: 48px 0;">
                <h2 style="margin-bottom: 28px; border-left: 5px solid #e63946; padding-left: 18px;">
                    <i class="fas fa-search"></i> Search results for: "${escapeHtml(query)}"
                </h2>
                <div class="news-grid">
                    ${posts.map(renderCard).join('')}
                </div>
                ${posts.length === 0 ? '<p style="text-align:center;padding:40px;">No posts found.</p>' : ''}
            </div>
        `;
        
        document.getElementById('dynamicContent').innerHTML = html;
    });
}

function loadBookmarks() {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const container = document.getElementById('bookmarksList');
    
    if (bookmarks.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;">No saved articles. <a href="index.html">Browse news</a></p>';
        return;
    }
    
    container.innerHTML = '<div class="loader-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    let loaded = 0;
    const posts = [];
    
    bookmarks.forEach(id => {
        loadBloggerData(`/feeds/posts/default/${id}`, function(data) {
            if (data?.entry) posts.push(parsePost(data.entry));
            loaded++;
            if (loaded === bookmarks.length) {
                container.innerHTML = posts.map(renderCard).join('');
            }
        });
    });
}

function showLoader() {
    document.getElementById('dynamicContent').innerHTML = `
        <div class="loader-spinner" style="text-align:center;padding:60px">
            <i class="fas fa-spinner fa-spin" style="font-size:40px;color:#e63946"></i>
            <p style="margin-top:20px">Loading news...</p>
        </div>
    `;
}

// ==================== UI FEATURES ====================

function initDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') document.body.classList.add('dark-mode');
    document.getElementById('darkModeToggle')?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'enabled' : 'disabled');
    });
}

function initReadingProgress() {
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        const bar = document.getElementById('readingProgressBar');
        if (bar) bar.style.width = scrolled + '%';
    });
}

function initLiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('liveSearchResults');
    if (!searchInput) return;
    
    let timer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();
        if (query.length < 2) {
            resultsDiv.classList.remove('active');
            return;
        }
        timer = setTimeout(() => {
            loadBloggerData(`/feeds/posts/default?q=${encodeURIComponent(query)}&max-results=5`, function(data) {
                if (data?.feed?.entry) {
                    const posts = data.feed.entry.map(parsePost);
                    resultsDiv.innerHTML = posts.map(post => `
                        <div class="live-search-item" onclick="window.location.href='post.html?id=${post.id}'" style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;gap:12px">
                            <img src="${post.image}" style="width:50px;height:50px;object-fit:cover;border-radius:8px">
                            <div><strong>${escapeHtml(post.title)}</strong><br><small>${calculateReadTime(post.content)}</small></div>
                        </div>
                    `).join('');
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
    
    document.getElementById('searchSubmitBtn')?.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    });
}

function loadCategories() {
    loadBloggerData('/feeds/posts/default?max-results=50', function(data) {
        if (!data?.feed?.entry) return;
        
        const categories = new Set();
        data.feed.entry.forEach(entry => {
            entry.category?.forEach(cat => categories.add(cat.term));
        });
        
        const navUl = document.getElementById('categoryNav');
        if (navUl) {
            navUl.innerHTML = `
                <li><a href="index.html">Home</a></li>
                ${Array.from(categories).slice(0, 8).map(cat => `<li><a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a></li>`).join('')}
            `;
        }
        
        const dropdown = document.getElementById('dropdownContent');
        if (dropdown) {
            dropdown.innerHTML = Array.from(categories).slice(0, 15).map(cat => `
                <a href="category.html?cat=${encodeURIComponent(cat)}">${escapeHtml(cat)}</a>
            `).join('');
        }
    });
}

function loadBreakingTicker() {
    loadBloggerData('/feeds/posts/default?max-results=5', function(data) {
        if (data?.feed?.entry) {
            const titles = data.feed.entry.map(e => e.title.$t);
            const ticker = document.getElementById('breakingTicker');
            if (ticker) {
                ticker.innerHTML = `<div class="ticker-item">🔥 ${titles.join('  •  ')}</div>`;
            }
        }
    });
}

function initPushNotifications() {
    const btn = document.getElementById('pushNotifyBtn');
    if (!btn) return;
    if ('Notification' in window) {
        btn.addEventListener('click', async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                btn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
                btn.style.background = '#27ae60';
            }
        });
        if (localStorage.getItem('notificationsEnabled') === 'true') {
            btn.innerHTML = '<i class="fas fa-check"></i> Alerts On';
            btn.style.background = '#27ae60';
        }
    }
}

function initUIToggles() {
    document.getElementById('searchToggleBtn')?.addEventListener('click', () => {
        const bar = document.getElementById('searchBarContainer');
        bar?.classList.toggle('active');
        if (bar?.classList.contains('active')) document.getElementById('searchInput')?.focus();
    });
    
    document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
        document.querySelector('.main-nav ul')?.classList.toggle('open');
    });
    
    document.getElementById('bookmarkNavBtn')?.addEventListener('click', () => {
        window.location.href = 'bookmarks.html';
    });
}

function updateBookmarkCount() {
    const count = JSON.parse(localStorage.getItem('bookmarks') || '[]').length;
    const elem = document.getElementById('bookmarkCount');
    if (elem) elem.textContent = count;
}

function fixMissingIcons() {
    // Remove manifest link to fix 404 errors when running locally
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        manifestLink.remove();
    }
}

// ==================== INITIALIZE ====================
function init() {
    fixMissingIcons();  // This removes the manifest.json request
    initDarkMode();
    initReadingProgress();
    initLiveSearch();
    initPushNotifications();
    initUIToggles();
    updateBookmarkCount();
    
    loadCategories();
    loadBreakingTicker();
    
    const path = window.location.pathname;
    if (path.includes('post.html')) loadPost();
    else if (path.includes('category.html')) loadCategory();
    else if (path.includes('search.html')) loadSearch();
    else if (path.includes('bookmarks.html')) loadBookmarks();
    else loadHome();
}

init();
