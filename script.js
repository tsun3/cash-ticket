"use strict";

const CASH_DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
const STORAGE_KEY = "event-cash-ticket-counter-v1";
const MAX_SUGGESTIONS = 8;
const MAX_CASH_SUGGESTIONS = 3;
const MAX_CASH_MISCOUNT = 10;
const SEARCH_NODE_LIMIT = 250000;
const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 90;

const cashRows = document.getElementById("cash-rows");
const ticketRows = document.getElementById("ticket-rows");
const floatInput = document.getElementById("float-amount");
const cashTotalLabel = document.getElementById("cash-total-label");
const cashTotalElement = document.getElementById("cash-total");
const cashBreakdown = document.getElementById("cash-breakdown");
const cashGrossElement = document.getElementById("cash-gross");
const floatTotalElement = document.getElementById("float-total");
const ticketTotalElement = document.getElementById("ticket-total");
const resultCard = document.getElementById("result-card");
const resultIcon = document.getElementById("result-icon");
const resultMessage = document.getElementById("result-message");
const differenceElement = document.getElementById("difference");
const suggestionsCard = document.getElementById("suggestions-card");
const suggestionsLead = document.getElementById("suggestions-lead");
const ticketSuggestions = document.getElementById("ticket-suggestions");
const suggestionsList = document.getElementById("suggestions-list");
const cashSuggestions = document.getElementById("cash-suggestions");
const cashSuggestionsList = document.getElementById("cash-suggestions-list");
const suggestionsEmpty = document.getElementById("suggestions-empty");
const suggestionsCount = document.getElementById("suggestions-count");
const addTicketButton = document.getElementById("add-ticket-button");
const resetButton = document.getElementById("reset-button");
const resetSheet = document.getElementById("reset-sheet");
const resetCountsButton = document.getElementById("reset-counts-button");
const resetAllButton = document.getElementById("reset-all-button");
const resetCancelButton = document.getElementById("reset-cancel-button");
const updateBanner = document.getElementById("update-banner");
const updateButton = document.getElementById("update-button");

let tickets = [];
let nextTicketId = 1;
const formatYen = (value) => `${value < 0 ? "−" : ""}${Math.abs(Math.round(value)).toLocaleString("ja-JP")}円`;
const formatDenomination = (denomination) => `${denomination.toLocaleString("ja-JP")}円`;
const denominationName = (denomination) => `${formatDenomination(denomination)}${denomination >= 1000 ? "札" : "玉"}`;

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function newTicket(name = "", price = 0, count = 0) {
  return { id: `ticket-${nextTicketId++}`, name, price: safeNumber(price), count: safeNumber(count) };
}

// − [枚数] ＋ のステッパー。ボタンは data-target の入力欄を1ずつ増減する
function stepperHtml(targetId, label, inputHtml) {
  return `
    <div class="stepper">
      <button class="step-button" type="button" data-step="-1" data-target="${targetId}" aria-label="${label}を1枚減らす">−</button>
      <div class="count-wrap">${inputHtml}</div>
      <button class="step-button is-plus" type="button" data-step="1" data-target="${targetId}" aria-label="${label}を1枚増やす">＋</button>
    </div>`;
}

function createCashRows() {
  cashRows.innerHTML = CASH_DENOMINATIONS.map((denomination) => {
    const id = `cash-${denomination}`;
    const yen = formatDenomination(denomination);
    return `
    <div class="cash-row">
      <div class="cash-label">
        <label class="denomination" for="${id}">${yen}</label>
        <output id="cash-subtotal-${denomination}" class="subtotal is-zero" for="${id}">0円</output>
      </div>
      ${stepperHtml(id, yen, `<input id="${id}" data-cash="${denomination}" type="number" inputmode="numeric" min="0" step="1" placeholder="0" aria-label="${yen}の枚数">`)}
    </div>`;
  }).join("");
}

function renderTickets() {
  ticketRows.innerHTML = tickets.map((ticket, index) => {
    const countId = `${ticket.id}-count`;
    const priceId = `${ticket.id}-price`;
    return `
    <article class="ticket-row" data-ticket-row="${ticket.id}">
      <div class="ticket-title">
        <input id="${ticket.id}-name" class="ticket-name-input" data-ticket-id="${ticket.id}" data-kind="name" type="text" value="${escapeHtml(ticket.name)}" placeholder="券名（例：一般券）" aria-label="券種${index + 1}の券名">
        <output id="ticket-subtotal-${ticket.id}" class="ticket-subtotal">${formatYen(ticket.price * ticket.count)}</output>
        <button class="remove-ticket-button" data-remove-ticket="${ticket.id}" type="button" aria-label="${escapeHtml(ticket.name || `券種${index + 1}`)}を削除">×</button>
      </div>
      <div class="ticket-fields">
        <div class="ticket-field">
          <label class="field-label" for="${priceId}">単価</label>
          <div class="field-wrap yen"><input id="${priceId}" data-ticket-id="${ticket.id}" data-kind="price" type="number" inputmode="numeric" min="0" step="1" value="${ticket.price || ""}" placeholder="0" aria-label="券種${index + 1}の単価"></div>
        </div>
        <span class="times" aria-hidden="true">×</span>
        <div class="ticket-field">
          <label class="field-label" for="${countId}">販売枚数</label>
          ${stepperHtml(countId, `券種${index + 1}の販売枚数`, `<input id="${countId}" data-ticket-id="${ticket.id}" data-kind="count" type="number" inputmode="numeric" min="0" step="1" value="${ticket.count || ""}" placeholder="0" aria-label="券種${index + 1}の販売枚数">`)}
        </div>
      </div>
    </article>`;
  }).join("");
}

function getCashState() {
  const cash = {};
  CASH_DENOMINATIONS.forEach((denomination) => { cash[denomination] = safeNumber(document.getElementById(`cash-${denomination}`).value); });
  return cash;
}

const getFloatAmount = () => safeNumber(floatInput.value);

function saveState(cash = getCashState()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cash,
      float: getFloatAmount(),
      tickets: tickets.map(({ name, price, count }) => ({ name, price, count })),
    }));
  } catch (_) { /* 保存不可でも計算は継続 */ }
}

function restoreState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (state && typeof state === "object") {
      CASH_DENOMINATIONS.forEach((denomination) => {
        const value = safeNumber(state.cash?.[denomination]);
        document.getElementById(`cash-${denomination}`).value = value || "";
      });
      floatInput.value = safeNumber(state.float) || "";
      if (Array.isArray(state.tickets)) {
        tickets = state.tickets.map((ticket) => newTicket(String(ticket.name || ""), ticket.price, ticket.count));
      } else if (state.tickets && typeof state.tickets === "object") {
        tickets = Object.values(state.tickets).map((ticket, index) => newTicket(index === 0 ? "A当日券" : index === 1 ? "B当日券" : "", ticket.price, ticket.count));
      }
    }
  } catch (_) {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* 何もしない */ }
  }
  if (tickets.length === 0) tickets = [newTicket()];
}

function greatestCommonDivisor(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

// 差額 target を券の単価の組み合わせで表す候補を探す。
// limitToEntered が true（現金が不足＝券を多く入力した側）のときは、入力済みの枚数を超える候補を出さない。
function findDifferenceSolutions(target, sourceTickets, limitToEntered) {
  const usable = sourceTickets
    .filter((ticket) => ticket.price > 0 && (!limitToEntered || ticket.count > 0))
    .map((ticket) => ({ ...ticket, cap: limitToEntered ? ticket.count : Infinity }))
    .sort((a, b) => b.price - a.price);
  if (usable.length === 0) return [];
  const allGcd = usable.reduce((value, ticket) => greatestCommonDivisor(value, ticket.price), 0);
  if (target % allGcd !== 0) return [];

  const suffixGcd = new Array(usable.length);
  for (let index = usable.length - 1; index >= 0; index -= 1) {
    suffixGcd[index] = index === usable.length - 1 ? usable[index].price : greatestCommonDivisor(usable[index].price, suffixGcd[index + 1]);
  }

  const solutions = [];
  const counts = new Array(usable.length).fill(0);
  let visitedNodes = 0;
  function search(index, remaining) {
    if (visitedNodes++ >= SEARCH_NODE_LIMIT) return;
    if (index === usable.length - 1) {
      if (remaining % usable[index].price !== 0) return;
      const lastCount = remaining / usable[index].price;
      if (lastCount > usable[index].cap) return;
      counts[index] = lastCount;
      const items = usable.map((ticket, itemIndex) => ({ ticket, count: counts[itemIndex] })).filter((item) => item.count > 0);
      solutions.push({ items, totalCount: items.reduce((sum, item) => sum + item.count, 0), typeCount: items.length });
      counts[index] = 0;
      return;
    }
    const maxCount = Math.min(Math.floor(remaining / usable[index].price), usable[index].cap);
    for (let count = 0; count <= maxCount; count += 1) {
      const nextRemaining = remaining - count * usable[index].price;
      if (nextRemaining % suffixGcd[index + 1] !== 0) continue;
      counts[index] = count;
      search(index + 1, nextRemaining);
      if (visitedNodes >= SEARCH_NODE_LIMIT) break;
    }
    counts[index] = 0;
  }
  search(0, target);
  return solutions.sort((a, b) => a.totalCount - b.totalCount || a.typeCount - b.typeCount).slice(0, MAX_SUGGESTIONS);
}

// 1つの金種を数え間違えたと考えると差額に合う候補。
// 現金が多い（多く数えた）ときは、入力した枚数を超える候補は出さない。
function findCashCandidates(difference, cash) {
  const target = Math.abs(difference);
  return CASH_DENOMINATIONS
    .filter((denomination) => target % denomination === 0)
    .map((denomination) => ({ denomination, count: target / denomination }))
    .filter(({ denomination, count }) => count <= MAX_CASH_MISCOUNT && (difference < 0 || count <= cash[denomination]))
    .sort((a, b) => a.count - b.count || b.denomination - a.denomination)
    .slice(0, MAX_CASH_SUGGESTIONS);
}

function showSuggestions(difference, cash) {
  const target = Math.abs(difference);
  const ticketSolutions = findDifferenceSolutions(target, tickets, difference < 0);
  const cashCandidates = findCashCandidates(difference, cash);
  const ticketDirection = difference > 0 ? "少なく" : "多く";
  const cashDirection = difference > 0 ? "多く" : "少なく";
  const total = ticketSolutions.length + cashCandidates.length;

  suggestionsCard.hidden = false;
  suggestionsLead.textContent = `${formatYen(target)}の差額について、考えられる原因の候補です。`;
  suggestionsCount.textContent = total ? `${total}件表示` : "候補なし";

  ticketSuggestions.hidden = ticketSolutions.length === 0;
  suggestionsList.innerHTML = ticketSolutions.map((solution) => {
    const details = solution.items.map(({ ticket, count }) => `${escapeHtml(ticket.name.trim() || "名称未入力の券")}を${count.toLocaleString("ja-JP")}枚`).join("、");
    return `<li>${details}${ticketDirection}入力している可能性<span class="suggestion-meta">合計 ${solution.totalCount.toLocaleString("ja-JP")}枚・${solution.typeCount}券種</span></li>`;
  }).join("");

  cashSuggestions.hidden = cashCandidates.length === 0;
  cashSuggestionsList.innerHTML = cashCandidates.map(({ denomination, count }) => (
    `<li>${denominationName(denomination)}を${count.toLocaleString("ja-JP")}枚${cashDirection}数えている可能性<span class="suggestion-meta">${denominationName(denomination)}の枚数を数え直してください</span></li>`
  )).join("");

  suggestionsEmpty.hidden = total > 0;
  if (total === 0) {
    suggestionsEmpty.textContent = tickets.some((ticket) => ticket.price > 0)
      ? "この差額に合う候補は見つかりませんでした。単価・現金の枚数・釣り銭準備金を確認してください。"
      : "この差額に合う現金の数え間違いは見つかりませんでした。券種の単価を入力すると、当日券の入力ずれも探せます。";
  }
  return total;
}

function calculate({ shouldSave = true } = {}) {
  const cash = getCashState();
  let cashTotal = 0;
  CASH_DENOMINATIONS.forEach((denomination) => {
    const subtotal = denomination * cash[denomination];
    cashTotal += subtotal;
    const subtotalElement = document.getElementById(`cash-subtotal-${denomination}`);
    subtotalElement.textContent = formatYen(subtotal);
    subtotalElement.classList.toggle("is-zero", subtotal === 0);
  });

  const floatAmount = getFloatAmount();
  const salesCash = cashTotal - floatAmount;
  cashTotalLabel.textContent = floatAmount > 0 ? "売上現金" : "現金合計";
  cashTotalElement.textContent = formatYen(salesCash);
  cashBreakdown.hidden = floatAmount === 0;
  cashGrossElement.textContent = formatYen(cashTotal);
  floatTotalElement.textContent = formatYen(floatAmount);

  let ticketTotal = 0;
  tickets.forEach((ticket) => {
    const subtotal = ticket.price * ticket.count;
    ticketTotal += subtotal;
    document.getElementById(`ticket-subtotal-${ticket.id}`).textContent = formatYen(subtotal);
  });
  ticketTotalElement.textContent = formatYen(ticketTotal);

  const difference = salesCash - ticketTotal;
  const isMatch = difference === 0;
  differenceElement.textContent = formatYen(Math.abs(difference));
  const solutionCount = isMatch ? 0 : showSuggestions(difference, cash);
  resultCard.classList.toggle("is-match", isMatch);
  resultCard.classList.toggle("is-combination", !isMatch && solutionCount > 0);
  resultCard.classList.toggle("is-no-combination", !isMatch && solutionCount === 0);
  resultIcon.textContent = isMatch ? "✓" : "⚠";
  resultMessage.textContent = isMatch ? "金額が一致しています" : difference > 0 ? `現金が${formatYen(difference)}多い` : `現金が${formatYen(Math.abs(difference))}不足`;
  suggestionsCard.hidden = isMatch;
  if (shouldSave) saveState(cash);
}

function normalizeNumberInput(input) {
  if (input.value !== "" && safeNumber(input.value) !== Number(input.value)) input.value = safeNumber(input.value);
}

createCashRows();
restoreState();
renderTickets();
calculate({ shouldSave: false });

document.addEventListener("input", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.type === "number") normalizeNumberInput(input);
  if (input.dataset.ticketId) {
    const ticket = tickets.find((item) => item.id === input.dataset.ticketId);
    if (ticket) ticket[input.dataset.kind] = input.dataset.kind === "name" ? input.value : safeNumber(input.value);
  }
  calculate();
});

document.addEventListener("focusin", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "number") event.target.select();
});

/* ---- ＋／− ボタン（タップで1枚、長押しで連続） ---- */

function applyStep(button) {
  const input = document.getElementById(button.dataset.target);
  if (!input) return false;
  const current = safeNumber(input.value);
  const next = Math.max(0, current + Number(button.dataset.step));
  if (next === current) return false;
  input.value = next === 0 ? "" : String(next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

const stepButtonFrom = (target) => (target instanceof Element ? target.closest("[data-step]") : null);
let holdTimer = 0;
let repeatTimer = 0;
let suppressNextClick = false;

function stopHold() {
  window.clearTimeout(holdTimer);
  window.clearInterval(repeatTimer);
  holdTimer = 0;
  repeatTimer = 0;
}

document.addEventListener("pointerdown", (event) => {
  const button = stepButtonFrom(event.target);
  if (!button || (event.pointerType === "mouse" && event.button !== 0)) return;
  stopHold();
  suppressNextClick = false;
  holdTimer = window.setTimeout(() => {
    suppressNextClick = true;
    if (!applyStep(button)) return;
    repeatTimer = window.setInterval(() => { if (!applyStep(button)) stopHold(); }, HOLD_INTERVAL_MS);
  }, HOLD_DELAY_MS);
});
["pointerup", "pointercancel"].forEach((type) => document.addEventListener(type, stopHold));
document.addEventListener("pointerout", (event) => { if (stepButtonFrom(event.target)) stopHold(); });
document.addEventListener("contextmenu", (event) => { if (stepButtonFrom(event.target)) event.preventDefault(); });

// タップ（スクロールではなく指を離したとき）で1枚増減する。長押しで連続した直後のクリックは無視する
document.addEventListener("click", (event) => {
  const button = stepButtonFrom(event.target);
  if (!button) return;
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  applyStep(button);
});

addTicketButton.addEventListener("click", () => {
  const ticket = newTicket();
  tickets.push(ticket);
  renderTickets();
  calculate();
  document.querySelector(`[data-ticket-id="${ticket.id}"][data-kind="name"]`).focus();
});

ticketRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-ticket]");
  if (!button) return;
  tickets = tickets.filter((ticket) => ticket.id !== button.dataset.removeTicket);
  if (tickets.length === 0) tickets.push(newTicket());
  renderTickets();
  calculate();
});

/* ---- リセット（枚数だけ／すべて） ---- */

function openResetSheet() {
  resetSheet.hidden = false;
  resetCountsButton.focus();
}

function closeResetSheet() {
  resetSheet.hidden = true;
  resetButton.focus();
}

function clearCashCounts() {
  document.querySelectorAll("[data-cash]").forEach((input) => { input.value = ""; });
}

function resetCounts() {
  clearCashCounts();
  tickets.forEach((ticket) => { ticket.count = 0; });
  renderTickets();
  calculate();
}

function resetAll() {
  clearCashCounts();
  floatInput.value = "";
  tickets = [newTicket()];
  renderTickets();
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* 何もしない */ }
  calculate({ shouldSave: false });
}

function finishReset(reset) {
  reset();
  resetSheet.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  resetButton.focus({ preventScroll: true });
}

resetButton.addEventListener("click", openResetSheet);
resetCountsButton.addEventListener("click", () => finishReset(resetCounts));
resetAllButton.addEventListener("click", () => finishReset(resetAll));
resetCancelButton.addEventListener("click", closeResetSheet);
resetSheet.addEventListener("click", (event) => {
  if (event.target === resetSheet) closeResetSheet();
});
resetSheet.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeResetSheet();
    return;
  }
  if (event.key !== "Tab") return;
  const buttons = [...resetSheet.querySelectorAll("button")];
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

/* ---- オフライン対応と更新のお知らせ ---- */

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let waitingWorker = null;
  let updateRequested = false;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || (!hadController && !updateRequested)) return;
    reloading = true;
    window.location.reload();
  });

  function showUpdate(worker) {
    waitingWorker = worker;
    updateBanner.hidden = false;
    document.body.classList.add("has-update-banner");
  }

  updateButton.addEventListener("click", () => {
    if (!waitingWorker) return;
    updateRequested = true;
    updateButton.disabled = true;
    updateButton.textContent = "更新中…";
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // 切り替えの通知が届かない場合に備えて、少し待ってから再読み込みする
    window.setTimeout(() => window.location.reload(), 4000);
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      // ホーム画面から開き直したときにも新しいバージョンを確認する
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => { /* 圏外など */ });
      });
    } catch (_) { /* 未対応・失敗時も通常どおり動作 */ }
  });
}

setupServiceWorker();
