/* পড়ার পাতা — the same content as the planet, as an ordinary web page.
   read.html            every section and post
   read.html?s=ID&p=N   one post (N counts from 1; a post may also set its own `id`) */
import { SECTIONS, PROPS } from './content.js';

const bnum = (n) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const app = document.getElementById('app'), q = new URLSearchParams(location.search);
const SITE = 'https://shenahamoin.com/';
const postKey = (s, i) => s.posts[i].id || String(i + 1);
const postHref = (s, i) => s.posts[i].url || `read.html?s=${s.id}&p=${encodeURIComponent(postKey(s, i))}`;
const strip = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };

function head(title, desc, path, ld){
  document.title = title;
  document.querySelector('meta[name="description"]').content = desc;
  document.querySelector('link[rel="canonical"]').href = SITE + path;
  document.querySelector('meta[property="og:title"]').content = title;
  if (ld){ const s = document.createElement('script'); s.type = 'application/ld+json'; s.textContent = JSON.stringify(ld); document.head.append(s); }
}

function index(){
  const about = PROPS.find(p => p.id === 'about'), contact = PROPS.find(p => p.id === 'contact');
  app.innerHTML = `
    <h1>মইনের লেখা</h1>
    <p class="intro">ব্যঙ্গ, বিশ্লেষণ, মুভি রিভিউ, প্রবন্ধ আর নিছক হাসির লেখা — ছয়টি সিরিজে। এটি <a class="plainlink" style="margin:0;font-size:inherit" href="./">লেখকের গ্রহ</a>-এর সাধারণ পাঠ্য সংস্করণ।</p>
    ${SECTIONS.map(s => `
      <section id="${s.id}">
        <h2 style="color:${s.color}">${s.icon} ${s.name}</h2>
        <span class="roman">${s.roman} · ${s.kind}</span>
        <p class="lede">${s.lede}</p>
        ${s.posts.length ? s.posts.map((p, i) => `
          <a class="post" href="${postHref(s, i)}"${p.url ? ' target="_blank" rel="noopener"' : ''}>
            <div class="meta">${p.kind || ''} · ${p.date || ''}</div>
            <h3>${p.title}</h3><p>${p.excerpt || ''}</p>
          </a>`).join('') : `<div class="empty">এই সেকশনে এখনও কিছু প্রকাশিত হয়নি। শিগগিরই আসছে।</div>`}
      </section>`).join('')}
    <section id="about"><h2>${about.name}</h2><p class="lede">${about.lede}</p></section>
    <section id="contact"><h2>${contact.name}</h2><p class="lede">${contact.lede}</p></section>`;
}

function post(s, i){
  const p = s.posts[i], path = `read?s=${s.id}&p=${encodeURIComponent(postKey(s, i))}`;   // the host serves read.html as /read
  const desc = p.excerpt || strip((p.body || [])[0] || s.lede).slice(0, 160);
  head(`${p.title} — মইন · ${s.name}`, desc, path, {
    '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: desc, inLanguage: 'bn',
    articleSection: s.name, url: SITE + path, mainEntityOfPage: SITE + path, image: SITE + 'share.png',
    author: { '@type': 'Person', name: 'মইন', alternateName: 'Moin', url: SITE }
  });
  const prev = s.posts[i - 1], next = s.posts[i + 1];
  app.innerHTML = `
    <div class="crumbs"><a href="read.html">সব লেখা</a> › <a href="read.html#${s.id}" style="color:${s.color}">${s.name}</a></div>
    <article>
      <div class="tag" style="color:${s.color}">${s.roman} · ${p.kind || s.kind}</div>
      <h1>${p.title}</h1>
      <div class="byline">MOIN · ${p.date || ''}</div>
      <div class="rule" style="background:${s.color}"></div>
      <div class="body">${(p.body || []).map(t => `<p>${t}</p>`).join('')}</div>
      <div class="end">✦ ✦ ✦</div>
    </article>
    ${prev ? `<a class="post" href="${postHref(s, i - 1)}"><div class="meta">আগের লেখা</div><h3>${prev.title}</h3></a>` : ''}
    ${next ? `<a class="post" href="${postHref(s, i + 1)}"><div class="meta">পরের লেখা</div><h3>${next.title}</h3></a>` : ''}`;
}

const s = SECTIONS.find(x => x.id === q.get('s'));
const i = s ? s.posts.findIndex((p, k) => postKey(s, k) === q.get('p')) : -1;
if (s && i >= 0 && !s.posts[i].url) post(s, i);
else { index(); if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView(); }
