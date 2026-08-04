const CATEGORIES = [
  { name: '餐飲', icon: '🍱', color: '#ef8b65' }, { name: '交通', icon: '🚆', color: '#3c9cda' },
  { name: '門票/娛樂', icon: '🎟️', color: '#a476d6' }, { name: '購物', icon: '🛍️', color: '#e279a1' },
  { name: '住宿', icon: '🏨', color: '#e6ae42' }, { name: '雜項', icon: '📦', color: '#58a88a' }
];
const FALLBACK_RATES = { JPY: .215, USD: 32.5, EUR: 35.2, KRW: .024, TWD: 1 };
const state = { members: ['小明', '小華', '小美'], expenses: [] };
const $ = id => document.getElementById(id);
const money = n => `NT$${Math.round(n || 0).toLocaleString('zh-TW')}`;
const today = new Date().toISOString().slice(0, 10);
$('date').value = today;

function totalSpent() { return state.expenses.reduce((a, e) => a + e.twdAmount, 0); }
function rateValue() { return Number($('exchangeRate').value) || 0; }
function calcPreview() { const total = (Number($('amount').value) || 0) * rateValue() * ($('cardFee').checked ? 1.015 : 1); $('estimatedTwd').textContent = money(total); }
function renderSelects() {
  $('category').innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
  $('payer').innerHTML = state.members.map(m => `<option>${m}</option>`).join('');
}
function renderRatios() {
  const current = [...document.querySelectorAll('.ratio input')].reduce((o, el) => ({ ...o, [el.dataset.member]: +el.value }), {});
  $('customRatios').innerHTML = state.members.map((m, i) => `<div class="ratio"><span>${m}</span><input data-member="${m}" type="range" min="0" max="100" value="${current[m] ?? Math.floor(100 / state.members.length) + (i === 0 ? 100 % state.members.length : 0)}"><b id="ratio-${i}">${current[m] ?? Math.floor(100 / state.members.length) + (i === 0 ? 100 % state.members.length : 0)}%</b></div>`).join('');
  document.querySelectorAll('.ratio input').forEach((el, i) => el.oninput = () => { $(`ratio-${i}`).textContent = `${el.value}%`; });
}
function renderMembers() {
  $('memberChips').innerHTML = state.members.map(m => `<span class="chip">${m}${state.members.length > 1 ? `<button aria-label="刪除 ${m}" data-member="${m}">×</button>` : ''}</span>`).join('');
  document.querySelectorAll('.chip button').forEach(b => b.onclick = () => { state.members = state.members.filter(m => m !== b.dataset.member); renderSelects(); renderMembers(); renderRatios(); renderAll(); });
}
function sharesFor(expense) {
  const shares = Object.fromEntries(state.members.map(m => [m, 0]));
  if (expense.splitMode === 'custom') state.members.forEach(m => shares[m] = Math.round(expense.twdAmount * (expense.customRatios[m] || 0) / 100));
  else {
    const base = Math.round(expense.twdAmount / state.members.length);
    state.members.forEach(m => shares[m] = base);
    shares[expense.payer] += Math.round(expense.twdAmount) - base * state.members.length;
  }
  // Custom ratios may introduce a rounding remainder; payer absorbs it to retain exact zero-sum balances.
  const remainder = Math.round(expense.twdAmount) - Object.values(shares).reduce((a, b) => a + b, 0);
  shares[expense.payer] = (shares[expense.payer] || 0) + remainder;
  return shares;
}
function balancesAndTransfers() {
  const balances = Object.fromEntries(state.members.map(m => [m, { paid: 0, share: 0, net: 0 }]));
  state.expenses.forEach(e => { if (!balances[e.payer]) return; balances[e.payer].paid += Math.round(e.twdAmount); const s = sharesFor(e); state.members.forEach(m => balances[m].share += s[m]); });
  state.members.forEach(m => balances[m].net = balances[m].paid - balances[m].share);
  const debtors = state.members.filter(m => balances[m].net < 0).map(m => ({ name: m, amount: -balances[m].net }));
  const creditors = state.members.filter(m => balances[m].net > 0).map(m => ({ name: m, amount: balances[m].net }));
  const transfers = []; let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) { const amount = Math.min(debtors[d].amount, creditors[c].amount); if (amount) transfers.push({ from: debtors[d].name, to: creditors[c].name, amount }); debtors[d].amount -= amount; creditors[c].amount -= amount; if (!debtors[d].amount) d++; if (!creditors[c].amount) c++; }
  return { balances, transfers };
}
function renderAll() {
  const total = totalSpent(), budget = Number($('budget').value) || 0, ratio = budget ? total / budget * 100 : 0;
  $('totalSpent').textContent = money(total); $('remainingBudget').textContent = money(budget - total); $('expenseCount').textContent = `${state.expenses.length} 筆`; $('ledgerCount').textContent = `${state.expenses.length} 筆`;
  $('budgetText').textContent = `已使用 ${money(total)} ／ ${money(budget)}`; $('budgetPercent').textContent = `${Math.round(ratio)}%`;
  const p = $('budgetProgress'); p.style.width = `${Math.min(ratio, 100)}%`; p.style.background = ratio > 100 ? '#ef6262' : ratio > 80 ? '#f4c244' : '#54e6ac'; $('overBudget').classList.toggle('hidden', ratio <= 100);
  $('expenseList').innerHTML = state.expenses.length ? state.expenses.slice().reverse().map(e => { const cat = CATEGORIES.find(c => c.name === e.category); return `<article class="expense"><span class="category-icon">${cat.icon}</span><div><h3>${escapeHtml(e.item)}</h3><p>${e.date} · ${e.category} · ${e.splitMode === 'equal' ? '全體均分' : '自訂比例'} · 付款人 ${e.payer}</p></div><div class="expense-amount"><span>${e.currency} ${e.originalAmount.toLocaleString()}</span><b>${money(e.twdAmount)}</b></div><button class="delete" data-id="${e.id}" aria-label="刪除">×</button></article>`; }).join('') : '<div class="empty">尚未加入消費紀錄<br/><small>從左側開始記錄這趟旅程吧！</small></div>';
  document.querySelectorAll('.delete').forEach(b => b.onclick = () => { state.expenses = state.expenses.filter(e => e.id !== b.dataset.id); renderAll(); });
  renderAnalytics(total); renderSettlement();
}
function renderAnalytics(total) {
  const data = CATEGORIES.map(c => ({ ...c, amount: state.expenses.filter(e => e.category === c.name).reduce((a, e) => a + e.twdAmount, 0) })).filter(x => x.amount > 0).sort((a,b) => b.amount-a.amount);
  $('donutTotal').textContent = money(total);
  let cursor = 0; $('donut').style.background = data.length ? `conic-gradient(${data.map(x => { const start = cursor, end = cursor + x.amount / total * 100; cursor = end; return `${x.color} ${start}% ${end}%`; }).join(',')})` : '#dce9e5';
  $('categoryStats').innerHTML = data.length ? data.map(x => { const pct = Math.round(x.amount / total * 1000) / 10; return `<div class="category-row"><div class="category-meta"><span>${x.icon} ${x.name}</span><span>${money(x.amount)} · ${pct}%</span></div><div class="bar"><i style="width:${pct}%;background:${x.color}"></i></div></div>`; }).join('') : '<span class="muted">尚無可分析的消費資料。</span>';
}
function renderSettlement() {
  const { balances, transfers } = balancesAndTransfers();
  $('balances').innerHTML = state.members.map(m => { const x = balances[m], positive = x.net >= 0; return `<div class="balance"><span><b>${m}</b> <small class="muted">代墊 ${money(x.paid)} · 應付 ${money(x.share)}</small></span><b class="${positive ? 'positive' : 'negative'}">${positive ? '應收 ' : '應付 '}${money(Math.abs(x.net))}</b></div>`; }).join('');
  $('transfers').innerHTML = transfers.length ? transfers.map(t => `<div class="transfer">${t.from} 應轉帳 <b>${money(t.amount)}</b> 給 ${t.to}</div>`).join('') : '<span class="muted">加入消費後，系統會自動計算最少轉帳筆數。</span>';
}
function escapeHtml(v) { const d = document.createElement('div'); d.textContent = v; return d.innerHTML; }
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
async function fetchRate() { const cur = $('currency').value; if (cur === 'TWD') { $('exchangeRate').value = 1; calcPreview(); return; } try { const res = await fetch(`https://api.frankfurter.app/latest?from=${cur}&to=TWD`); if (!res.ok) throw Error(); const data = await res.json(); if (!data.rates?.TWD) throw Error(); $('exchangeRate').value = data.rates.TWD; } catch { $('exchangeRate').value = FALLBACK_RATES[cur]; toast('已切換為離線預設匯率'); } calcPreview(); }

$('expenseForm').onsubmit = e => { e.preventDefault(); const ratios = Object.fromEntries([...document.querySelectorAll('.ratio input')].map(x => [x.dataset.member, Number(x.value)])); const mode = $('splitMode').value; if (mode === 'custom' && Object.values(ratios).reduce((a,b) => a+b,0) !== 100) return toast('自訂比例合計必須為 100%'); const amount = Number($('amount').value), rate = rateValue(); state.expenses.push({ id: crypto.randomUUID(), date: $('date').value, item: $('item').value.trim(), category: $('category').value, currency: $('currency').value, originalAmount: amount, exchangeRate: rate, hasCardFee: $('cardFee').checked, twdAmount: amount * rate * ($('cardFee').checked ? 1.015 : 1), payer: $('payer').value, splitMode: mode, customRatios: ratios }); $('item').value = ''; $('amount').value = ''; calcPreview(); renderAll(); toast('已加入一筆消費紀錄'); };
$('currency').onchange = fetchRate; ['amount','exchangeRate','cardFee'].forEach(id => $(id).oninput = calcPreview); $('budget').oninput = renderAll;
$('splitMode').onchange = () => $('customRatios').classList.toggle('hidden', $('splitMode').value !== 'custom');
$('addMember').onclick = () => { const name = prompt('請輸入成員名稱'); if (!name?.trim()) return; if (state.members.includes(name.trim())) return toast('此成員已存在'); state.members.push(name.trim()); renderSelects(); renderMembers(); renderRatios(); renderAll(); };
function fileDate() { return new Date().toISOString().slice(0,10).replaceAll('-',''); }
function safeName() { return $('tripName').value.trim().replace(/[\\/:*?"<>|]/g, '_') || '旅遊行程'; }
$('exportExcel').onclick = () => { if (!window.XLSX) return toast('Excel 元件載入失敗，請確認網路連線'); const wb = XLSX.utils.book_new(); const detail = [['日期','項目','類別','原幣','原幣金額','匯率','手續費','折合台幣','付款人','分帳模式'], ...state.expenses.map(e => [e.date,e.item,e.category,e.currency,e.originalAmount,e.exchangeRate,e.hasCardFee?'1.5%':'無',Math.round(e.twdAmount),e.payer,e.splitMode==='equal'?'全體均分':'自訂比例'])]; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), '帳目明細'); const { balances, transfers } = balancesAndTransfers(); const settlement = [['成員','總代墊','總應付','結算淨額'], ...state.members.map((m,i) => [m, balances[m].paid, balances[m].share, `=B${i+2}-C${i+2}`]), [], ['建議轉帳路徑'], ...transfers.map(t => [`${t.from} → ${t.to}`,t.amount])]; XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settlement), '結算總表'); const cats = [['類別名稱','總金額','佔比'], ...CATEGORIES.map((c,i) => [c.name, state.expenses.filter(e=>e.category===c.name).reduce((a,e)=>a+e.twdAmount,0), `=B${i+2}/$B$8`]), ['總計', `=SUM(B2:B7)`]]; const catSheet = XLSX.utils.aoa_to_sheet(cats); for(let r=1;r<=6;r++) catSheet[`C${r+1}`].z='0.0%'; XLSX.utils.book_append_sheet(wb, catSheet, '類別統計'); XLSX.writeFile(wb, `${safeName()}_結算單_${fileDate()}.xlsx`); };
$('exportPdf').onclick = () => { if (!window.html2pdf) return toast('PDF 元件載入失敗，請確認網路連線'); html2pdf().set({ margin: 8, filename: `${safeName()}_結算單_${fileDate()}.pdf`, image:{type:'jpeg',quality:.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'} }).from($('reportArea')).save(); };
renderSelects(); renderMembers(); renderRatios(); fetchRate(); renderAll();
