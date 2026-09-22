const categoryWords = {
  commute: /출근|퇴근|직장|출장|오피스|업무|비즈니스/,
  school: /통학|등교|하교|학교|학생|학원|교재|책가방|대학생|캠퍼스/,
  travel: /여행|공항|기내|비행|캐리어|숙소|나들이|외출|산책|주말|피크닉/,
  care: /세탁|관리|보관|세척|청소|건조|오염|얼룩|수선|냄새|젖은|물기/,
};

export function filterStories(posts, { query = '', category = 'all' } = {}) {
  const terms = String(query).trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  return posts.filter(post => {
    const text = [post.title, post.summary, post.description, ...(post.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
    const matchesCategory = category === 'all' || categoryWords[category]?.test(text) || post.category === category;
    return matchesCategory && terms.every(term => text.includes(term));
  });
}
