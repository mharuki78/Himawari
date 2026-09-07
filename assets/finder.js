import { fetchProducts, priceFormatter, safeHttpsUrl } from "../products.js";
import { groupProductFamilies, productCategory } from "./catalog-tools.js";

const form = document.querySelector("[data-finder-form]");
const results = document.querySelector("[data-finder-results]");
const cards = document.querySelector("[data-finder-cards]");
const compare = document.querySelector("[data-finder-compare]");
const status = document.querySelector("[data-finder-status]");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function text(product) {
  return [
    product.name,
    product.tagline,
    product.description,
    ...(product.highlights || []),
  ]
    .join(" ")
    .toLocaleLowerCase("ko-KR");
}

function score(product, answers) {
  const copy = text(product);
  let value = productCategory(product) === answers.purpose ? 8 : 0;
  if (Number(product.price) <= Number(answers.budget)) value += 4;
  if (answers.storage === "organized" && /(수납|포켓|노트북|정돈)/.test(copy))
    value += 3;
  if (answers.storage === "roomy" && /(대용량|여행|넉넉|기저귀)/.test(copy))
    value += 3;
  if (answers.storage === "light" && /(미니|초경량|가벼)/.test(copy))
    value += 3;
  if (answers.priority === "waterproof" && /(방수|생활 방수)/.test(copy))
    value += 3;
  if (answers.priority === "light" && /(초경량|가벼|미니)/.test(copy))
    value += 3;
  if (answers.priority === "design" && /(단정|실루엣|데일리|디자인)/.test(copy))
    value += 2;
  return value;
}

function card(product, rank, variantCount) {
  const article = document.createElement("article");
  article.className = "finder-card";
  const image = safeHttpsUrl(product.image);
  article.innerHTML = `${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : ""}<div><span>추천 ${rank}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.tagline || "매일의 움직임을 위한 Himawari 백팩입니다.")}</p><strong>${priceFormatter.format(product.price)}</strong><small>${variantCount > 1 ? `${variantCount}가지 색상·구성` : "단일 구성"}</small><a href="product.html?id=${encodeURIComponent(product.id)}">상세 보기 →</a></div>`;
  return article;
}

function renderCompare(items) {
  const rows = [
    ["모델", (item) => item.product.model],
    ["가격", (item) => priceFormatter.format(item.product.price)],
    [
      "용도",
      (item) =>
        ({
          school: "학생·책가방",
          business: "출근·노트북",
          travel: "여행·육아",
          daily: "데일리·미니",
        })[productCategory(item.product)],
    ],
    ["선택", (item) => `${item.variantCount}가지`],
    ["재고", (item) => (item.product.soldOut ? "품절" : "주문 가능")],
  ];
  const table = document.createElement("table");
  table.innerHTML = `<caption>추천 제품 비교표</caption><thead><tr><th scope="col">기준</th>${items.map((item) => `<th scope="col">${escapeHtml(item.product.model)}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, read]) => `<tr><th scope="row">${escapeHtml(label)}</th>${items.map((item) => `<td>${escapeHtml(read(item))}</td>`).join("")}</tr>`).join("")}</tbody>`;
  compare.replaceChildren(table);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const missing = [...form.querySelectorAll("[required]")].find(
    (control) => !control.validity.valid,
  );
  if (missing) {
    status.textContent = "네 가지 질문에 모두 답해 주세요.";
    missing.focus();
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  status.textContent = "등록된 제품을 비교하고 있습니다.";
  try {
    const answers = Object.fromEntries(new FormData(form));
    const families = groupProductFamilies(await fetchProducts());
    const picked = families
      .map((family) => ({
        product: family.representative,
        variantCount: family.variants.length,
        score: score(family.representative, answers),
      }))
      .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
      .slice(0, 3);
    cards.replaceChildren(
      ...picked.map((item, index) =>
        card(item.product, index + 1, item.variantCount),
      ),
    );
    renderCompare(picked);
    results.hidden = false;
    status.textContent = "추천 제품 세 가지를 찾았습니다.";
    results.focus({ preventScroll: true });
    results.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  } catch {
    status.textContent =
      "제품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    submit.disabled = false;
  }
});
