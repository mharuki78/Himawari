const KRW = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function detailHref(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

function productImage(product, className) {
  const image = safeHttpsUrl(product.image);
  const body = image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">`
    : '<p class="product-image-fallback">이미지를 불러오지 못했습니다.</p>';
  return `<a class="${className}${image ? '' : ' is-missing'}" href="${detailHref(product)}" aria-label="${escapeHtml(product.name)} 상세페이지 보기">${body}</a>`;
}

function productActions(product, featured = false) {
  const classes = featured
    ? { detail: 'detail-link featured-detail-link', cart: 'buy-link featured-buy-link', buy: 'direct-buy-link featured-direct-buy-link' }
    : { detail: 'detail-link', cart: 'buy-link', buy: 'direct-buy-link' };
  const storeUrl = safeHttpsUrl(product.url) || 'https://smartstore.naver.com/baegot';
  return `<div class="${featured ? 'featured-product-actions' : 'store-product-actions'}">
    <a class="${classes.detail}" href="${detailHref(product)}" aria-label="${escapeHtml(product.name)} 상세페이지 보기">상세 보기 <span aria-hidden="true">→</span></a>
    <button class="${classes.cart}" type="button" data-cart-add data-product-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}" data-price="${escapeHtml(product.price)}" data-url="${escapeHtml(storeUrl)}" aria-label="${escapeHtml(product.name)} 장바구니에 담기" aria-live="polite">장바구니 담기 <span aria-hidden="true">+</span></button>
    <button class="wishlist-button" type="button" data-wishlist-toggle data-product-id="${escapeHtml(product.id)}" aria-pressed="false" aria-label="${escapeHtml(product.name)} 관심상품 저장"><span data-wishlist-label>관심상품 저장</span></button>
    <a class="${classes.buy}" href="${escapeHtml(storeUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(product.name)} 네이버 스마트스토어에서 바로 구매하기 — 새 탭에서 열림">바로 구매하기 <span aria-hidden="true">↗</span></a>
  </div>`;
}

function renderProductCard(product) {
  return `<article class="store-product-card card reveal is-visible" data-server-rendered-product>
    ${productImage(product, 'store-product-media')}
    <div class="store-product-body">
      <p class="card-label">${escapeHtml(product.model || 'Himawari')}</p>
      <h3><a href="${detailHref(product)}">${escapeHtml(product.name)}</a></h3>
      <p class="product-tagline">${escapeHtml(product.tagline || '일상에 자연스럽게 맞는 가방입니다.')}</p>
      <div class="store-product-footer"><strong>${KRW.format(product.price)}</strong>${productActions(product)}</div>
    </div>
  </article>`;
}

function renderFeaturedProduct(product) {
  const highlights = (Array.isArray(product.highlights) ? product.highlights : [])
    .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
    .join('');
  return `<article class="featured-product card reveal is-visible" data-server-rendered-product>
    ${productImage(product, 'featured-product-media')}
    <div class="featured-product-content">
      <p class="card-label">Editor’s choice · ${escapeHtml(product.model || 'Himawari')}</p>
      <h3><a href="${detailHref(product)}">${escapeHtml(product.name)}</a></h3>
      <p class="featured-tagline">${escapeHtml(product.tagline || '')}</p>
      ${highlights ? `<ol class="featured-highlights">${highlights}</ol>` : ''}
      <div class="featured-product-footer"><strong>${KRW.format(product.price)}</strong>${productActions(product, true)}</div>
    </div>
  </article>`;
}

function catalogSchema(products, origin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Himawari 전체 제품',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}/product.html?id=${encodeURIComponent(product.id)}`,
      item: {
        '@type': 'Product',
        name: product.name,
        sku: product.model,
        image: safeHttpsUrl(product.image),
        description: product.description || product.tagline,
        brand: { '@type': 'Brand', name: 'Himawari' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'KRW',
          price: String(product.price),
          url: safeHttpsUrl(product.url),
        },
      },
    })),
  };
}

export function renderCatalogPage(template, products, origin = 'https://allaboutbag.com') {
  const featured = products.find((product) => product.featured === true) || products[0];
  const remaining = products.filter((product) => product !== featured);
  const schema = JSON.stringify(catalogSchema(products, origin)).replaceAll('<', '\\u003c');
  return template
    .replace(/<!-- SERVER_CATALOG_SCHEMA -->\s*<script type="application\/ld\+json" data-catalog-schema>[\s\S]*?<\/script>/, `<script type="application/ld+json" data-catalog-schema>${schema}</script>`)
    .replace(/<!-- SERVER_FEATURED_PRODUCT -->\s*<p class="product-list-state">[\s\S]*?<\/p>/, featured ? renderFeaturedProduct(featured) : '<p class="product-list-state">등록된 대표 제품이 없습니다.</p>')
    .replace(/<!-- SERVER_PRODUCT_GRID -->\s*<p class="product-list-state">[\s\S]*?<\/p>/, remaining.length ? remaining.map(renderProductCard).join('\n') : '<p class="product-list-state">등록된 제품이 없습니다.</p>')
    .replace('<strong data-product-count>—</strong>', `<strong data-product-count>${products.length}</strong>`)
    .replaceAll('aria-busy="true"', 'aria-busy="false"');
}

function renderDescription(value) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block)}</p>`)
    .join('');
}

function renderHighlights(product) {
  return (Array.isArray(product.highlights) ? product.highlights : [])
    .map((highlight, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(highlight)}</p></li>`)
    .join('');
}

function renderGallery(product) {
  return (Array.isArray(product.gallery) ? product.gallery : [])
    .map((url, index) => {
      const image = safeHttpsUrl(url);
      return image
        ? `<div class="product-detail-image-frame product-detail-image-frame--longform"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} 상세 이미지 ${index + 1}" loading="lazy" decoding="async"></div>`
        : '';
    })
    .join('');
}

export function renderProductPage(template, product, origin = 'https://allaboutbag.com') {
  const canonical = `${origin}/product.html?id=${encodeURIComponent(product.id)}`;
  const description = String(product.description || product.tagline || '').slice(0, 160);
  const mainImage = safeHttpsUrl(product.image);
  const storeUrl = safeHttpsUrl(product.url) || 'https://smartstore.naver.com/baegot';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.model,
    image: [mainImage, ...(Array.isArray(product.gallery) ? product.gallery.map(safeHttpsUrl) : [])].filter(Boolean),
    description,
    brand: { '@type': 'Brand', name: 'Himawari' },
    offers: { '@type': 'Offer', priceCurrency: 'KRW', price: String(product.price), url: storeUrl },
  };

  let html = template
    .replace('<title>제품 상세 — Himawari</title>', `<title>${escapeHtml(product.name)} — Himawari</title>`)
    .replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>\n  </head>`)
    .replace('<section class="product-detail-state" data-loading-state role="status">', '<section class="product-detail-state" data-loading-state role="status" hidden>')
    .replace('<article data-product-content hidden>', '<article data-product-content>')
    .replace('aria-busy="true"', 'aria-busy="false"')
    .replace('data-breadcrumb-current aria-current="page">상세<', `data-breadcrumb-current aria-current="page">${escapeHtml(product.model)}<`)
    .replace('data-model>Himawari<', `data-model>${escapeHtml(product.model)}<`)
    .replace('data-name>제품 상세<', `data-name>${escapeHtml(product.name)}<`)
    .replace('data-tagline></p>', `data-tagline>${escapeHtml(product.tagline)}</p>`)
    .replace('data-price></strong>', `data-price>${KRW.format(product.price)}</strong>`)
    .replace('data-main-image></figure>', `data-main-image>${mainImage ? `<div class="product-detail-image-frame"><img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" decoding="async" fetchpriority="high"></div>` : '<p class="product-image-fallback">이미지를 불러오지 못했습니다.</p>'}</figure>`)
    .replace('data-description></div>', `data-description>${renderDescription(product.description || product.tagline)}</div>`)
    .replace('data-highlights></ol>', `data-highlights>${renderHighlights(product)}</ol>`)
    .replace('data-gallery></div>', `data-gallery>${renderGallery(product)}</div>`)
    .replace('data-closing-title>오래 곁에 둘 가방을 선택하세요.<', `data-closing-title>${escapeHtml(product.model)}, 오래 곁에 둘 선택.<`);

  html = html
    .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${escapeHtml(canonical)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${escapeHtml(product.name)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${escapeHtml(canonical)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${escapeHtml(mainImage)}$2`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${escapeHtml(description)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${escapeHtml(description)}$2`)
    .replace('data-direct-buy href="https://smartstore.naver.com/baegot"', `data-direct-buy href="${escapeHtml(storeUrl)}"`)
    .replace('data-closing-buy href="https://smartstore.naver.com/baegot"', `data-closing-buy href="${escapeHtml(storeUrl)}"`)
    .replace('data-detail-cart>', `data-detail-cart data-cart-add data-product-id="${escapeHtml(product.id)}" data-name="${escapeHtml(product.name)}" data-price="${escapeHtml(product.price)}" data-url="${escapeHtml(storeUrl)}">`)
    .replace('data-detail-wishlist data-wishlist-toggle', `data-detail-wishlist data-wishlist-toggle data-product-id="${escapeHtml(product.id)}"`);

  if (!(Array.isArray(product.highlights) && product.highlights.length)) {
    html = html.replace('<section class="product-highlights section" data-highlights-section', '<section class="product-highlights section" data-highlights-section hidden');
  }
  if (!(Array.isArray(product.gallery) && product.gallery.length)) {
    html = html.replace('<section class="product-gallery section" data-gallery-section', '<section class="product-gallery section" data-gallery-section hidden');
  }
  return html;
}

export function renderProductNotFoundPage(template) {
  return template
    .replace('<title>제품 상세 — Himawari</title>', '<title>제품을 찾을 수 없습니다 — Himawari</title>')
    .replace('<section class="product-detail-state" data-loading-state role="status">', '<section class="product-detail-state" data-loading-state role="status" hidden>')
    .replace('<section class="product-not-found" data-not-found hidden>', '<section class="product-not-found" data-not-found>')
    .replace('aria-busy="true"', 'aria-busy="false"');
}
