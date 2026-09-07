import { HttpError, bindPasswordToggle, fetchJson } from "./admin-client.js";
const initial = document.querySelector("[data-initial-view]"),
  login = document.querySelector("[data-login-view]"),
  board = document.querySelector("[data-board-view]"),
  form = document.querySelector("[data-login-form]"),
  password = document.querySelector("#admin-password"),
  status = document.querySelector("[data-board-status]"),
  list = document.querySelector("[data-review-list]"),
  restock = document.querySelector("[data-restock-list]"),
  filter = document.querySelector("[data-review-filter]");
function showLogin(message = "") {
  initial.hidden = true;
  board.hidden = true;
  login.hidden = false;
  document.querySelector("[data-login-status]").textContent = message;
  password.focus();
}
function showBoard() {
  initial.hidden = true;
  login.hidden = true;
  board.hidden = false;
}
function action(label, review, next) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "button button--quiet";
  control.textContent = label;
  control.addEventListener("click", async () => {
    control.disabled = true;
    try {
      const result = await fetchJson("/api/admin/reviews", {
        method: "PATCH",
        body: JSON.stringify({ id: review.id, status: next }),
      });
      status.textContent = result.message;
      await load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      control.disabled = false;
    }
  });
  return control;
}
function render(payload) {
  list.replaceChildren();
  (payload.reviews || []).forEach((review) => {
    const card = document.createElement("article");
    card.className = "review-admin-card";
    const heading = document.createElement("h3");
    heading.textContent = `${review.productId} · ${"★".repeat(review.rating)} · ${review.reviewerName}`;
    const meta = document.createElement("p");
    meta.className = "field-help";
    meta.textContent = `${review.status} · ${new Date(review.createdAt).toLocaleString("ko-KR")}`;
    const title = document.createElement("strong");
    title.textContent = review.title || "사용 후기";
    const copy = document.createElement("p");
    copy.textContent = review.content;
    card.append(heading, meta, title, copy);
    if (review.mediaUrl) {
      const link = document.createElement("a");
      link.href = review.mediaUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "첨부 사진 보기 ↗";
      card.append(link);
    }
    const actions = document.createElement("div");
    actions.className = "review-admin-actions";
    actions.append(
      action("공개", review, "published"),
      action("비공개", review, "rejected"),
    );
    card.append(actions);
    list.append(card);
  });
  if (!payload.reviews?.length)
    list.textContent = "해당 상태의 리뷰가 없습니다.";
  restock.replaceChildren();
  (payload.restock || []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "restock-admin-row";
    const name = document.createElement("span");
    name.textContent = `${item.productId}${item.optionId ? ` · ${item.optionId}` : ""}`;
    const count = document.createElement("strong");
    count.textContent = `${item.count}명`;
    row.append(name, count);
    restock.append(row);
  });
  if (!payload.restock?.length)
    restock.textContent = "대기 중인 재입고 신청이 없습니다.";
}
async function load() {
  try {
    const payload = await fetchJson(
      `/api/admin/reviews${filter.value ? `?status=${filter.value}` : ""}`,
    );
    showBoard();
    render(payload);
    status.textContent = "최신 정보를 불러왔습니다.";
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      return showLogin("관리자 로그인이 필요합니다.");
    showBoard();
    status.textContent = error.message;
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const loginStatus = document.querySelector("[data-login-status]");
  if (!password.value) {
    loginStatus.textContent = "관리자 비밀번호를 입력해 주세요.";
    password.focus();
    return;
  }
  try {
    await fetchJson("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ password: password.value }),
    });
    password.value = "";
    await load();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});
bindPasswordToggle(password, document.querySelector("[data-password-toggle]"));
document.querySelector("[data-logout]").addEventListener("click", async () => {
  await fetchJson("/api/admin/session", { method: "DELETE", body: "{}" });
  showLogin("로그아웃했습니다.");
});
document.querySelector("[data-refresh]").addEventListener("click", load);
filter.addEventListener("change", load);
load();
