// public/feed.js - client code for rendering the rentals feed and basic interactions
async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function timeAgo(when) {
  const d = new Date(when);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function renderCard(feedEl, rental) {
  const tmpl = document.getElementById('card-template');
  const node = tmpl.content.cloneNode(true);
  const article = node.querySelector('.card');
  node.querySelector('.owner-name').textContent = rental.owner.name || 'Owner';
  node.querySelector('.created-at').textContent = timeAgo(rental.created_at);
  node.querySelector('.title').textContent = rental.title;
  node.querySelector('.location').textContent = rental.location || '';
  node.querySelector('.price').textContent = rental.price ? `$${rental.price}` : '';
  node.querySelector('.description').textContent = rental.description || '';
  node.querySelector('.likes').textContent = rental.likes || 0;
  node.querySelector('.comments-count').textContent = (rental.comments || []).length;

  const img = node.querySelector('.card-image');
  const images = rental.images && rental.images.length ? rental.images : ['/placeholder.png'];
  img.src = images[0];

  // carousel state
  if (images.length > 1) {
    const prev = document.createElement('button');
    prev.className = 'carousel-btn prev';
    prev.textContent = '‹';
    const next = document.createElement('button');
    next.className = 'carousel-btn next';
    next.textContent = '›';
    const indicators = document.createElement('div');
    indicators.className = 'carousel-indicators';
    images.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'indicator' + (i === 0 ? ' active' : '');
      dot.dataset.index = i;
      indicators.appendChild(dot);
    });
    const media = node.querySelector('.card-media');
    media.appendChild(prev);
    media.appendChild(next);
    media.appendChild(indicators);

    let idx = 0;
    function show(i) {
      idx = (i + images.length) % images.length;
      img.src = images[idx];
      indicators.querySelectorAll('.indicator').forEach((b, j) => b.classList.toggle('active', j === idx));
    }
    prev.addEventListener('click', () => show(idx - 1));
    next.addEventListener('click', () => show(idx + 1));
    indicators.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.index) show(Number(e.target.dataset.index));
    });
  }

  const likeBtn = node.querySelector('.like-btn');
  likeBtn.addEventListener('click', async () => {
    try {
      const res = await getJSON(`/api/rentals/${rental.id}/like`, { method: 'POST' });
      const liked = res.liked;
      const countEl = article.querySelector('.likes');
      const current = Number(countEl.textContent || 0);
      countEl.textContent = liked ? current + 1 : Math.max(0, current - 1);
    } catch (err) {
      alert('Like failed: ' + err.message);
    }
  });

  const showCommentsBtn = node.querySelector('.show-comments');
  const commentsEl = node.querySelector('.comments');
  showCommentsBtn.addEventListener('click', () => {
    commentsEl.hidden = !commentsEl.hidden;
  });

  // render existing comments
  const commentsList = node.querySelector('.comments-list');
  (rental.comments || []).forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.user_name}: ${c.text}`;
    commentsList.appendChild(li);
  });

  const commentForm = node.querySelector('.comment-form');
  commentForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = commentForm.elements['text'];
    const text = input.value.trim();
    if (!text) return;
    try {
      const res = await getJSON(`/api/rentals/${rental.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const c = res.comment;
      const li = document.createElement('li');
      li.textContent = `${c.user_name}: ${c.text}`;
      commentsList.appendChild(li);
      input.value = '';
      const countEl = article.querySelector('.comments-count');
      countEl.textContent = Number(countEl.textContent || 0) + 1;
    } catch (err) {
      alert('Comment failed: ' + err.message);
    }
  });

  feedEl.appendChild(node);
}

// Infinite scroll & paginated loading
let feedOffset = 0;
const FEED_LIMIT = 6;
let loading = false;
let hasMore = true;

async function loadMore(feedEl) {
  if (loading || !hasMore) return;
  loading = true;
  try {
    const data = await getJSON(`/api/feed?offset=${feedOffset}&limit=${FEED_LIMIT}`);
    if (data && Array.isArray(data.feed) && data.feed.length > 0) {
      (data.feed || []).forEach(r => renderCard(feedEl, r));
      feedOffset += (data.feed || []).length;
      hasMore = !!data.hasMore;
    } else {
      // if API returned empty feed on first load, fall back to sample data
      if (feedOffset === 0) {
        const sample = await getJSON('/sample-feed.json');
        const slice = sample.slice(feedOffset, feedOffset + FEED_LIMIT);
        slice.forEach(r => renderCard(feedEl, r));
        feedOffset += slice.length;
        hasMore = feedOffset < sample.length;
      } else {
        hasMore = false;
      }
    }
  } catch (err) {
    // If API fails (backend not running), fallback to static sample data
    try {
      const sample = await getJSON('/sample-feed.json');
      const slice = sample.slice(feedOffset, feedOffset + FEED_LIMIT);
      slice.forEach(r => renderCard(feedEl, r));
      feedOffset += slice.length;
      hasMore = feedOffset < sample.length;
    } catch (e) {
      const errEl = document.createElement('div');
      errEl.className = 'feed-error';
      errEl.textContent = 'Failed to load feed: ' + err.message;
      feedEl.appendChild(errEl);
      hasMore = false;
    }
  } finally {
    loading = false;
  }
}

function setupInfiniteScroll(feedEl) {
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadMore(feedEl);
  }, { root: null, rootMargin: '400px', threshold: 0.1 });
  const sentinel = document.createElement('div');
  sentinel.className = 'sentinel';
  feedEl.appendChild(sentinel);
  observer.observe(sentinel);
}

async function loadFeed() {
  const feedEl = document.getElementById('feed');
  feedEl.innerHTML = '';
  feedOffset = 0;
  hasMore = true;
  await loadMore(feedEl);
  setupInfiniteScroll(feedEl);
}

window.addEventListener('load', loadFeed);
