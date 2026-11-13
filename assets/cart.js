(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // assets/shipping-policy.js
  var SHIPPING_FEE = 3500;
  var FREE_SHIPPING_THRESHOLD = 7e4;
  function standardShippingFee(subtotal) {
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  }

  // assets/order-summary.js
  function orderBenefits(lines, { discountAmount = 0, shippingFee } = {}) {
    let subtotal = 0, campaignSavings = 0;
    for (const line of lines) {
      if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0 || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) throw new Error("\uC0C1\uD488 \uAE08\uC561\uACFC \uC218\uB7C9\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      subtotal += line.unitPrice * line.quantity;
      if (line.campaign && Number.isSafeInteger(line.regularPrice) && line.regularPrice > line.unitPrice) campaignSavings += (line.regularPrice - line.unitPrice) * line.quantity;
    }
    const couponSavings = Math.min(subtotal, Math.max(0, Math.floor(Number(discountAmount) || 0)));
    const shipping = lines.length ? shippingFee ?? standardShippingFee(subtotal) : 0;
    return {
      subtotal,
      campaignSavings,
      couponSavings,
      totalSavings: campaignSavings + couponSavings,
      shippingFee: shipping,
      total: subtotal - couponSavings + shipping,
      remaining: subtotal && shipping === 0 ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
      progress: subtotal && shipping === 0 ? 1 : Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD)
    };
  }

  // assets/catalog-tools.js
  var COLOR_WORDS = ["\uBE14\uB799", "\uBE14\uB8E8", "\uD551\uD06C", "\uCE74\uD0A4", "\uC544\uC774\uBCF4\uB9AC", "\uC2E4\uBC84", "\uADF8\uB808\uC774", "\uBCA0\uC774\uC9C0", "\uBE0C\uB77C\uC6B4", "\uBBFC\uD2B8", "\uD37C\uD50C", "\uB808\uB4DC", "\uC610\uB85C", "\uC624\uB80C\uC9C0", "\uADF8\uB9B0", "\uB124\uC774\uBE44", "\uD654\uC774\uD2B8", "\uD53C\uCE58", "\uB77C\uBCA4\uB354", "\uC2A4\uCE74\uC774", "\uBC84\uAC74\uB514", "\uCF54\uB784"];
  var CATALOG_CATEGORIES = Object.freeze([
    { id: "all", label: "\uC804\uCCB4" },
    { id: "school", label: "\uD559\uC0DD\xB7\uCC45\uAC00\uBC29" },
    { id: "business", label: "\uCD9C\uADFC\xB7\uB178\uD2B8\uBD81" },
    { id: "travel", label: "\uC5EC\uD589\xB7\uC721\uC544" },
    { id: "daily", label: "\uB370\uC77C\uB9AC\xB7\uBBF8\uB2C8" }
  ]);
  function productFamilyKey(product) {
    const model = String(product?.model || product?.name || "").match(/(?:no\.?)?\s*(\d{3,5}[a-z]?)/i)?.[1];
    return model ? model.toLocaleUpperCase("en-US") : String(product?.id || product?.name || "product");
  }
  function productColor(product) {
    const text = `${product?.name || ""} ${product?.model || ""}`;
    return COLOR_WORDS.find((color) => text.includes(color)) || COLOR_WORDS.find((color) => String(product?.tagline || "").includes(color)) || "";
  }
  function productVariantLabel(product) {
    const name = String(product?.name || "").trim();
    const modelMatch = name.match(/(?:no\.?)?\s*\d{3,5}[a-z]?/i);
    const suffix = modelMatch ? name.slice((modelMatch.index || 0) + modelMatch[0].length).replace(/^[\s+·\-_/]+/, "").trim() : "";
    return suffix || productColor(product) || String(product?.model || "\uAE30\uBCF8");
  }

  // assets/cart-options.js
  var key = (item) => JSON.stringify([item.id, item.optionId || ""]);
  var context = (item) => JSON.stringify([item.blackFriday?.offerId || "", item.blackFriday?.unitPrice || 0]);
  function variantChoices(item, products, event) {
    const source = products.find((product) => product.id === item.id);
    if (!source) return [];
    const open = event?.state === "open" && Date.parse(event.endsAt) > Date.now() && (!event.serverTime || Date.parse(event.serverTime) < Date.parse(event.endsAt));
    return products.filter((product) => productFamilyKey(product) === productFamilyKey(source)).flatMap((product) => {
      return ((product.options || []).length ? product.options : [{ id: "", label: "", stock: product.stock }]).map((option) => {
        const sale = item.blackFriday && open && event.items?.find((offer) => offer.productId === product.id && offer.optionId === option.id);
        const stock = item.blackFriday ? sale?.remaining ?? 0 : option.stock;
        const price = item.blackFriday ? sale?.price : product.price;
        const reason = item.blackFriday && !sale ? "\uD589\uC0AC \uB300\uC0C1 \uC544\uB2D8" : stock != null && stock < item.q ? "\uC218\uB7C9 \uBD80\uC871" : !Number.isSafeInteger(price) || price < 1 ? "\uAC00\uACA9 \uD655\uC778 \uD544\uC694" : "";
        return {
          id: product.id,
          optionId: option.id,
          optionLabel: option.label || "",
          name: product.name,
          image: sale?.image || product.image,
          label: [productVariantLabel(product), option.label].filter(Boolean).join(" \xB7 "),
          price,
          stock: stock ?? null,
          url: product.url || "",
          ...sale ? { blackFriday: { offerId: sale.offerId, unitPrice: sale.price } } : {},
          disabled: Boolean(reason),
          reason
        };
      });
    });
  }
  function replaceCartOption(cart, index, choice, { isSelected = () => true } = {}) {
    const source = cart[index];
    if (!source || choice.disabled || !Number.isSafeInteger(choice.price) || choice.price < 1) throw new Error(choice.reason || "\uBCC0\uACBD\uD560 \uC635\uC158\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    const existing = cart.findIndex((item, i) => i !== index && key(item) === key(choice));
    if (existing !== -1 && context(cart[existing]) !== context(choice)) throw new Error("\uAC19\uC740 \uC635\uC158\uC774 \uB2E4\uB978 \uAD6C\uB9E4 \uC870\uAC74\uC73C\uB85C \uB2F4\uACA8 \uC788\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC0C1\uD488\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
    if (existing !== -1 && isSelected(source) !== isSelected(cart[existing])) throw new Error("\uC120\uD0DD \uC0C1\uD0DC\uAC00 \uB2E4\uB978 \uC0C1\uD488\uACFC \uD569\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB450 \uC0C1\uD488\uC758 \uC120\uD0DD \uC0C1\uD0DC\uB97C \uAC19\uAC8C \uB9DE\uCDB0 \uC8FC\uC138\uC694.");
    const quantity = source.q + (existing === -1 ? 0 : cart[existing].q);
    if (quantity > 99 || choice.stock !== null && quantity > choice.stock) throw new Error("\uC774\uBBF8 \uB2F4\uAE34 \uC218\uB7C9\uC744 \uD569\uD558\uBA74 \uB0A8\uC740 \uC7AC\uACE0\uB97C \uCD08\uACFC\uD569\uB2C8\uB2E4. \uC218\uB7C9\uC744 \uC904\uC5EC \uC8FC\uC138\uC694.");
    const replacement = {
      id: choice.id,
      optionId: choice.optionId || "",
      optionLabel: choice.optionLabel || "",
      name: choice.name,
      price: choice.price,
      q: quantity,
      url: choice.url || "",
      stock: choice.stock,
      ...choice.blackFriday ? { blackFriday: { ...choice.blackFriday } } : {}
    };
    return cart.flatMap((item, i) => i === index ? [replacement] : i === existing ? [] : [item]);
  }

  // assets/cart.source.js
  (function() {
    "use strict";
    var KEY = typeof window.CART_KEY === "string" && window.CART_KEY || "site-cart";
    var T = {
      title: "\uC7A5\uBC14\uAD6C\uB2C8",
      empty: "\uC7A5\uBC14\uAD6C\uB2C8\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.<br>\uC81C\uD488 \uBAA9\uB85D\uC5D0\uC11C \uB9C8\uC74C\uC5D0 \uB4DC\uB294 \uAC83\uC744 \uB2F4\uC544\uBCF4\uC138\uC694.",
      note: "\uC8FC\uBB38\uD558\uAE30\uB97C \uB204\uB974\uBA74 \uAD6C\uB9E4 \uBC29\uBC95\uC744 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
      copy: "\uC8FC\uBB38 \uBAA9\uB85D \uBCF5\uC0AC",
      ask: "\uC8FC\uBB38 \uBB38\uC758 \uB0A8\uAE30\uAE30",
      go: "\uC81C\uD488 \uC0C1\uC138 \uBCF4\uAE30 \u2192"
    };
    var custom = window.CART_TEXT;
    if (custom && typeof custom === "object") {
      for (var k in T) {
        if (typeof custom[k] === "string") T[k] = custom[k];
      }
    }
    var NOLINK = "\uC81C\uD488 \uC0C1\uC138 \uC900\uBE44 \uC911";
    var MAX_Q = 99;
    var INQUIRY_KEY = "himawari-cart-inquiry";
    var CHECKOUT_KEY = "himawari-checkout-items";
    var cart = [];
    var selectionKey = KEY + "-unselected";
    var unselected = /* @__PURE__ */ new Set();
    try {
      var storedSelection = JSON.parse(localStorage.getItem(selectionKey));
      if (Array.isArray(storedSelection)) unselected = new Set(storedSelection.filter(function(key2) {
        return typeof key2 === "string";
      }));
    } catch (error) {
    }
    var editor = null, optionBusy = false, optionSerial = 0, optionController = null;
    var productDisplay = /* @__PURE__ */ new Map();
    var offerDisplay = /* @__PURE__ */ new Map();
    var productRequest = null;
    var saleRequest = null;
    var offerExpiresAt = 0;
    var saleExpiryTimer = null;
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (Object.prototype.toString.call(raw) === "[object Array]") {
        for (var i = 0; i < raw.length; i++) {
          var it = raw[i];
          if (!it || typeof it.name !== "string") continue;
          cart.push({
            id: typeof it.id === "string" ? it.id : "",
            name: it.name,
            price: num(it.price),
            q: Math.min(MAX_Q, Math.max(1, num(it.q) || 1)),
            url: typeof it.url === "string" ? it.url : "",
            optionId: typeof it.optionId === "string" ? it.optionId : "",
            optionLabel: typeof it.optionLabel === "string" ? it.optionLabel : "",
            stock: it.stock === "" || it.stock === null || it.stock === void 0 ? null : Math.max(0, num(it.stock)),
            ...it.blackFriday != null ? { blackFriday: copySale(it.blackFriday) } : {},
            ...it.blackFridayUnavailable ? { blackFridayUnavailable: true } : {}
          });
        }
      }
    } catch (e) {
      cart = [];
    }
    function announceCartChange() {
      document.dispatchEvent(new CustomEvent("himawari:cart-change", { detail: { items: cart.slice() } }));
    }
    function save(announce) {
      var keys = new Set(cart.map(sku));
      unselected.forEach(function(key2) {
        if (!keys.has(key2)) unselected.delete(key2);
      });
      try {
        localStorage.setItem(selectionKey, JSON.stringify(Array.from(unselected)));
      } catch (error) {
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(cart));
      } catch (e) {
      }
      document.dispatchEvent(new CustomEvent("himawari:cart-state", { detail: { items: cart.slice() } }));
      if (announce !== false) announceCartChange();
    }
    function num(v) {
      var n = parseInt(String(v == null ? "" : v).replace(/[^0-9-]/g, ""), 10);
      return isNaN(n) ? 0 : n;
    }
    function won(n) {
      return Number(n || 0).toLocaleString("ko-KR") + "\uC6D0";
    }
    function copySale(value) {
      return { offerId: String(value?.offerId || ""), unitPrice: Number(value?.unitPrice) || 0 };
    }
    function validSale(value) {
      return value && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.offerId) && Number.isSafeInteger(value.unitPrice) && value.unitPrice > 0;
    }
    function saleBlocked(item) {
      return Boolean(item.blackFriday && (item.blackFridayUnavailable || !validSale(item.blackFriday) || item.stock !== null && item.q > item.stock));
    }
    var ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    function esc(t) {
      return String(t == null ? "" : t).replace(/[&<>"']/g, function(c) {
        return ENT[c];
      });
    }
    function safeUrl(u) {
      return /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
    }
    function photoUrl(value) {
      if (!value) return "";
      try {
        var url = new URL(value, "https://himawari.co.kr");
        return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
      } catch (error) {
        return "";
      }
    }
    function sku(item) {
      return JSON.stringify([item.id, item.optionId || ""]);
    }
    function selectedItems() {
      return cart.filter(function(item) {
        return !unselected.has(sku(item));
      });
    }
    function selectionSummary() {
      return orderBenefits(selectedItems().filter(function(item) {
        return !saleBlocked(item);
      }).map(function(item) {
        var offer = offerDisplay.get(sku(item));
        return { unitPrice: item.price, quantity: item.q, campaign: Boolean(item.blackFriday && offer && offer.offerId === item.blackFriday.offerId && offer.price === item.price), regularPrice: offer?.regularPrice };
      }));
    }
    function expireSaleDisplay() {
      if (!offerExpiresAt || Date.now() < offerExpiresAt) return false;
      offerExpiresAt = 0;
      offerDisplay.clear();
      cart.forEach(function(item) {
        if (item.blackFriday) {
          item.blackFridayUnavailable = true;
          item.stock = 0;
        }
      });
      return true;
    }
    function scheduleSaleExpiry() {
      if (saleExpiryTimer !== null) clearTimeout(saleExpiryTimer);
      saleExpiryTimer = null;
      if (!offerExpiresAt) return;
      saleExpiryTimer = setTimeout(function() {
        saleExpiryTimer = null;
        paint();
        if (offerExpiresAt) scheduleSaleExpiry();
      }, Math.min(Math.max(0, offerExpiresAt - Date.now()), 2147483647));
    }
    function priceMarkup(item, offer) {
      if (saleBlocked(item)) return "<small>\uD589\uC0AC \uC0C1\uD0DC\xB7\uC218\uB7C9\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.</small>";
      var regular = offer?.regularPrice;
      var discount = item.blackFriday && offer && offer.offerId === item.blackFriday.offerId && offer.price === item.price && Number.isSafeInteger(regular) && regular > item.price;
      var current = '<strong class="rdcart__current"><span class="sr-only">' + (item.blackFriday ? "\uD589\uC0AC\uAC00 " : "\uD310\uB9E4\uAC00 ") + "</span>" + won(item.price) + "</strong>";
      if (!discount) return '<div class="rdcart__prices">' + current + "</div>";
      var percent = Math.min(99, Math.round((regular - item.price) / regular * 100));
      return '<div class="rdcart__prices"><del class="rdcart__original"><span class="sr-only">\uC815\uC0C1\uAC00 </span>' + won(regular) + '</del><div class="rdcart__deal">' + current + '<span class="rdcart__discount">' + (percent ? percent + "%" : "1% \uBBF8\uB9CC") + " \uD560\uC778</span></div></div>";
    }
    function orderText() {
      var chosen = selectedItems();
      if (!chosen.length) return "";
      var t = 0, parts = [];
      for (var i2 = 0; i2 < chosen.length; i2++) {
        t += chosen[i2].q * chosen[i2].price;
        parts.push(chosen[i2].name + (chosen[i2].optionLabel ? " (" + chosen[i2].optionLabel + ")" : "") + " \xD7" + chosen[i2].q);
      }
      return parts.join(", ") + " (\uD569\uACC4 " + won(t) + ")";
    }
    var btn, badge, drawer, panel, bodyEl, totalEl, checkoutBtn, copyBtn, askBtn, closeBtn;
    var lastFocus = null;
    var inerted = [];
    function setPageInert(locked) {
      if (locked) {
        inerted = [];
        for (var i2 = 0; i2 < document.body.children.length; i2++) {
          var child = document.body.children[i2];
          if (child === drawer) continue;
          inerted.push({
            element: child,
            inert: typeof child.inert === "boolean" ? child.inert : false,
            ariaHidden: child.getAttribute("aria-hidden")
          });
          if ("inert" in child) child.inert = true;
          child.setAttribute("aria-hidden", "true");
        }
        return;
      }
      for (var j = 0; j < inerted.length; j++) {
        var record = inerted[j];
        if ("inert" in record.element) record.element.inert = record.inert;
        if (record.ariaHidden === null) record.element.removeAttribute("aria-hidden");
        else record.element.setAttribute("aria-hidden", record.ariaHidden);
      }
      inerted = [];
    }
    function buildButton() {
      var found = document.querySelector("[data-cart-button]");
      if (found) {
        btn = found;
        btn.classList.add("rdcart-btn");
      } else {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rdcart-btn rdcart-btn--float";
        btn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.2 10.6a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.47-1.16L20.5 8H5.6"/><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>';
        document.body.appendChild(btn);
      }
      if (!btn.getAttribute("type")) btn.setAttribute("type", "button");
      badge = btn.querySelector(".rdcart-btn__count");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "rdcart-btn__count";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "0";
        btn.appendChild(badge);
      }
      btn.addEventListener("click", function() {
        toggle();
      });
    }
    function buildDrawer() {
      drawer = document.createElement("div");
      drawer.className = "rdcart";
      drawer.setAttribute("aria-hidden", "true");
      drawer.inert = true;
      drawer.innerHTML = '<div class="rdcart__back" data-rdcart-close></div><div class="rdcart__panel" role="dialog" aria-modal="true" aria-label="' + esc(T.title) + '"><div class="rdcart__head"><h2 class="rdcart__title">' + esc(T.title) + '</h2><button class="rdcart__close" type="button" aria-label="\uC7A5\uBC14\uAD6C\uB2C8 \uB2EB\uAE30" data-rdcart-close>&times;</button></div><div class="rdcart__toolbar"><label class="rdcart__all"><input type="checkbox" data-rdcart-select-all>\uC804\uCCB4 \uC120\uD0DD <span class="rdcart__selected-count"></span></label><button type="button" data-rdcart-remove-selected>\uC120\uD0DD \uC0AD\uC81C</button></div><div class="rdcart__editor" hidden></div><p class="rdcart__status" role="status" aria-live="polite"></p><div class="rdcart__body"></div><div class="rdcart__foot"><div class="rdcart__benefits" hidden>\uC774\uBC88 \uC8FC\uBB38 \uD61C\uD0DD <b class="rdcart__savings"></b></div><div class="rdcart__costs"><span>\uC120\uD0DD \uC0C1\uD488\uAE08\uC561 <b class="rdcart__subtotal"></b></span><span>\uBC30\uC1A1\uBE44 <b class="rdcart__shipping"></b></span></div><div class="rdcart__sum"><span>\uD569\uACC4</span><b class="rdcart__total">0\uC6D0</b></div><div class="rdcart__shipping-state"><p></p><progress max="1" value="0" aria-label="\uBB34\uB8CC\uBC30\uC1A1 \uB2EC\uC131"></progress></div><p class="rdcart__lead">' + esc(T.note) + '</p><section class="rdcart__npay" data-npay-cart-section aria-label="\uB124\uC774\uBC84\uD398\uC774 \uC8FC\uBB38" hidden><div id="npay-cart-button" class="rdcart__npay-container" data-npay-cart></div><p class="rdcart__npay-status" data-npay-status role="status" aria-live="polite"></p></section><div class="rdcart__acts"><button class="rdcart__act rdcart__act--solid rdcart__checkout" type="button">\uC7A5\uBC14\uAD6C\uB2C8 \uC8FC\uBB38\uD558\uAE30 <span aria-hidden="true">\u2192</span></button><button class="rdcart__act rdcart__act--solid rdcart__copy" type="button" aria-live="polite">' + esc(T.copy) + '</button><button class="rdcart__act rdcart__act--ghost rdcart__ask" type="button">' + esc(T.ask) + "</button></div></div></div>";
      document.body.appendChild(drawer);
      panel = drawer.querySelector(".rdcart__panel");
      bodyEl = drawer.querySelector(".rdcart__body");
      bodyEl.addEventListener("error", function(event) {
        if (event.target.classList?.contains("rdcart__photo")) {
          event.target.hidden = true;
          event.target.parentElement.classList.add("is-missing");
        }
      }, true);
      totalEl = drawer.querySelector(".rdcart__total");
      checkoutBtn = drawer.querySelector(".rdcart__checkout");
      copyBtn = drawer.querySelector(".rdcart__copy");
      askBtn = drawer.querySelector(".rdcart__ask");
      closeBtn = drawer.querySelector(".rdcart__close");
      drawer.addEventListener("click", onDrawerClick);
      drawer.addEventListener("change", onDrawerChange);
      checkoutBtn.addEventListener("click", onCheckout);
      copyBtn.addEventListener("click", onCopy);
      askBtn.addEventListener("click", onInquiry);
    }
    function paint() {
      if (expireSaleDisplay()) save(false);
      var chosen = selectedItems(), summary = selectionSummary();
      var count = 0, total = 0, i2;
      for (i2 = 0; i2 < cart.length; i2++) {
        count += cart[i2].q;
        if (!saleBlocked(cart[i2])) total += cart[i2].q * cart[i2].price;
      }
      if (btn) {
        btn.classList.toggle("rdcart-btn--has", count > 0);
        if (badge) badge.textContent = count;
        btn.setAttribute("aria-label", T.title + ", " + count + "\uAC1C");
        btn.setAttribute("aria-expanded", drawer && drawer.classList.contains("rdcart--open") ? "true" : "false");
      }
      if (!drawer) return;
      totalEl.textContent = won(summary.total);
      drawer.querySelector(".rdcart__subtotal").textContent = won(summary.subtotal);
      drawer.querySelector(".rdcart__shipping").textContent = chosen.length ? summary.shippingFee ? won(summary.shippingFee) : "\uBB34\uB8CC" : "\u2014";
      drawer.querySelector(".rdcart__benefits").hidden = !summary.totalSavings;
      drawer.querySelector(".rdcart__savings").textContent = won(summary.totalSavings) + " \uD560\uC778";
      drawer.querySelector(".rdcart__shipping-state p").textContent = !chosen.length ? "\uC8FC\uBB38\uD560 \uC0C1\uD488\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694." : summary.remaining ? won(summary.remaining) + " \uB354 \uB2F4\uC73C\uBA74 \uBB34\uB8CC\uBC30\uC1A1" : "\uBB34\uB8CC\uBC30\uC1A1 \uC801\uC6A9";
      drawer.querySelector(".rdcart__shipping-state progress").value = summary.progress;
      var all = drawer.querySelector("[data-rdcart-select-all]");
      all.checked = Boolean(cart.length && chosen.length === cart.length);
      all.indeterminate = chosen.length > 0 && chosen.length < cart.length;
      all.disabled = !cart.length;
      drawer.querySelector(".rdcart__selected-count").textContent = chosen.length + "/" + cart.length;
      drawer.querySelector("[data-rdcart-remove-selected]").disabled = !chosen.length;
      drawer.classList.toggle("rdcart--empty", !cart.length);
      if (!cart.length) {
        bodyEl.innerHTML = '<p class="rdcart__empty">' + esc(T.empty).replace(/&lt;br\s*\/?&gt;/gi, "<br>") + "</p>";
      } else {
        var html = "";
        for (i2 = 0; i2 < cart.length; i2++) {
          var l = cart[i2];
          var display = productDisplay.get(l.id) || {};
          var offer = offerDisplay.get(sku(l));
          var image = photoUrl(offer?.image || display.image);
          var detail = l.blackFriday ? "/black-friday/item/" + encodeURIComponent(l.blackFriday.offerId) + "/" : l.id ? "/product.html?id=" + encodeURIComponent(l.id) : "";
          var go = detail ? '<a class="rdcart__go" href="' + esc(detail) + '">' + esc(T.go) + "</a>" : '<span class="rdcart__go rdcart__go--off">' + NOLINK + "</span>";
          html += '<div class="rdcart__line"><label class="rdcart__select"><input type="checkbox" data-rdcart-select="' + i2 + '" aria-label="' + esc(l.name) + ' \uC120\uD0DD"' + (unselected.has(sku(l)) ? "" : " checked") + "></label><" + (detail ? "a" : "span") + ' class="rdcart__thumb' + (image ? "" : " is-missing") + '"' + (detail ? ' href="' + esc(detail) + '" aria-label="' + esc(l.name) + ' \uC0C1\uC138 \uBCF4\uAE30"' : "") + ">" + (image ? '<img class="rdcart__photo" src="' + esc(image) + '" alt="" width="72" height="88" decoding="async">' : "") + '<span class="rdcart__placeholder" aria-hidden="true">\uC0AC\uC9C4 \uC900\uBE44 \uC911</span></' + (detail ? "a" : "span") + '><div class="rdcart__grow"><b>' + (detail ? '<a class="rdcart__name" href="' + esc(detail) + '">' + esc(l.name) + "</a>" : esc(l.name)) + "</b>" + (l.optionLabel ? "<em>" + esc(l.optionLabel) + "</em>" : "") + (l.blackFriday ? '<em class="rdcart__sale">\uBE14\uB799 \uD504\uB77C\uC774\uB370\uC774</em>' : "") + priceMarkup(l, offer) + go + '</div><div class="rdcart__controls"><button type="button" class="rdcart__option" data-rdcart-options="' + i2 + '"' + (optionBusy ? " disabled" : "") + '>\uC635\uC158 \uBCC0\uACBD</button><span class="rdcart__qty"><button type="button" data-rdcart-dec="' + i2 + '" aria-label="' + esc(l.name) + ' \uC218\uB7C9 \uC904\uC774\uAE30">&minus;</button><span>' + l.q + '</span><button type="button" data-rdcart-inc="' + i2 + '" aria-label="' + esc(l.name) + ' \uC218\uB7C9 \uB298\uB9AC\uAE30"' + (l.stock !== null && l.q >= l.stock ? " disabled" : "") + '>+</button></span></div><button type="button" class="rdcart__kill" data-rdcart-kill="' + i2 + '" aria-label="' + esc(l.name) + ' \uC0AD\uC81C">\uC0AD\uC81C</button></div>';
        }
        bodyEl.innerHTML = html;
      }
      askBtn.disabled = !chosen.length;
      copyBtn.disabled = !chosen.length;
      checkoutBtn.disabled = !chosen.length || chosen.some(saleBlocked) || optionBusy;
      drawer.querySelector(".rdcart__lead").textContent = chosen.some(saleBlocked) ? "\uD589\uC0AC\uAC00 \uC885\uB8CC\xB7\uBCC0\uACBD\uB418\uC5C8\uAC70\uB098 \uB0A8\uC740 \uC218\uB7C9\uBCF4\uB2E4 \uB9CE\uC774 \uB2F4\uAE34 \uC0C1\uD488\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uC218\uB7C9\uC744 \uC904\uC774\uAC70\uB098 \uD574\uB2F9 \uC0C1\uD488\uC744 \uB2E4\uC2DC \uB2F4\uC544 \uC8FC\uC138\uC694." : chosen.some(function(item) {
        return item.blackFriday;
      }) ? "\uD589\uC0AC \uC0C1\uD488 \uD3EC\uD568 \xB7 \uBB34\uD1B5\uC7A5\uC785\uAE08 \uB610\uB294 \uCE74\uCE74\uC624\uD398\uC774\uB85C \uC8FC\uBB38\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : T.note;
    }
    function add(name, price, url, id, optionId, optionLabel, stock, quantity, blackFriday) {
      name = String(name == null ? "" : name).trim();
      id = String(id == null ? "" : id).trim();
      optionId = String(optionId == null ? "" : optionId).trim();
      optionLabel = String(optionLabel == null ? "" : optionLabel).trim();
      stock = stock === "" || stock === null || stock === void 0 ? null : Math.max(0, num(stock));
      if (blackFriday != null && !validSale(blackFriday)) return false;
      if (!name || stock === 0) return false;
      quantity = Math.min(MAX_Q, stock === null ? MAX_Q : stock, Math.max(1, Math.floor(Number(quantity) || 1)));
      var hit = null;
      var added = false;
      for (var i2 = 0; i2 < cart.length; i2++) {
        if (id && cart[i2].id === id && cart[i2].optionId === optionId || !id && cart[i2].name === name) {
          hit = cart[i2];
          break;
        }
      }
      if (hit) {
        var selection = blackFriday || hit.blackFriday;
        var available = !blackFriday && hit.blackFriday ? hit.stock : stock;
        if (hit.q + quantity > MAX_Q || available !== null && hit.q + quantity > available) return false;
        hit.q += quantity;
        added = true;
        hit.stock = available;
        if (selection) {
          hit.blackFriday = copySale(selection);
          hit.price = selection.unitPrice;
        } else if (price) hit.price = num(price);
        if (blackFriday) delete hit.blackFridayUnavailable;
        if (id) hit.id = id;
        if (url) hit.url = url;
      } else {
        cart.push({
          id,
          name,
          price: blackFriday ? blackFriday.unitPrice : num(price),
          q: quantity,
          url: String(url || ""),
          optionId,
          optionLabel,
          stock,
          ...blackFriday ? { blackFriday: copySale(blackFriday) } : {}
        });
        added = true;
      }
      if (added) {
        save();
        paint();
        refreshProductInfo();
        refreshSaleItems();
      }
      return added;
    }
    function onDrawerChange(event) {
      var input = event.target, index = input.getAttribute("data-rdcart-select");
      if (index !== null && cart[+index]) {
        if (input.checked) unselected.delete(sku(cart[+index]));
        else unselected.add(sku(cart[+index]));
        save(false);
        paint();
      } else if (input.hasAttribute && input.hasAttribute("data-rdcart-select-all")) {
        cart.forEach(function(item) {
          if (input.checked) unselected.delete(sku(item));
          else unselected.add(sku(item));
        });
        save(false);
        paint();
      }
    }
    async function optionCatalog() {
      var controller = new AbortController();
      optionController = controller;
      var timer = setTimeout(function() {
        controller.abort(new Error("\uC635\uC158 \uD655\uC778\uC774 \uC9C0\uC5F0\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."));
      }, 15e3);
      var aborted = new Promise(function(_, reject) {
        controller.signal.addEventListener("abort", function() {
          reject(controller.signal.reason);
        }, { once: true });
      });
      try {
        var work = (async function() {
          var responses = await Promise.all([fetch("/api/products", { cache: "no-store", signal: controller.signal }), fetch("/api/black-friday", { cache: "no-store", signal: controller.signal })]);
          if (responses.some(function(response) {
            return !response.ok;
          })) throw new Error("\uC635\uC158 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
          return Promise.all(responses.map(function(response) {
            return response.json();
          }));
        })();
        var data = await Promise.race([work, aborted]);
        if (controller.signal.aborted) throw controller.signal.reason;
        (data[0].products || []).forEach(function(product) {
          productDisplay.set(product.id, product);
        });
        return { products: data[0].products || [], event: data[1] };
      } finally {
        clearTimeout(timer);
        if (optionController === controller) optionController = null;
      }
    }
    function cancelOptions(focus) {
      var key2 = editor?.key;
      ++optionSerial;
      optionController?.abort();
      optionController = null;
      optionBusy = false;
      editor = null;
      showEditor();
      drawer.querySelector(".rdcart__status").textContent = "";
      paint();
      var index = cart.findIndex(function(item) {
        return sku(item) === key2;
      });
      if (focus && index >= 0) drawer.querySelector('[data-rdcart-options="' + index + '"]')?.focus();
    }
    function showEditor(message) {
      var node = drawer.querySelector(".rdcart__editor");
      node.hidden = !editor;
      if (!editor) {
        node.innerHTML = "";
        return;
      }
      node.innerHTML = "<fieldset><legend>\uC0C9\uC0C1\xB7\uC635\uC158 \uBCC0\uACBD</legend><label>\uBCC0\uACBD\uD560 \uC635\uC158<select data-rdcart-choice" + (optionBusy ? " disabled" : "") + ">" + editor.choices.map(function(choice, index) {
        return '<option value="' + index + '" data-product-id="' + esc(choice.id) + '" data-option-id="' + esc(choice.optionId) + '"' + (choice.disabled ? " disabled" : "") + (sku(choice) === editor.key ? " selected" : "") + ">" + esc(choice.label + " \xB7 " + (choice.price ? won(choice.price) : "") + (choice.reason ? " \xB7 " + choice.reason : "")) + "</option>";
      }).join("") + "</select></label><p>" + esc(message || "\uB2F4\uC740 \uC218\uB7C9\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4. \uD589\uC0AC \uC0C1\uD488\uC740 \uD589\uC0AC \uB300\uC0C1 \uC635\uC158\uB9CC \uBCC0\uACBD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.") + '</p><div><button type="button" data-rdcart-apply-option' + (optionBusy ? " disabled" : "") + '>\uBCC0\uACBD \uC801\uC6A9</button><button type="button" data-rdcart-cancel-option>\uCDE8\uC18C</button></div></fieldset>';
    }
    async function openOptions(index) {
      if (optionBusy || !cart[index]) return;
      var key2 = sku(cart[index]), serial = ++optionSerial;
      optionBusy = true;
      drawer.querySelector(".rdcart__status").textContent = "\uCD5C\uC2E0 \uC635\uC158\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
      paint();
      try {
        var data = await optionCatalog(), item = cart.find(function(row) {
          return sku(row) === key2;
        });
        if (serial !== optionSerial || !item) return;
        editor = { key: key2, choices: variantChoices(item, data.products, data.event) };
        if (!editor.choices.length) throw new Error("\uBCC0\uACBD\uD560 \uC635\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC81C\uD488 \uC0C1\uC138\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        optionBusy = false;
        showEditor();
        drawer.querySelector("[data-rdcart-choice]").focus();
        drawer.querySelector(".rdcart__status").textContent = "";
      } catch (error) {
        if (serial === optionSerial) {
          editor = null;
          showEditor();
          drawer.querySelector(".rdcart__status").textContent = error.message;
        }
      } finally {
        if (serial === optionSerial) {
          optionBusy = false;
          paint();
        }
      }
    }
    async function applyOption() {
      if (!editor || optionBusy) return;
      var selection = editor.choices[Number(drawer.querySelector("[data-rdcart-choice]").value)], key2 = editor.key, serial = ++optionSerial;
      if (!selection) return;
      optionBusy = true;
      showEditor();
      paint();
      try {
        var data = await optionCatalog(), index = cart.findIndex(function(item) {
          return sku(item) === key2;
        });
        if (serial !== optionSerial) return;
        if (index < 0) throw new Error("\uBCC0\uACBD\uD560 \uC0C1\uD488\uC774 \uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4.");
        var fresh = variantChoices(cart[index], data.products, data.event).find(function(choice) {
          return sku(choice) === sku(selection);
        });
        if (!fresh || fresh.price !== selection.price || fresh.blackFriday?.offerId !== selection.blackFriday?.offerId) throw new Error("\uC635\uC158 \uAC00\uACA9\uC774\uB098 \uD589\uC0AC \uC870\uAC74\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC635\uC158\uC744 \uB2E4\uC2DC \uC5F4\uC5B4 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
        var wasSelected = !unselected.has(key2), targetExisted = cart.some(function(item, i2) {
          return i2 !== index && sku(item) === sku(fresh);
        });
        cart = replaceCartOption(cart, index, fresh, { isSelected: function(item) {
          return !unselected.has(sku(item));
        } });
        if (wasSelected) unselected.delete(sku(fresh));
        else if (!targetExisted) unselected.add(sku(fresh));
        editor = null;
        showEditor();
        save();
        drawer.querySelector(".rdcart__status").textContent = "\uC635\uC158\uC744 \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4.";
        refreshSaleItems();
      } catch (error) {
        if (serial === optionSerial) {
          showEditor(error.message);
          drawer.querySelector(".rdcart__status").textContent = error.message;
        }
      } finally {
        if (serial === optionSerial) {
          optionBusy = false;
          if (editor) showEditor(drawer.querySelector(".rdcart__status").textContent);
          paint();
        }
      }
    }
    function onDrawerClick(ev) {
      var t = ev.target;
      var hit = t.closest ? t.closest("[data-rdcart-inc],[data-rdcart-dec],[data-rdcart-kill],[data-rdcart-close],[data-rdcart-remove-selected],[data-rdcart-options],[data-rdcart-apply-option],[data-rdcart-cancel-option]") : null;
      if (!hit) return;
      if (hit.hasAttribute("data-rdcart-remove-selected")) {
        cancelOptions(false);
        cart = cart.filter(function(item) {
          return unselected.has(sku(item));
        });
        save();
        paint();
        return;
      }
      if (hit.hasAttribute("data-rdcart-options")) {
        openOptions(Number(hit.getAttribute("data-rdcart-options")));
        return;
      }
      if (hit.hasAttribute("data-rdcart-apply-option")) {
        applyOption();
        return;
      }
      if (hit.hasAttribute("data-rdcart-cancel-option")) {
        cancelOptions(true);
        return;
      }
      var d = hit.getAttribute("data-rdcart-inc");
      if (d !== null) {
        if (cart[+d] && cart[+d].q < MAX_Q && (cart[+d].stock === null || cart[+d].q < cart[+d].stock)) cart[+d].q++;
        save();
        paint();
        return;
      }
      d = hit.getAttribute("data-rdcart-dec");
      if (d !== null) {
        var l = cart[+d];
        if (l) {
          l.q--;
          if (l.q < 1) cart.splice(+d, 1);
        }
        save();
        paint();
        return;
      }
      d = hit.getAttribute("data-rdcart-kill");
      if (d !== null) {
        cart.splice(+d, 1);
        save();
        paint();
        return;
      }
      if (hit.hasAttribute("data-rdcart-close")) close();
    }
    function open() {
      if (!drawer || drawer.classList.contains("rdcart--open")) return;
      lastFocus = document.activeElement;
      drawer.inert = false;
      drawer.classList.add("rdcart--open");
      drawer.removeAttribute("aria-hidden");
      setPageInert(true);
      document.documentElement.classList.add("rdcart-locked");
      document.body.classList.add("rdcart-locked");
      if (btn) btn.setAttribute("aria-expanded", "true");
      try {
        closeBtn.focus();
      } catch (e) {
      }
      refreshProductInfo();
      refreshSaleItems();
    }
    function refreshProductInfo() {
      if (!cart.length || typeof fetch !== "function") return;
      if (productRequest) return productRequest;
      productRequest = (async function() {
        var response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) throw new Error("Product photos unavailable");
        var data = await response.json();
        (data.products || []).forEach(function(product) {
          productDisplay.set(product.id, product);
        });
        paint();
      })().catch(function() {
        productRequest = null;
      });
      return productRequest;
    }
    function refreshSaleItems() {
      if (!cart.some(function(item) {
        return item.blackFriday;
      }) || typeof fetch !== "function") return;
      if (saleRequest) return saleRequest;
      offerDisplay.clear();
      paint();
      saleRequest = (async function() {
        var response = await fetch("/api/black-friday", { cache: "no-store" });
        if (!response.ok) return;
        var event = await response.json();
        offerExpiresAt = event.state === "open" && Date.parse(event.endsAt) > Date.now() ? Date.parse(event.endsAt) : 0;
        scheduleSaleExpiry();
        cart.forEach(function(item) {
          if (!item.blackFriday) return;
          var sale = event.state === "open" && Date.parse(event.endsAt) > Date.now() && (event.items || []).find(function(offer) {
            return offer.offerId === item.blackFriday.offerId && offer.productId === item.id && offer.optionId === item.optionId && offer.price === item.blackFriday.unitPrice;
          });
          item.blackFridayUnavailable = !sale || sale.remaining < 1;
          item.stock = sale ? sale.remaining : 0;
          if (sale) {
            item.price = sale.price;
            offerDisplay.set(sku(item), sale);
          }
        });
        save(false);
        paint();
      })().catch(function() {
      }).finally(function() {
        saleRequest = null;
      });
      return saleRequest;
    }
    function close() {
      if (!drawer || !drawer.classList.contains("rdcart--open")) return;
      if (editor || optionBusy) cancelOptions(false);
      drawer.classList.remove("rdcart--open");
      drawer.setAttribute("aria-hidden", "true");
      drawer.inert = true;
      setPageInert(false);
      document.documentElement.classList.remove("rdcart-locked");
      document.body.classList.remove("rdcart-locked");
      if (btn) btn.setAttribute("aria-expanded", "false");
      try {
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      } catch (e) {
      }
    }
    function toggle() {
      drawer.classList.contains("rdcart--open") ? close() : open();
    }
    function onCopy() {
      var t = orderText();
      if (!t) return;
      var was = copyBtn.textContent;
      var done = function() {
        copyBtn.textContent = "\uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4";
        setTimeout(function() {
          copyBtn.textContent = was;
        }, 1400);
      };
      var fallback = function() {
        var ta = document.createElement("textarea");
        ta.value = t;
        ta.setAttribute("readonly", "readonly");
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e) {
          ok = false;
        }
        document.body.removeChild(ta);
        if (ok) done();
        else {
          copyBtn.textContent = "\uBCF5\uC0AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4";
          setTimeout(function() {
            copyBtn.textContent = was;
          }, 1800);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(done, fallback);
      } else {
        fallback();
      }
    }
    function onInquiry() {
      if (!selectedItems().length || askBtn.disabled) return;
      var payload = {
        version: 1,
        createdAt: Date.now(),
        text: orderText(),
        items: selectedItems().map(function(item) {
          return { name: item.name, price: item.price, q: item.q, url: safeUrl(item.url) };
        })
      };
      try {
        sessionStorage.setItem(INQUIRY_KEY, JSON.stringify(payload));
      } catch (e) {
      }
      askBtn.disabled = true;
      askBtn.setAttribute("aria-busy", "true");
      askBtn.textContent = "\uBB38\uC758\uC11C\uB85C \uC774\uB3D9 \uC911";
      window.location.assign("/contact.html?from=cart");
    }
    function onCheckout() {
      if (!selectedItems().length || checkoutBtn.disabled) return;
      try {
        sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify({
          version: 1,
          createdAt: Date.now(),
          items: selectedItems().filter(function(item) {
            return item.id;
          }).map(function(item) {
            return { productId: item.id, optionId: item.optionId || "", quantity: item.q, ...item.blackFriday ? { blackFriday: copySale(item.blackFriday) } : {} };
          })
        }));
      } catch (error) {
      }
      checkoutBtn.disabled = true;
      checkoutBtn.setAttribute("aria-busy", "true");
      checkoutBtn.textContent = "\uC8FC\uBB38\uC11C\uB85C \uC774\uB3D9 \uC911";
      window.location.assign("/checkout.html");
    }
    function init() {
      if (document.querySelector(".rdcart")) return;
      buildButton();
      buildDrawer();
      import("/assets/npay.js?v=20261113-managed-checkout").then(function(module) {
        return module.initializeNpay({ cartItems: cart.slice() });
      }).catch(function() {
      });
      document.addEventListener("click", function(ev) {
        var b = ev.target.closest ? ev.target.closest("[data-cart-add]") : null;
        if (!b) return;
        ev.preventDefault();
        if (b.dataset && b.dataset.rdcartBusy) return;
        var offerId = b.getAttribute("data-black-friday-offer-id");
        var added = add(b.getAttribute("data-name"), b.getAttribute("data-price"), b.getAttribute("data-url"), b.getAttribute("data-product-id"), b.getAttribute("data-option-id"), b.getAttribute("data-option-label"), b.getAttribute("data-stock"), b.getAttribute("data-quantity"), offerId ? { offerId, unitPrice: Number(b.getAttribute("data-price")) } : void 0);
        var was = b.textContent;
        var wasLabel = b.getAttribute("aria-label");
        b.dataset.rdcartBusy = "1";
        b.textContent = added ? "\uB2F4\uC558\uC2B5\uB2C8\uB2E4" : "\uCD5C\uB300 \uC218\uB7C9\uC785\uB2C8\uB2E4";
        b.setAttribute("aria-label", added ? b.getAttribute("data-name") + " \uB2F4\uC558\uC2B5\uB2C8\uB2E4" : b.getAttribute("data-name") + " \uCD5C\uB300 \uC218\uB7C9\uC785\uB2C8\uB2E4");
        b.classList.add("rdcart-added");
        if (added) {
          document.dispatchEvent(new CustomEvent("himawari:cart-added", { detail: { button: b, productId: b.getAttribute("data-product-id") || "" } }));
        }
        setTimeout(function() {
          b.textContent = was;
          if (wasLabel === null) b.removeAttribute("aria-label");
          else b.setAttribute("aria-label", wasLabel);
          b.classList.remove("rdcart-added");
          delete b.dataset.rdcartBusy;
        }, 1100);
      });
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" || e.key === "Esc") {
          close();
          return;
        }
        if (e.key !== "Tab" || !drawer.classList.contains("rdcart--open")) return;
        var f = panel.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])");
        var list = [];
        for (var i2 = 0; i2 < f.length; i2++) {
          if (f[i2].offsetWidth || f[i2].offsetHeight) list.push(f[i2]);
        }
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (list.indexOf(document.activeElement) === -1) {
          e.preventDefault();
          first.focus();
        }
      });
      window.addEventListener("storage", function(e) {
        if (e.key !== KEY) return;
        try {
          window.SiteCart.replace(JSON.parse(e.newValue) || [], false);
        } catch (err) {
          cart = [];
          paint();
        }
        announceCartChange();
        refreshSaleItems();
      });
      paint();
      refreshProductInfo();
      refreshSaleItems();
      document.dispatchEvent(new CustomEvent("himawari:cart-ready", { detail: { items: cart.slice() } }));
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    window.SiteCart = {
      add,
      open,
      close,
      items: function() {
        return cart.slice();
      },
      selectedItems,
      text: orderText,
      clear: function() {
        cart = [];
        save();
        paint();
      },
      replace: function(items, announce) {
        cart = (Array.isArray(items) ? items : []).map(function(item) {
          return {
            id: typeof item.id === "string" ? item.id : "",
            name: String(item.name || ""),
            price: num(item.price),
            q: Math.min(MAX_Q, Math.max(1, num(item.q) || 1)),
            url: String(item.url || ""),
            optionId: String(item.optionId || ""),
            optionLabel: String(item.optionLabel || ""),
            stock: item.stock === "" || item.stock === null || item.stock === void 0 ? null : Math.max(0, num(item.stock)),
            ...item.blackFriday != null ? { blackFriday: copySale(item.blackFriday) } : {},
            ...item.blackFridayUnavailable ? { blackFridayUnavailable: true } : {}
          };
        }).filter(function(item) {
          return item.name;
        });
        save(announce);
        paint();
        refreshProductInfo();
        refreshSaleItems();
      }
    };
  })();
})();
