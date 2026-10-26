let allArticles = [];
let currentCategory = 'Home';
let currentSubcategory = null;
let currentPage = 1;
let savedScrollPosition = 0;
const itemsPerPage = 6;

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1000&q=80';
const preferredOrder = ['Home', 'News', 'Sport', 'Business', 'Technology', 'Innovation', 'Health', 'Culture', 'Arts', 'Travel', 'Earth'];

function getValidImage(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return FALLBACK_IMG;
  }
  if (url.includes('bbci.co.uk')) {
    return url
      .replace(/\/branded_[a-z0-9_]+\//i, '/standard/')
      .replace(/\/ace\/news\//i, '/ace/standard/');
  }
  return url;
}

function cleanScrapedText(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/BBC Homepage[\s\S]*?(?=MoreBBC|Search BBC|Close menu)/gi, '')
    .replace(/Skip to content[\s\S]*?Close menu/gi, '')
    .replace(/BBC NewsMenu[\s\S]*?(?=Image source|Published|\n\n)/gi, '')
    .replace(/(HomeNewsSportEarthReelWorklifeTravelCultureFutureMusicTVWeatherSounds)+/gi, '')
    .replace(/Watch our pick of standout clips[\s\S]*$/gi, '')
    .replace(/Get in touch[\s\S]*$/gi, '')
    .replace(/On your mobileOn smart speakers[\s\S]*$/gi, '')
    .replace(/Image source,[^\n]+/gi, '')
    .replace(/Image caption,[^\n]+/gi, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();

  cleaned = cleaned.replace(/(\S{35})(\S)/g, '$1 $2');
  return cleaned;
}

function inferSubcategory(article) {
  if (article.subcategory && article.subcategory.trim() !== '' && article.subcategory !== 'World') {
    return article.subcategory.trim();
  }
  const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase();
  if (article.category === 'News') {
    if (text.includes('uk') || text.includes('britain') || text.includes('london') || text.includes('scotland') || text.includes('shetland') || text.includes('rosebank') || text.includes('burnham') || text.includes('met police')) return 'UK';
    if (text.includes('us') || text.includes('trump') || text.includes('biden') || text.includes('america') || text.includes('california') || text.includes('oregon') || text.includes('new york')) return 'US & Canada';
    if (text.includes('france') || text.includes('paris') || text.includes('europe') || text.includes('ukraine') || text.includes('germany') || text.includes('limoges')) return 'Europe';
    if (text.includes('gaza') || text.includes('israel') || text.includes('iran') || text.includes('middle east') || text.includes('jordan') || text.includes('hebron') || text.includes('dubai')) return 'Middle East';
    if (text.includes('china') || text.includes('india') || text.includes('asia') || text.includes('philippines')) return 'Asia';
    if (text.includes('africa') || text.includes('sudan') || text.includes('senegal') || text.includes('dakar')) return 'Africa';
    if (text.includes('brazil') || text.includes('lula') || text.includes('bolsonaro') || text.includes('bahamas') || text.includes('caribbean')) return 'Latin America & Caribbean';
    return 'World';
  }
  if (article.category === 'Sport') {
    if (text.includes('football') || text.includes('kompany') || text.includes('bayern') || text.includes('fifa') || text.includes('infantino')) return 'Football';
    if (text.includes('olympic') || text.includes('dakar')) return 'Olympics';
    return 'Global Sport';
  }
  if (article.category === 'Business') {
    if (text.includes('tax') || text.includes('wealth') || text.includes('pension') || text.includes('budget')) return 'Economy & Policy';
    return 'Markets';
  }
  if (article.category === 'Technology' || article.category === 'Innovation') {
    if (text.includes('ai') || text.includes('artificial intelligence')) return 'Artificial Intelligence';
    return 'Tech & Science';
  }
  if (article.category === 'Culture') {
    if (text.includes('music') || text.includes('album') || text.includes('song') || text.includes('fender') || text.includes('jazzy')) return 'Music';
    return 'Entertainment & Arts';
  }
  return article.subcategory || 'General';
}

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diff = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + ' mins ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hrs ago';
  return Math.floor(diff / 86400) + ' days ago';
}

async function loadArticles() {
  try {
    const res = await fetch('articles.json?t=' + Date.now());
    const data = await res.json();

    const seenTitles = new Set();
    const uniqueData = [];

    data.forEach(a => {
      const cleanTitle = cleanScrapedText(a.title || '');
      const cleanCont = cleanScrapedText(a.content || '');
      let cleanSum = cleanScrapedText(a.summary || '');

      if (!cleanSum || cleanSum.startsWith('BBC') || cleanSum.includes('Skip to content') || cleanSum.length < 25) {
        const firstGoodPara = cleanCont.split('\n\n').find(p => p.length > 50 && !p.includes('Skip to content') && !p.includes('HomeNews'));
        cleanSum = firstGoodPara ? firstGoodPara.slice(0, 200) + '...' : 'Read full editorial report and global analysis.';
      }

      const titleKey = cleanTitle.toLowerCase().slice(0, 28);

      if (cleanTitle && !seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        uniqueData.push({
          ...a,
          title: cleanTitle,
          summary: cleanSum,
          content: cleanCont,
          category: a.category || 'News',
          subcategory: inferSubcategory(a),
          image_url: getValidImage(a.image_url)
        });
      }
    });

    allArticles = uniqueData;
  } catch (e) {
    console.error('Erreur chargement articles.json:', e);
    allArticles = [];
  }
  buildNavigation();
  if (document.getElementById('reader-view').style.display !== 'block') {
    renderPage();
  }
}

function buildNavigation() {
  const catMap = new Map();
  allArticles.forEach(art => {
    if (!catMap.has(art.category)) {
      catMap.set(art.category, new Set());
    }
    if (art.subcategory) {
      catMap.get(art.category).add(art.subcategory);
    }
  });

  const activeCategories = ['Home', ...Array.from(catMap.keys()).sort((a, b) => {
    const ia = preferredOrder.indexOf(a);
    const ib = preferredOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  })];

  const mainNav = document.getElementById('main-nav');
  const footerNav = document.getElementById('footer-nav');
  mainNav.innerHTML = '';
  footerNav.innerHTML = '';

  activeCategories.forEach(cat => {
    const span = document.createElement('span');
    span.className = 'nav-item' + (currentCategory === cat ? (cat === 'Home' ? ' active' : ' active active-cat') : '');
    span.textContent = cat;
    span.onclick = () => selectCategory(cat, null);
    mainNav.appendChild(span);

    const fSpan = document.createElement('span');
    fSpan.textContent = cat;
    fSpan.onclick = () => { selectCategory(cat, null); window.scrollTo(0, 0); };
    footerNav.appendChild(fSpan);
  });

  const subNav = document.getElementById('sub-nav');
  subNav.innerHTML = '';
  if (currentCategory !== 'Home' && catMap.has(currentCategory)) {
    const subs = Array.from(catMap.get(currentCategory));
    if (subs.length > 0) {
      subNav.classList.add('visible');
      const allSub = document.createElement('span');
      allSub.className = 'sub-nav-item' + (currentSubcategory === null ? ' active' : '');
      allSub.textContent = 'All ' + currentCategory;
      allSub.onclick = () => selectCategory(currentCategory, null);
      subNav.appendChild(allSub);

      subs.forEach(sub => {
        const sItem = document.createElement('span');
        sItem.className = 'sub-nav-item' + (currentSubcategory === sub ? ' active' : '');
        sItem.textContent = sub;
        sItem.onclick = () => selectCategory(currentCategory, sub);
        subNav.appendChild(sItem);
      });
    } else {
      subNav.classList.remove('visible');
    }
  } else {
    subNav.classList.remove('visible');
  }

  const banner = document.getElementById('category-banner');
  if (currentCategory !== 'Home') {
    banner.classList.add('visible');
    document.getElementById('banner-cat').textContent = currentCategory;
    document.getElementById('banner-sub').textContent = currentSubcategory ? currentSubcategory : '';
  } else {
    banner.classList.remove('visible');
  }

  const drawerList = document.getElementById('drawer-list');
  drawerList.innerHTML = '';
  activeCategories.forEach(cat => {
    const wrap = document.createElement('div');
    wrap.className = 'drawer-item';

    const subs = catMap.get(cat) ? Array.from(catMap.get(cat)) : [];
    const head = document.createElement('div');
    head.className = 'drawer-item-head' + (currentCategory === cat ? ' active' : '');
    head.innerHTML = `<span>${cat}</span>${subs.length > 0 ? '<span>⌄</span>' : ''}`;

    const subList = document.createElement('div');
    subList.className = 'drawer-sublist';

    head.onclick = () => {
      if (subs.length > 0) {
        subList.classList.toggle('open');
      } else {
        selectCategory(cat, null);
        toggleDrawer(false);
      }
    };

    if (subs.length > 0) {
      const allBtn = document.createElement('div');
      allBtn.className = 'drawer-subitem';
      allBtn.textContent = 'All ' + cat;
      allBtn.onclick = () => { selectCategory(cat, null); toggleDrawer(false); };
      subList.appendChild(allBtn);

      subs.forEach(sub => {
        const sBtn = document.createElement('div');
        sBtn.className = 'drawer-subitem';
        sBtn.textContent = sub;
        sBtn.onclick = () => { selectCategory(cat, sub); toggleDrawer(false); };
        subList.appendChild(sBtn);
      });
    }

    wrap.appendChild(head);
    wrap.appendChild(subList);
    drawerList.appendChild(wrap);
  });
}

function selectCategory(cat, sub) {
  currentCategory = cat;
  currentSubcategory = sub;
  currentPage = 1;
  closeReaderViewOnly();
  buildNavigation();
  renderPage();
}

// SEO-friendly card with real <a href="articles/..."> link + instant SPA reader
function cardHTML(art, showImage = true, showSummary = true) {
  if (!art) return '';
  const imgSrc = getValidImage(art.image_url);
  return `
    <article class="article-card">
      <a href="articles/${art.id}.html" onclick="event.preventDefault(); openReader('${art.id}')" style="display:flex; flex-direction:column; height:100%;">
        ${showImage ? `<div class="img-wrapper"><img src="${imgSrc}" alt="${art.title.replace(/"/g, '&quot;')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src=FALLBACK_IMG"></div>` : ''}
        <h3 class="card-title">${art.title}</h3>
        ${showSummary && art.summary ? `<p class="card-summary">${art.summary}</p>` : ''}
        <div class="card-meta">
          <span>${timeAgo(art.published_at)}</span>
          <span>•</span>
          <span class="cat-tag">${art.subcategory || art.category}</span>
        </div>
      </a>
    </article>
  `;
}

function renderPage(customFiltered = null) {
  let filtered = customFiltered || allArticles;
  if (!customFiltered) {
    if (currentCategory !== 'Home') {
      filtered = filtered.filter(a => a.category === currentCategory);
    }
    if (currentSubcategory) {
      filtered = filtered.filter(a => a.subcategory === currentSubcategory);
    }
  }

  const heroEl = document.getElementById('hero-section');
  const secEl = document.getElementById('secondary-grid');
  const compEl = document.getElementById('compact-section');
  const latestEl = document.getElementById('latest-section');

  if (filtered.length === 0) {
    heroEl.innerHTML = '<p style="padding: 40px 0; text-align:center; color:#666;">Loading latest articles...</p>';
    secEl.innerHTML = '';
    compEl.innerHTML = '';
    latestEl.innerHTML = '';
    return;
  }

  const centerArt = filtered[0];
  const leftArts = filtered.slice(1, 3);
  const rightArts = filtered.slice(3, 5);

  heroEl.innerHTML = `
    <div class="hero-grid">
      <div class="hero-col-left">
        ${leftArts.map(a => cardHTML(a, true, true)).join('')}
      </div>
      <div class="hero-col-center">
        ${cardHTML(centerArt, true, true)}
      </div>
      <div class="hero-col-right">
        ${rightArts.map(a => cardHTML(a, true, true)).join('')}
      </div>
    </div>
  `;

  const grid4Arts = filtered.slice(5, 9);
  if (grid4Arts.length > 0) {
    secEl.innerHTML = `
      <div class="grid-4">
        ${grid4Arts.map(a => cardHTML(a, true, true)).join('')}
      </div>
    `;
  } else {
    secEl.innerHTML = '';
  }

  const grid5Arts = filtered.slice(9, 14);
  if (grid5Arts.length > 0) {
    compEl.innerHTML = `
      <div class="section-header"><h2>MORE NEWS & ANALYSIS ›</h2></div>
      <div class="grid-5">
        ${grid5Arts.map(a => cardHTML(a, true, true)).join('')}
      </div>
    `;
  } else {
    compEl.innerHTML = '';
  }

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pagedArts = filtered.slice(startIdx, startIdx + itemsPerPage);

  let pageBtns = '';
  for (let i = 1; i <= totalPages; i++) {
    pageBtns += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  latestEl.innerHTML = `
    <div class="section-header"><h2>LATEST DISPATCHES</h2></div>
    <div class="latest-updates-list">
      ${pagedArts.map(a => `
        <a href="articles/${a.id}.html" class="update-row" onclick="event.preventDefault(); openReader('${a.id}')">
          <div class="update-time">${timeAgo(a.published_at)}</div>
          <div class="update-content">
            <h3 class="card-title">${a.title}</h3>
            <p class="card-summary">${a.summary || ''}</p>
          </div>
          <div class="img-wrapper"><img src="${getValidImage(a.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src=FALLBACK_IMG"></div>
        </a>
      `).join('')}
    </div>
    ${totalPages > 1 ? `<div class="pagination">${pageBtns}</div>` : ''}
  `;
}

function goToPage(p) {
  currentPage = p;
  renderPage();
  document.getElementById('latest-section').scrollIntoView({ behavior: 'smooth' });
}

function getContextualOffer(category) {
  const offers = {
    Business: {
      title: "Global Markets Daily Briefing",
      desc: "Get institutional-grade financial analysis, stock screeners, and macroeconomic alerts delivered before the London & NY market open.",
      cta: "Explore Market Tools →",
      link: "javascript:openLegal('register')"
    },
    Innovation: {
      title: "Protect Your Digital Privacy in 2026",
      desc: "With AI tracking and cyber threats rising globally, secure your connection and encrypted data across all devices.",
      cta: "View Security Guide →",
      link: "javascript:openLegal('register')"
    },
    default: {
      title: "The Vanguard Morning Dispatch (Free Newsletter)",
      desc: "Join global readers receiving our 5-minute daily synthesis of world politics, technology, and business.",
      cta: "Subscribe for Free →",
      link: "javascript:openLegal('register')"
    }
  };
  return offers[category] || offers.default;
}

function openReader(id, pushHistory = true) {
  const art = allArticles.find(a => a.id === id);
  if (!art) return;

  savedScrollPosition = window.scrollY;

  if (pushHistory) {
    history.pushState({ view: 'reader', articleId: id }, '', '#article-' + id);
  }

  document.getElementById('main-view').style.display = 'none';
  document.getElementById('category-banner').classList.remove('visible');
  const rv = document.getElementById('reader-view');
  rv.style.display = 'block';

  document.getElementById('reader-cat').textContent = `${art.category} | ${art.subcategory}`;
  document.getElementById('reader-title').textContent = art.title;
  document.getElementById('reader-meta').textContent = `Published ${timeAgo(art.published_at)} • By Vanguard Dispatch Editorial Desk`;
  document.getElementById('reader-img').src = getValidImage(art.image_url);

  const takeaways = (art.key_takeaways && art.key_takeaways.length > 0)
    ? art.key_takeaways
    : (art.summary ? art.summary.split('. ').filter(Boolean).map(s => s.endsWith('.') ? s : s + '.') : []);

  const takeawaysHTML = takeaways.length > 0 ? `
    <div class="takeaways-box">
      <div class="takeaways-title">⚡ Key Takeaways</div>
      <ul class="takeaways-list">
        ${takeaways.map(t => `<li>${cleanScrapedText(t)}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const paragraphs = (art.content || art.summary || '')
    .split('\n\n')
    .map(p => cleanScrapedText(p))
    .filter(p => p.length > 35 && !p.includes('BBC Homepage') && !p.includes('play video'));

  const bodyHTML = paragraphs.map(p => `<p>${p}</p>`).join('');

  const whyText = art.why_it_matters || `This development in ${art.subcategory || art.category} highlights shifting dynamics that analysts and policymakers are closely monitoring over the coming weeks.`;
  const whyHTML = `
    <div class="why-matters-box">
      <h4>🌐 Why It Matters — Editorial Analysis</h4>
      <p>${whyText}</p>
    </div>
  `;

  const offer = getContextualOffer(art.category);
  const affiliateHTML = `
    <div class="affiliate-card">
      <span class="affiliate-badge">Partner Recommendation • ${art.category}</span>
      <h4>${offer.title}</h4>
      <p>${offer.desc}</p>
      <a href="${offer.link}" class="affiliate-cta">${offer.cta}</a>
    </div>
  `;

  document.getElementById('reader-body').innerHTML = takeawaysHTML + bodyHTML + whyHTML + affiliateHTML;
  window.scrollTo(0, 0);
}

function closeReaderViewOnly() {
  document.getElementById('reader-view').style.display = 'none';
  document.getElementById('main-view').style.display = 'block';
  if (currentCategory !== 'Home') {
    document.getElementById('category-banner').classList.add('visible');
  }
}

function goBackHome() {
  if (window.location.hash.startsWith('#article-')) {
    history.back();
  } else {
    closeReaderViewOnly();
    window.scrollTo(0, savedScrollPosition);
  }
}

window.addEventListener('popstate', (event) => {
  if (event.state && event.state.view === 'reader') {
    openReader(event.state.articleId, false);
  } else {
    closeReaderViewOnly();
    window.scrollTo(0, savedScrollPosition);
  }
});

function toggleDrawer(open) {
  document.getElementById('drawer').classList.toggle('open', open);
  document.getElementById('drawer-overlay').classList.toggle('open', open);
}

function handleSearch(e) {
  if (e.key === 'Enter') executeSearch();
}

function executeSearch() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  toggleDrawer(false);
  closeReaderViewOnly();
  if (!q) {
    renderPage();
    return;
  }
  const res = allArticles.filter(a =>
    (a.title || '').toLowerCase().includes(q) ||
    (a.summary || '').toLowerCase().includes(q) ||
    (a.content || '').toLowerCase().includes(q)
  );
  renderPage(res);
}

const legalPages = {
  privacy: `
    <h2>Privacy Policy & Google AdSense Disclosure</h2>
    <p><strong>Last Updated: October 2026</strong></p>
    <p>At Vanguard Dispatch, accessible from our website, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by our platform and how we use it.</p>
    <h3>Google DoubleClick DART Cookie & AdSense</h3>
    <p>Google is one of a third-party vendor on our site. It also uses cookies, known as DART cookies, to serve ads to our site visitors based upon their visit to our website and other sites on the internet. However, visitors may choose to decline the use of DART cookies by visiting the Google ad and content network Privacy Policy at the following URL – <em>https://policies.google.com/technologies/ads</em></p>
    <h3>Log Files & Analytics</h3>
    <p>We follow a standard procedure of using log files. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks.</p>
    <h3>GDPR & CCPA Data Protection Rights</h3>
    <p>Every user is entitled to the right to access, rectify, erase, restrict processing, and object to processing of their personal data. We do not sell personal user data to third parties.</p>
  `,
  terms: `
    <h2>Terms of Use</h2>
    <p>By accessing Vanguard Dispatch, you agree to be bound by these Website Terms and Conditions of Use and agree that you are responsible for compliance with any applicable local laws.</p>
    <h3>Editorial Content & Syndication</h3>
    <p>Our articles are curated, translated, and synthesized by our editorial desk from verified international news feeds for informational purposes. All trademarks and original press rights belong to their respective owners.</p>
  `,
  cookies: `
    <h2>Cookies Policy</h2>
    <p>We use cookies to improve your browsing experience, analyze site traffic, and serve personalized advertisements via Google AdSense and certified ad partners.</p>
    <h3>Types of Cookies We Use</h3>
    <p><strong>Essential Cookies:</strong> Necessary for the website to function properly.<br><strong>Advertising Cookies:</strong> Used by third-party partners (such as Google) to build a profile of your interests and show you relevant adverts on other sites.</p>
  `,
  about: `
    <h2>About Vanguard Dispatch</h2>
    <p>Vanguard Dispatch is an independent digital news publication and international editorial platform providing real-time breaking news across World Politics, Business, Technology, Science, Health, Culture, and Sport.</p>
    <p>Our mission is to deliver clear, unbiased international journalism accessible to readers worldwide.</p>
  `,
  contact: `
    <h2>Contact the Editorial & Advertising Team</h2>
    <p>For press inquiries, copyright notices, DMCA requests, or advertising partnerships, please contact our desk:</p>
    <p><strong>Email:</strong> editorial@vanguarddispatch.com<br><strong>Press Office:</strong> Vanguard Dispatch Media Group, Digital Desk</p>
  `,
  advertise: `
    <h2>Advertise With Us</h2>
    <p>Vanguard Dispatch reaches global readers across key demographics in News, Business, and Technology. We support direct banner placements and programmatic advertising via Google AdSense.</p>
    <p>Contact: <strong>ads@vanguarddispatch.com</strong></p>
  `,
  accessibility: `
    <h2>Accessibility Help</h2>
    <p>We are committed to making our news portal accessible to all readers, including those using screen readers and keyboard navigation. Use your browser zoom controls (Ctrl + / -) to adjust text size comfortably.</p>
  `,
  register: `
    <h2>Reader Subscription</h2>
    <p>Free reader accounts and daily newsletter subscriptions are currently being upgraded. You can browse all breaking news articles freely without an account.</p>
  `,
  signin: `
    <h2>Sign In</h2>
    <p>Subscriber login is temporarily in maintenance mode. All articles are currently unlocked for public reading.</p>
  `
};

function openLegal(key) {
  document.getElementById('legal-content').innerHTML = legalPages[key] || legalPages.privacy;
  document.getElementById('legal-modal').classList.add('open');
}

function closeLegal() {
  document.getElementById('legal-modal').classList.remove('open');
}

function acceptCookies() {
  localStorage.setItem('vdn_cookies_accepted', '1');
  document.getElementById('cookie-banner').classList.remove('show');
}

if (!localStorage.getItem('vdn_cookies_accepted')) {
  document.getElementById('cookie-banner').classList.add('show');
}

loadArticles();
setInterval(loadArticles, 60000);