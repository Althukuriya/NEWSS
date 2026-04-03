// Replace ALL your script.js with this - NO CORS ERRORS!

const BLOG_URL = 'https://newwwwwsave.blogspot.com';
const POSTS_PER_PAGE = 9;

// JSONP function - Works without CORS
function getBloggerData(endpoint, callback) {
    const callbackName = 'cb_' + Date.now();
    const script = document.createElement('script');
    
    window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        callback(data);
    };
    
    let url = BLOG_URL + endpoint;
    url += (url.includes('?') ? '&' : '?') + `alt=json-in-script&callback=${callbackName}`;
    script.src = url;
    document.body.appendChild(script);
}

// Simple parse function
function parsePost(entry) {
    const imgMatch = entry.content.$t.match(/<img[^>]+src="([^">]+)"/);
    return {
        id: entry.id.$t.split('post-')[1],
        title: entry.title.$t,
        published: entry.published.$t,
        author: entry.author?.[0]?.name?.$t || 'Editor',
        content: entry.content.$t,
        image: imgMatch ? imgMatch[1] : 'https://via.placeholder.com/400x200',
        labels: entry.category?.map(c => c.term) || []
    };
}

// Load homepage
function loadHome() {
    getBloggerData(`/feeds/posts/default?max-results=${POSTS_PER_PAGE}`, function(data) {
        if (!data?.feed?.entry) {
            document.getElementById('dynamicContent').innerHTML = '<p>Failed to load news. Check Blogger URL.</p>';
            return;
        }
        
        const posts = data.feed.entry.map(parsePost);
        document.getElementById('dynamicContent').innerHTML = `
            <div class="news-grid" style="margin:40px 0">
                ${posts.map(post => `
                    <div class="news-card">
                        <img src="${post.image}" class="card-img">
                        <div class="card-content">
                            <h3><a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a></h3>
                            <p>${new Date(post.published).toDateString()} | ${post.author}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    });
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

// Start
loadHome();
