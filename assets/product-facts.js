// A shared presentation of registered facts. No inferred capacity or device fit.
export function productPurchaseFacts(product) {
  const fields = [['weight', '무게'], ['dimensions', '외부 크기'], ['laptopCompartment', '노트북 수납칸']];
  return fields.filter(([key]) => String(product.specs?.[key] || '').trim())
    .map(([key, label]) => ({ key, label, value: String(product.specs[key]) }));
}
export function productEvidenceHighlights(product) {
  return [['material', '겉감·안감'], ['waterResistance', '생활방수'], ['laptopCompartment', '노트북 수납칸']]
    .filter(([key]) => String(product.specs?.[key] || '').trim())
    .map(([key, label]) => ({ label, value: String(product.specs[key]) }));
}
export function parseExternalDimensions(value) {
  const match = String(value || '').match(/^\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const dimensions = match.slice(1, 4).map(Number);
  return dimensions.every(n => n > 0 && n < 100) ? dimensions : null;
}
