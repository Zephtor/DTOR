/*
  Simple demo fetcher that loads eBay RSS via a CORS proxy and displays items.
  Notes: For production, use the official eBay APIs with credentials/server-proxy.
*/
document.addEventListener('DOMContentLoaded', ()=>{
  const container = document.getElementById('products');
  const searchInput = document.getElementById('search');
  const searchBtn = document.getElementById('doSearch');

  function showMessage(msg){
    container.innerHTML = `<div style="grid-column:1/-1;color:var(--muted)">${msg}</div>`;
  }

  async function fetchEbay(q='thinkpad'){
    showMessage('Lade Produkte...');
    // First try to load local JSON-managed products
    try{
      const localUrl = 'src/data/products.json';
      const localRes = await fetch(localUrl);
      if(localRes.ok){
        const data = await localRes.json();
        if(Array.isArray(data) && data.length){
          // create minimal cards and fill via API
          container.innerHTML = data.map(item => {
            const id = item.id || '';
            return `
              <article class="product" data-id="${id}">
                <img src="https://via.placeholder.com/300x200?text=Lade..." alt="">
                <div class="title">Lade...</div>
                <div class="meta"></div>
                <a class="link" href="#" target="_blank" rel="noopener">Zum Angebot</a>
              </article>
            `;
          }).join('');
          bindProductClicks();
          populateDetails();
          return; // done
        }
      }
    }catch(e){
      // fall through to RSS fetch if local JSON missing/invalid
      console.warn('Lokale products.json konnte nicht geladen werden, versuche eBay RSS', e);
    }

    // try server-side search API first
    try{
      const apiResp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if(apiResp.ok){
        const items = await apiResp.json();
        if(Array.isArray(items) && items.length){
          container.innerHTML = items.map(it => {
            const title = it.title || 'Kein Titel';
            const link = it.link || '#';
            const id = it.id || '';
            const img = it.image || 'https://via.placeholder.com/300x200?text=ThinkPad';
            const price = it.price || '';
            const idAttr = id ? `data-id="${id}"` : '';
            const linkAttr = link ? `data-link="${link}"` : '';
            return `
              <article class="product" ${idAttr} ${linkAttr}>
                <img src="${img}" alt="${title}">
                <div class="title">${title}</div>
                <div class="meta">${price}</div>
                <a class="link" href="${link}" target="_blank" rel="noopener">Auf eBay ansehen</a>
              </article>
            `;
          }).join('');
          bindProductClicks();
          return;
        }
      }
    }catch(apiErr){
      console.warn('search API failed, falling back to RSS', apiErr);
    }

    // fallback: fetch from eBay RSS via CORS proxy
    try{
      const rssUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_rss=1`;
      const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(rssUrl);
      const res = await fetch(proxy);
      if(!res.ok) throw new Error('Fetch error');
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      const items = Array.from(xml.querySelectorAll('item'));
      if(items.length === 0) { showMessage('Keine Produkte gefunden.'); return; }

      container.innerHTML = items.slice(0,40).map(it => {
        const title = it.querySelector('title')?.textContent || 'Kein Titel';
        const link = it.querySelector('link')?.textContent || '#';
        const idMatch = link.match(/\/(\d+)(?:\?|$)/);
        const id = idMatch ? idMatch[1] : '';
        const desc = it.querySelector('description')?.textContent || '';
        // extract image src from description HTML
        const imgMatch = desc.match(/<img[^>]+src\s*=\s*['\"]([^'\"]+)['\"]/i);
        const img = imgMatch ? imgMatch[1] : 'https://via.placeholder.com/300x200?text=ThinkPad';
        // try to extract price text
        const priceMatch = desc.match(/(\$|EUR|€)\s?[0-9,.]+/i);
        const price = priceMatch ? priceMatch[0] : '';
        const idAttr = id ? `data-id="${id}"` : '';
        const linkAttr = link ? `data-link="${link}"` : '';

        return `
          <article class="product" ${idAttr} ${linkAttr}>
            <img src="${img}" alt="${title}">
            <div class="title">${title}</div>
            <div class="meta">${price}</div>
            <a class="link" href="${link}" target="_blank" rel="noopener">Auf eBay ansehen</a>
          </article>
        `;
      }).join('');
      bindProductClicks();

    }catch(err){
      console.error(err);
      showMessage('Fehler beim Laden — siehe Konsole.');
    }
  }

  // initial load
  fetchEbay('thinkpad');

  // load details for cards based on id
  async function populateDetails(){
    const cards = container.querySelectorAll('.product[data-id]');
    await Promise.all(Array.from(cards).map(async card=>{
      const id = card.getAttribute('data-id');
      if(!id) return;
      try{
        const resp = await fetch(`/api/scrape?id=${encodeURIComponent(id)}`);
        if(!resp.ok) throw new Error(resp.statusText);
        const d = await resp.json();
        const imgEl = card.querySelector('img');
        if(d.images && d.images.length) imgEl.src = d.images[0];
        if(d.title) imgEl.alt = d.title;
        if(d.title) card.querySelector('.title').textContent = d.title;
        if(d.price) card.querySelector('.meta').textContent = d.price;
        if(d.url){
          card.querySelector('.link').href = d.url;
          card.setAttribute('data-link', d.url);
        }
      }catch(err){
        console.warn('detail load failed for',id,err);
      }
    }));
  }

  searchBtn.addEventListener('click', ()=>{
    const q = (searchInput.value || 'thinkpad').trim();
    fetchEbay(q);
  });
  searchInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') searchBtn.click(); });

  // modal helper
  const modal = createModal();

  function bindProductClicks(){
    container.querySelectorAll('.product').forEach(el=>{
      el.addEventListener('click',async ()=>{
        const id = el.getAttribute('data-id');
        const link = el.getAttribute('data-link');
        if(id){
          modal.setContent('Lade Details...');
          modal.show();
          try{
            const resp = await fetch(`/api/scrape?id=${encodeURIComponent(id)}`);
            if(!resp.ok) throw new Error(resp.statusText);
            const data = await resp.json();
            modal.setContent(renderDetails(data));
          }catch(e){
            console.warn('Scrape failed, fallback',e);
            // show basic info from the card itself
            modal.setContent(fallbackDetails(el));
          }
        } else if(link){
          modal.setContent(`<p><a href="${link}" target="_blank">Zur eBay-Seite</a></p>`);
          modal.show();
        }
      });
    });
  }

  function fallbackDetails(el){
    const title = el.querySelector('.title')?.textContent || '';
    const price = el.querySelector('.meta')?.textContent || '';
    const link = el.getAttribute('data-link') || '';
    let h = `<h2>${title}</h2><p>${price}</p>`;
    if(link) h += `<p><a href="${link}" target="_blank" class="link">Zum Angebot</a></p>`;
    return h;
  }

  function renderDetails(d){
    let html = `<h2>${d.title||''}</h2>`;
    if(d.images && d.images.length){
      html += '<div class="detail-images">';
      d.images.forEach(src=> html += `<img src="${src}" style="max-width:100%;margin-bottom:8px">`);
      html += '</div>';
    }
    html += `<p><strong>Preis:</strong> ${d.price||'n/a'}</p>`;
    html += `<p><strong>Zustand:</strong> ${d.condition||'n/a'}</p>`;
    html += `<p><strong>Verkäufer:</strong> ${d.seller||'n/a'}</p>`;
    if(d.desc) html += `<p>${d.desc}</p>`;
    if(d.url) html += `<p><a href="${d.url}" target="_blank" class="link">Buy Now</a></p>`;
    return html;
  }

  function createModal(){
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-content"><button class="modal-close" aria-label="Close">&times;</button><div class="modal-body"></div></div>`;
    document.body.appendChild(m);
    const body = m.querySelector('.modal-body');
    m.querySelector('.modal-close').addEventListener('click', ()=>m.classList.remove('show'));
    m.addEventListener('click',(e)=>{if(e.target===m)m.classList.remove('show');});
    return {
      show(){m.classList.add('show'); m.setAttribute('aria-hidden','false');},
      hide(){m.classList.remove('show'); m.setAttribute('aria-hidden','true');},
      setContent(html){body.innerHTML = html;},
    };
  }
});
