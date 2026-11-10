"use strict";

const CASH_DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
const STORAGE_KEY = "event-cash-ticket-counter-v1";
const MAX_SUGGESTIONS = 8;
const SEARCH_NODE_LIMIT = 250000;

const cashRows = document.getElementById("cash-rows");
const ticketRows = document.getElementById("ticket-rows");
const cashTotalElement = document.getElementById("cash-total");
const ticketTotalElement = document.getElementById("ticket-total");
const resultCard = document.getElementById("result-card");
const resultIcon = document.getElementById("result-icon");
const resultMessage = document.getElementById("result-message");
const differenceElement = document.getElementById("difference");
const suggestionsCard = document.getElementById("suggestions-card");
const suggestionsLead = document.getElementById("suggestions-lead");
const suggestionsList = document.getElementById("suggestions-list");
const suggestionsEmpty = document.getElementById("suggestions-empty");
const suggestionsCount = document.getElementById("suggestions-count");
const addTicketButton = document.getElementById("add-ticket-button");
const resetButton = document.getElementById("reset-button");

let tickets = [];
let nextTicketId = 1;
const formatYen = (value) => `${Math.round(value).toLocaleString("ja-JP")}円`;

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

function createCashRows() {
  cashRows.innerHTML = CASH_DENOMINATIONS.map((denomination) => `
    <div class="cash-row">
      <label class="denomination" for="cash-${denomination}">${denomination.toLocaleString("ja-JP")}円 <span class="multiplication">×</span></label>
      <div class="count-wrap"><input id="cash-${denomination}" data-cash="${denomination}" type="number" inputmode="numeric" min="0" step="1" placeholder="0" aria-label="${denomination.toLocaleString("ja-JP")}円の枚数"></div>
      <output id="cash-subtotal-${denomination}" class="subtotal">0円</output>
    </div>`).join("");
}

function renderTickets() {
  ticketRows.innerHTML = tickets.map((ticket, index) => `
    <article class="ticket-row" data-ticket-row="${ticket.id}">
      <div class="ticket-title">
        <input id="${ticket.id}-name" class="ticket-name-input" data-ticket-id="${ticket.id}" data-kind="name" type="text" value="${escapeHtml(ticket.name)}" placeholder="券名（例：一般券）" aria-label="券種${index + 1}の券名">
        <output id="ticket-subtotal-${ticket.id}" class="ticket-subtotal">${formatYen(ticket.price * ticket.count)}</output>
        <button class="remove-ticket-button" data-remove-ticket="${ticket.id}" type="button" aria-label="${escapeHtml(ticket.name || `券種${index + 1}`)}を削除">×</button>
      </div>
      <div class="ticket-fields">
        <label>単価<div class="field-wrap yen"><input id="${ticket.id}-price" data-ticket-id="${ticket.id}" data-kind="price" type="number" inputmode="numeric" min="0" step="1" value="${ticket.price || ""}" placeholder="0" aria-label="券種${index + 1}の単価"></div></label>
        <span class="times" aria-hidden="true">×</span>
        <label>販売枚数<div class="field-wrap count"><input id="${ticket.id}-count" data-ticket-id="${ticket.id}" data-kind="count" type="number" inputmode="numeric" min="0" step="1" value="${ticket.count || ""}" placeholder="0" aria-label="券種${index + 1}の販売枚数"></div></label>
      </div>
    </article>`).join("");
}

function getCashState() {
  const cash = {};
  CASH_DENOMINATIONS.forEach((denomination) => { cash[denomination] = safeNumber(document.getElementById(`cash-${denomination}`).value); });
  return cash;
}

function saveState(cash = getCashState()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cash, tickets: tickets.map(({ name, price, count }) => ({ name, price, count })) }));
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

function findDifferenceSolutions(target, sourceTickets) {
  const usable = sourceTickets.filter((ticket) => ticket.price > 0).map((ticket) => ({ ...ticket })).sort((a, b) => b.price - a.price);
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
      counts[index] = remaining / usable[index].price;
      const items = usable.map((ticket, itemIndex) => ({ ticket, count: counts[itemIndex] })).filter((item) => item.count > 0);
      solutions.push({ items, totalCount: items.reduce((sum, item) => sum + item.count, 0), typeCount: items.length });
      counts[index] = 0;
      return;
    }
    const maxCount = Math.floor(remaining / usable[index].price);
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

function showSuggestions(difference) {
  const target = Math.abs(difference);
  const solutions = findDifferenceSolutions(target, tickets);
  const direction = difference > 0 ? "少なく" : "多く";
  suggestionsCard.hidden = false;
  suggestionsLead.textContent = `${formatYen(target)}の差額を、登録された券種の組み合わせで確認した候補です。`;
  suggestionsList.innerHTML = "";
  suggestionsEmpty.hidden = solutions.length > 0;
  suggestionsCount.textContent = solutions.length ? `${solutions.length}件表示` : "候補なし";
  if (solutions.length === 0) {
    suggestionsEmpty.textContent = tickets.some((ticket) => ticket.price > 0) ? "この差額と一致する券の組み合わせは見つかりませんでした。単価や現金の枚数も確認してください。" : "候補を検索するには、券種の単価を入力してください。";
    return 0;
  }
  suggestionsList.innerHTML = solutions.map((solution) => {
    const details = solution.items.map(({ ticket, count }) => `${escapeHtml(ticket.name.trim() || "名称未入力の券")}を${count.toLocaleString("ja-JP")}枚`).join("、");
    return `<li>${details}${direction}入力している可能性<span class="suggestion-meta">合計 ${solution.totalCount.toLocaleString("ja-JP")}枚・${solution.typeCount}券種</span></li>`;
  }).join("");
  return solutions.length;
}

function calculate({ shouldSave = true } = {}) {
  const cash = getCashState();
  let cashTotal = 0;
  CASH_DENOMINATIONS.forEach((denomination) => {
    const subtotal = denomination * cash[denomination];
    cashTotal += subtotal;
    document.getElementById(`cash-subtotal-${denomination}`).textContent = formatYen(subtotal);
  });
  let ticketTotal = 0;
  tickets.forEach((ticket) => {
    const subtotal = ticket.price * ticket.count;
    ticketTotal += subtotal;
    document.getElementById(`ticket-subtotal-${ticket.id}`).textContent = formatYen(subtotal);
  });
  cashTotalElement.textContent = formatYen(cashTotal);
  ticketTotalElement.textContent = formatYen(ticketTotal);
  const difference = cashTotal - ticketTotal;
  const isMatch = difference === 0;
  differenceElement.textContent = formatYen(Math.abs(difference));
  const solutionCount = isMatch ? 0 : showSuggestions(difference);
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

resetButton.addEventListener("click", () => {
  if (!window.confirm("すべての入力内容をリセットしますか？")) return;
  document.querySelectorAll("[data-cash]").forEach((input) => { input.value = ""; });
  tickets = [newTicket()];
  renderTickets();
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* 何もしない */ }
  calculate({ shouldSave: false });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// オフラインでも開けるように、Service Worker でアプリ本体をキャッシュする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* 未対応・失敗時も通常どおり動作 */ });
  });
}
