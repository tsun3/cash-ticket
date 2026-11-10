"use strict";

const CASH_DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
const STORAGE_KEY = "event-cash-ticket-counter-v1";
const HANDLED_PRESETS_KEY = "event-cash-ticket-preset-handled-v1";
const LEGACY_PRESET_MEMORY_KEY = "event-cash-ticket-preset-v1";
const MAX_HANDLED_PRESETS = 20;
const PRESET_FORMAT = "1";
const MAX_PRESET_TICKETS = 30;
const MAX_TICKET_NAME_LENGTH = 40;
const MAX_AMOUNT = 100000000;
const MAX_SUGGESTIONS = 8;
const MAX_CASH_SUGGESTIONS = 3;
const MAX_CASH_MISCOUNT = 10;
const SEARCH_NODE_LIMIT = 250000;
const HOLD_DELAY_MS = 450;
const HOLD_INTERVAL_MS = 90;
const TOAST_MS = 3200;

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
const removeTicketSheet = document.getElementById("remove-ticket-sheet");
const removeTicketTitle = document.getElementById("remove-ticket-title");
const removeTicketPreview = document.getElementById("remove-ticket-preview");
const removeTicketConfirmButton = document.getElementById("remove-ticket-confirm-button");
const removeTicketCancelButton = document.getElementById("remove-ticket-cancel-button");
const resetButton = document.getElementById("reset-button");
const resetSheet = document.getElementById("reset-sheet");
const resetCountsButton = document.getElementById("reset-counts-button");
const resetAllButton = document.getElementById("reset-all-button");
const resetCancelButton = document.getElementById("reset-cancel-button");
const shareOpenButton = document.getElementById("share-open-button");
const importOpenButton = document.getElementById("import-open-button");
const shareSheet = document.getElementById("share-sheet");
const sharePreview = document.getElementById("share-preview");
const shareUrlElement = document.getElementById("share-url");
const shareStatus = document.getElementById("share-status");
const shareNativeButton = document.getElementById("share-native-button");
const shareCopyButton = document.getElementById("share-copy-button");
const shareCloseButton = document.getElementById("share-close-button");
const importSheet = document.getElementById("import-sheet");
const importForm = document.getElementById("import-form");
const importField = document.getElementById("import-url");
const importError = document.getElementById("import-error");
const importCancelButton = document.getElementById("import-cancel-button");
const presetSheet = document.getElementById("preset-sheet");
const presetPreview = document.getElementById("preset-preview");
const presetApplyButton = document.getElementById("preset-apply-button");
const presetKeepButton = document.getElementById("preset-keep-button");
const toast = document.getElementById("toast");
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

/* ---- 券種の削除（入力がある行は確認してから） ---- */

let pendingRemoveTicketId = null;
const ticketHasInput = (ticket) => Boolean(ticket.name.trim()) || ticket.price > 0 || ticket.count > 0;
const ticketLabel = (ticket) => ticket.name.trim() || `券種${tickets.indexOf(ticket) + 1}`;

function removeTicket(id) {
  tickets = tickets.filter((ticket) => ticket.id !== id);
  if (tickets.length === 0) tickets.push(newTicket());
  renderTickets();
  calculate();
}

ticketRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-ticket]");
  if (!button) return;
  const ticket = tickets.find((item) => item.id === button.dataset.removeTicket);
  if (!ticket) return;
  // 何も入力していない行は、確認せずにそのまま消す
  if (!ticketHasInput(ticket)) {
    removeTicket(ticket.id);
    return;
  }
  pendingRemoveTicketId = ticket.id;
  removeTicketTitle.textContent = `「${ticketLabel(ticket)}」を削除しますか？`;
  removeTicketPreview.innerHTML = [
    ["単価", formatYen(ticket.price), ""],
    ["販売枚数", `${ticket.count.toLocaleString("ja-JP")}枚`, ""],
    ["小計", formatYen(ticket.price * ticket.count), "is-total"],
  ].map(([label, value, className]) => `<li class="${className}"><span>${label}</span><span>${value}</span></li>`).join("");
  openSheet(removeTicketSheet, {
    focus: removeTicketCancelButton,
    onDismiss: () => { pendingRemoveTicketId = null; },
  });
});

removeTicketConfirmButton.addEventListener("click", () => {
  const ticket = tickets.find((item) => item.id === pendingRemoveTicketId);
  pendingRemoveTicketId = null;
  closeSheet({ dismissed: false, restoreFocus: false });
  if (!ticket) return;
  const label = ticketLabel(ticket);
  removeTicket(ticket.id);
  showToast(`「${label}」を削除しました`);
  addTicketButton.focus({ preventScroll: true });
});

removeTicketCancelButton.addEventListener("click", () => closeSheet());

/* ---- シート（リセット・共有・読み込み）の開閉 ---- */

let activeSheet = null;
let activeSheetOptions = {};
let sheetReturnFocus = null;

function openSheet(sheet, options = {}) {
  if (activeSheet) closeSheet({ restoreFocus: false });
  const focused = document.activeElement;
  sheetReturnFocus = focused instanceof HTMLElement && focused !== document.body ? focused : null;
  activeSheet = sheet;
  activeSheetOptions = options;
  sheet.hidden = false;
  const target = options.focus || sheet.querySelector("button:not([hidden])");
  if (target) target.focus({ preventScroll: true });
}

// dismissed: キャンセル・背景タップ・Esc で閉じたとき true
function closeSheet({ dismissed = true, restoreFocus = true } = {}) {
  if (!activeSheet) return;
  const { onDismiss } = activeSheetOptions;
  activeSheet.hidden = true;
  activeSheet = null;
  activeSheetOptions = {};
  if (dismissed && onDismiss) onDismiss();
  if (restoreFocus && sheetReturnFocus && document.contains(sheetReturnFocus)) sheetReturnFocus.focus({ preventScroll: true });
  sheetReturnFocus = null;
}

document.querySelectorAll(".sheet-scrim").forEach((scrim) => {
  scrim.addEventListener("click", (event) => {
    if (event.target === scrim) closeSheet();
  });
});

document.addEventListener("keydown", (event) => {
  if (!activeSheet) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...activeSheet.querySelectorAll("button, textarea, input")].filter((element) => !element.hidden && !element.disabled);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

let toastTimer = 0;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}

/* ---- リセット（枚数だけ／すべて） ---- */

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
  // 読み込み済みの共有設定の記録（中身の分からない短い識別子だけ）は残す。
  // 消すと、共有URL付きで起動するホーム画面のアプリで、リセット後に共有設定が戻ってきてしまう
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* 何もしない */ }
  calculate({ shouldSave: false });
}

function finishReset(reset) {
  closeSheet({ dismissed: false, restoreFocus: false });
  reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
  resetButton.focus({ preventScroll: true });
}

resetButton.addEventListener("click", () => openSheet(resetSheet, { focus: resetCountsButton }));
resetCountsButton.addEventListener("click", () => finishReset(resetCounts));
resetAllButton.addEventListener("click", () => finishReset(resetAll));
resetCancelButton.addEventListener("click", () => closeSheet());

/* ---- 設定の共有URL ----
   券種・単価・釣り銭準備金だけを URL の # 以降に入れる（# 以降はサーバーに送られない）。
   形式: #v=1&f=<準備金>&t=<単価>-<券名>&t=... */

function normalizeSettings({ tickets: list, float }) {
  return {
    tickets: list
      .map(({ name, price }) => ({ name: String(name).trim().slice(0, MAX_TICKET_NAME_LENGTH), price: Math.min(safeNumber(price), MAX_AMOUNT) }))
      .filter(({ name, price }) => name || price > 0)
      .slice(0, MAX_PRESET_TICKETS),
    float: Math.min(safeNumber(float), MAX_AMOUNT),
  };
}

const currentSettings = () => normalizeSettings({ tickets, float: getFloatAmount() });
const hasSettings = (settings) => settings.tickets.length > 0 || settings.float > 0;

function encodePreset(settings) {
  const params = new URLSearchParams();
  params.set("v", PRESET_FORMAT);
  if (settings.float > 0) params.set("f", String(settings.float));
  settings.tickets.forEach(({ name, price }) => params.append("t", `${price}-${name}`));
  return params.toString();
}

function decodePreset(raw) {
  const params = new URLSearchParams(raw);
  if (params.get("v") !== PRESET_FORMAT) return null;
  const entries = params.getAll("t").map((entry) => {
    const match = /^(\d{1,9})-([\s\S]*)$/.exec(entry);
    return match ? { name: match[2], price: Number(match[1]) } : null;
  });
  if (entries.some((entry) => entry === null)) return null;
  const settings = normalizeSettings({ tickets: entries, float: params.get("f") || 0 });
  return hasSettings(settings) ? settings : null;
}

function buildPresetUrl(settings) {
  const url = new URL(window.location.pathname, window.location.origin);
  // LINE で開いたときにアプリ内ブラウザではなく Safari などで開くための指定
  url.searchParams.set("openExternalBrowser", "1");
  url.hash = encodePreset(settings);
  return url.href;
}

function hasAnyInput() {
  const cash = getCashState();
  return getFloatAmount() > 0
    || CASH_DENOMINATIONS.some((denomination) => cash[denomination] > 0)
    || tickets.some((ticket) => ticket.name.trim() || ticket.price > 0 || ticket.count > 0);
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isLineInAppBrowser = () => /\bLine\//i.test(window.navigator.userAgent);
// 共有URLが開き直しのたびに付いてくる場面（ホーム画面のアプリ、URLを残す LINE の中のブラウザ）
const presetUrlMayPersist = () => isStandalone() || isLineInAppBrowser();

// 読み込み済みの共有設定は、中身の分からない短い識別子（FNV-1a）だけを記録する
function presetFingerprint(key) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function handledPresets() {
  try {
    const list = JSON.parse(localStorage.getItem(HANDLED_PRESETS_KEY));
    return Array.isArray(list) ? list.filter((item) => typeof item === "string") : [];
  } catch (_) {
    return [];
  }
}

function markPresetHandled(key) {
  const fingerprint = presetFingerprint(key);
  const list = handledPresets().filter((item) => item !== fingerprint);
  list.push(fingerprint);
  try { localStorage.setItem(HANDLED_PRESETS_KEY, JSON.stringify(list.slice(-MAX_HANDLED_PRESETS))); } catch (_) { /* 何もしない */ }
}

const wasPresetHandled = (key) => handledPresets().includes(presetFingerprint(key));

// 読み込んだら、アドレスバーを元のアプリのURLに戻す。
// こうしておくと「ホーム画面に追加」で共有設定に縛られないアイコンになり、再読み込みでも読み込み直さない。
// LINE の中のブラウザでは「Safariで開く」で設定を引き継げるように残す
function clearPresetFromAddressBar() {
  if (isLineInAppBrowser()) return;
  try { window.history.replaceState(window.history.state, "", window.location.pathname); } catch (_) { /* 何もしない */ }
}

function renderPresetPreview(list, settings) {
  const rows = settings.tickets.length
    ? settings.tickets.map(({ name, price }) => `<li><span>${escapeHtml(name || "名称未入力の券")}</span><span>${formatYen(price)}</span></li>`)
    : ["<li><span>券種</span><span>なし</span></li>"];
  rows.push(`<li class="is-float"><span>釣り銭準備金</span><span>${settings.float > 0 ? formatYen(settings.float) : "なし"}</span></li>`);
  list.innerHTML = rows.join("");
}

function appliedMessage(settings) {
  const parts = [`券種${settings.tickets.length}件`];
  if (settings.float > 0) parts.push(`準備金${formatYen(settings.float)}`);
  return `共有された設定を読み込みました（${parts.join("・")}）`;
}

function applyPreset(settings) {
  clearCashCounts();
  floatInput.value = settings.float > 0 ? String(settings.float) : "";
  tickets = settings.tickets.length ? settings.tickets.map(({ name, price }) => newTicket(name, price, 0)) : [newTicket()];
  renderTickets();
  calculate();
}

let pendingPreset = null;

function openPresetConfirm(settings) {
  pendingPreset = settings;
  renderPresetPreview(presetPreview, settings);
  openSheet(presetSheet, {
    focus: presetApplyButton,
    onDismiss: () => {
      markPresetHandled(encodePreset(settings));
      pendingPreset = null;
    },
  });
}

// fromLink: URL を開いたとき true、貼り付けて読み込んだとき false
function offerPreset(settings, { fromLink }) {
  const key = encodePreset(settings);
  // 起動のたびに同じ共有URLが付いてくる場面では、一度扱った設定で読み込みも確認も繰り返さない
  // （リセット後に共有設定が戻ってくる、といったことが起きないようにする）
  if (fromLink && presetUrlMayPersist() && wasPresetHandled(key)) return;
  if (key === encodePreset(currentSettings())) {
    markPresetHandled(key);
    if (!fromLink) showToast("すでにこの設定になっています");
    return;
  }
  if (!hasAnyInput()) {
    applyPreset(settings);
    markPresetHandled(key);
    showToast(appliedMessage(settings));
    return;
  }
  openPresetConfirm(settings);
}

function handlePresetFromLocation() {
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  clearPresetFromAddressBar();
  const settings = decodePreset(raw);
  if (settings) {
    offerPreset(settings, { fromLink: true });
  } else if (/(^|&)(v|t|f)=/.test(raw)) {
    showToast("共有リンクの設定を読み取れませんでした");
  }
}

presetApplyButton.addEventListener("click", () => {
  const settings = pendingPreset;
  if (!settings) return;
  pendingPreset = null;
  closeSheet({ dismissed: false, restoreFocus: false });
  applyPreset(settings);
  markPresetHandled(encodePreset(settings));
  showToast(appliedMessage(settings));
  window.scrollTo({ top: 0, behavior: "smooth" });
});
presetKeepButton.addEventListener("click", () => closeSheet());

shareOpenButton.addEventListener("click", () => {
  const settings = currentSettings();
  if (!hasSettings(settings)) {
    showToast("共有できる設定がありません。券種・単価か釣り銭準備金を入力してください。");
    return;
  }
  renderPresetPreview(sharePreview, settings);
  shareUrlElement.textContent = buildPresetUrl(settings);
  shareStatus.textContent = "";
  shareNativeButton.hidden = typeof navigator.share !== "function";
  openSheet(shareSheet, { focus: shareNativeButton.hidden ? shareCopyButton : shareNativeButton });
});

shareNativeButton.addEventListener("click", async () => {
  try {
    await navigator.share({
      title: "現金・当日券 集計の設定",
      text: "券種・単価・釣り銭準備金の設定です。開くと読み込まれます。",
      url: shareUrlElement.textContent,
    });
  } catch (error) {
    if (error && error.name === "AbortError") return;
    shareStatus.textContent = "共有できませんでした。「URLをコピー」から送ってください。";
  }
});

shareCopyButton.addEventListener("click", async () => {
  const url = shareUrlElement.textContent;
  const done = "URLをコピーしました。LINEなどに貼り付けて送ってください。";
  try {
    await navigator.clipboard.writeText(url);
    shareStatus.textContent = done;
  } catch (_) {
    const range = document.createRange();
    range.selectNodeContents(shareUrlElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
    shareStatus.textContent = copied ? done : "コピーできませんでした。URLを長押ししてコピーしてください。";
  }
});

shareCloseButton.addEventListener("click", () => closeSheet());

function extractPresetRaw(text) {
  const value = text.trim();
  const hashIndex = value.indexOf("#");
  if (hashIndex >= 0) return value.slice(hashIndex + 1);
  return /^v=/.test(value) ? value : "";
}

importField.placeholder = `${window.location.origin}${window.location.pathname}#v=1&…`;

importOpenButton.addEventListener("click", () => {
  importField.value = "";
  importError.hidden = true;
  openSheet(importSheet, { focus: importField });
});

importForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = extractPresetRaw(importField.value);
  const settings = raw ? decodePreset(raw) : null;
  if (!settings) {
    importError.textContent = importField.value.trim()
      ? "共有URLとして読み取れませんでした。受け取ったURLを最後までコピーして貼り付けてください。"
      : "共有URLを貼り付けてください。";
    importError.hidden = false;
    importField.focus();
    return;
  }
  closeSheet({ dismissed: false });
  offerPreset(settings, { fromLink: false });
});

importCancelButton.addEventListener("click", () => closeSheet());

// 以前の版が共有設定の中身をそのまま記録していたキーを消す
try { localStorage.removeItem(LEGACY_PRESET_MEMORY_KEY); } catch (_) { /* 何もしない */ }

window.addEventListener("hashchange", handlePresetFromLocation);
handlePresetFromLocation();

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
