// Smart Bill Splitter - enhanced (CSV import/export and settlement suggestions)

// LocalStorage keys
const LS_MEMBERS = 'bbs_members_v2';
const LS_EXPENSES = 'bbs_expenses_v2';

// DOM
const memberNameInput = document.getElementById('member-name');
const addMemberBtn = document.getElementById('add-member');
const membersList = document.getElementById('members-list');

const expenseDesc = document.getElementById('expense-desc');
const expenseAmount = document.getElementById('expense-amount');
const addExpenseBtn = document.getElementById('add-expense');
const expenseEqual = document.getElementById('expense-equal');
const splitGrid = document.getElementById('split-grid');
const expensesList = document.getElementById('expenses-list');
const summaryDiv = document.getElementById('summary');
const clearAllBtn = document.getElementById('clear-all');
const expensePayer = document.getElementById('expense-payer');
const calcSettlementBtn = document.getElementById('calc-settlement');
const settlementDiv = document.getElementById('settlement');

const exportMembersBtn = document.getElementById('export-members');
const importMembersInput = document.getElementById('import-members');
const exportExpensesBtn = document.getElementById('export-expenses');
const importExpensesInput = document.getElementById('import-expenses');

let members = []; // {id, name}
let expenses = []; // {id, desc, amount, payerId, split: { memberId: share }}

// Utilities
const uid = () => Math.random().toString(36).slice(2,9);
const money = n => Number(n).toFixed(2);

function save(){
  localStorage.setItem(LS_MEMBERS, JSON.stringify(members));
  localStorage.setItem(LS_EXPENSES, JSON.stringify(expenses));
}
function load(){
  members = JSON.parse(localStorage.getItem(LS_MEMBERS) || '[]');
  expenses = JSON.parse(localStorage.getItem(LS_EXPENSES) || '[]');
}

// Render
function renderMembers(){
  membersList.innerHTML = '';
  for(const m of members){
    const li = document.createElement('li');
    const span = document.createElement('div');
    span.innerHTML = `<div class="member-name">${escapeHtml(m.name)}</div><div class="small-muted">id: ${m.id}</div>`;

    const right = document.createElement('div');
    right.style.display = 'flex'; right.style.gap = '8px';
    const del = document.createElement('button'); del.className = 'delete'; del.textContent='Delete';
    del.onclick = ()=>{ if(confirm('Remove member? This will also remove them from expense splits.')){ removeMember(m.id); } };
    right.appendChild(del);

    li.appendChild(span); li.appendChild(right);
    membersList.appendChild(li);
  }
  renderPayerOptions();
  renderSplitGrid();
}

function renderPayerOptions(){
  expensePayer.innerHTML = '';
  if(members.length===0){ expensePayer.innerHTML = '<option value=\"\">-- add members --</option>'; return; }
  expensePayer.innerHTML = '<option value=\"\">(select payer)</option>';
  for(const m of members){
    const opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name;
    expensePayer.appendChild(opt);
  }
}

function renderSplitGrid(){
  splitGrid.innerHTML = '';
  if(members.length === 0){ splitGrid.innerHTML = '<div class="small-muted">Add members to enable individualized splits</div>'; return; }
  for(const m of members){
    const row = document.createElement('div'); row.className='split-row';
    const label = document.createElement('div'); label.textContent = m.name; label.style.width='110px';
    const input = document.createElement('input'); input.type='number'; input.min='0'; input.step='0.01'; input.placeholder='share amount (leave empty for auto)';
    input.dataset.memberId = m.id;
    row.appendChild(label); row.appendChild(input);
    splitGrid.appendChild(row);
  }
}

function renderExpenses(){
  expensesList.innerHTML = '';
  for(const e of expenses){
    const li = document.createElement('li');
    const left = document.createElement('div');
    const payer = members.find(x=>x.id===e.payerId);
    left.innerHTML = `<div style="font-weight:600">${escapeHtml(e.desc)}</div><div class="small-muted">Paid by: ${payer?escapeHtml(payer.name):'—'} • split among ${Object.keys(e.split).length} members</div>`;
    const right = document.createElement('div');
    right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';
    const amt = document.createElement('div'); amt.textContent = '₹'+money(e.amount);
    const del = document.createElement('button'); del.className='delete'; del.textContent='Remove';
    del.onclick = ()=>{ if(confirm('Remove this expense?')){ removeExpense(e.id); } };
    right.appendChild(amt); right.appendChild(del);
    li.appendChild(left); li.appendChild(right);
    expensesList.appendChild(li);
  }
}

function renderSummary(){
  // compute totals per member: paid - owed
  const totalsPaid = {}; const totalsOwed = {};
  for(const m of members){ totalsPaid[m.id]=0; totalsOwed[m.id]=0; }
  for(const e of expenses){
    const payerId = e.payerId;
    totalsPaid[payerId] = (totalsPaid[payerId]||0) + Number(e.amount);
    for(const [mid, share] of Object.entries(e.split)){
      if(!(mid in totalsOwed)) continue;
      totalsOwed[mid] += Number(share);
    }
  }
  const net = {};
  for(const m of members){
    net[m.id] = (totalsPaid[m.id]||0) - (totalsOwed[m.id]||0);
  }

  summaryDiv.innerHTML = '';
  if(members.length===0){ summaryDiv.innerHTML = '<div class="small-muted">Add members to see summary.</div>'; return; }

  for(const m of members){
    const row = document.createElement('div'); row.className='balance';
    const left = document.createElement('div'); left.innerHTML = `<div style="font-weight:600">${escapeHtml(m.name)}</div><div class="small-muted">${m.id}</div>`;
    const right = document.createElement('div'); right.innerHTML = `<div class="badge">₹${money(net[m.id]||0)}</div>`;
    row.appendChild(left); row.appendChild(right);
    summaryDiv.appendChild(row);
  }

  const totalSpent = expenses.reduce((s,e)=>s+Number(e.amount),0);
  const footer = document.createElement('div'); footer.style.marginTop='8px'; footer.className='small-muted';
  footer.innerHTML = `<strong>Total spent:</strong> ₹${money(totalSpent)} • Members: ${members.length}`;
  summaryDiv.appendChild(footer);
}

// Actions
function addMember(name){
  if(!name || !name.trim()) return alert('Enter a name');
  const m = { id: uid(), name: name.trim() };
  members.push(m);
  save(); renderAll();
}

function removeMember(id){
  members = members.filter(m=>m.id !== id);
  // remove from expense splits and if payer remove as payer (set payer to empty)
  for(const e of expenses){
    if(e.split[id]) delete e.split[id];
    if(e.payerId === id) e.payerId = '';
  }
  save(); renderAll();
}

function addExpense(desc, amount, splitIndividual){
  if(!desc || !desc.trim()) return alert('Enter description');
  let amt = Number(amount);
  if(isNaN(amt) || amt<=0) return alert('Enter a valid amount');
  const payer = expensePayer.value || '';
  const e = { id: uid(), desc: desc.trim(), amount: money(amt), payerId: payer, split: {} };

  if(members.length===0){
    // no members — expense remains unassigned
  } else if(splitIndividual){
    // attempt to read split inputs
    let provided = false; let totalProvided = 0;
    const entries = {};
    const inputs = splitGrid.querySelectorAll('input');
    inputs.forEach(inp=>{
      const mid = inp.dataset.memberId;
      const val = inp.value.trim();
      if(val!==''){
        const num = Number(val);
        if(!isNaN(num) && num>=0){ entries[mid]=money(num); totalProvided += num; provided = true; }
      }
    });
    if(provided){
      if(totalProvided === 0){
        const each = amt / members.length;
        members.forEach(m=> e.split[m.id] = money(each));
      } else {
        const scale = amt / totalProvided;
        for(const [mid, v] of Object.entries(entries)){
          e.split[mid] = money(Number(v) * scale);
        }
        for(const m of members) if(!e.split[m.id]) e.split[m.id] = money(0);
      }
    } else {
      const each = amt / members.length;
      members.forEach(m=> e.split[m.id] = money(each));
    }
  } else {
    const each = amt / members.length;
    members.forEach(m=> e.split[m.id] = money(each));
  }

  expenses.push(e);
  save(); renderAll();
}

function removeExpense(id){
  expenses = expenses.filter(x=>x.id!==id);
  save(); renderAll();
}

function clearAll(){
  if(!confirm('Clear all members and expenses?')) return;
  members = []; expenses = []; save(); renderAll();
}

function renderAll(){ renderMembers(); renderExpenses(); renderSummary(); renderSettlement([]); }

// Settlement algorithm (greedy)
function calcSettlement(){
  // Net balances (positive: should receive money; negative: owes money)
  const totalsPaid = {}; const totalsOwed = {};
  for(const m of members){ totalsPaid[m.id]=0; totalsOwed[m.id]=0; }
  for(const e of expenses){
    const payerId = e.payerId;
    totalsPaid[payerId] = (totalsPaid[payerId]||0) + Number(e.amount);
    for(const [mid, share] of Object.entries(e.split)){
      totalsOwed[mid] += Number(share);
    }
  }
  const net = [];
  for(const m of members){
    const val = (totalsPaid[m.id]||0) - (totalsOwed[m.id]||0);
    net.push({id:m.id, name:m.name, amt: Number(money(val))});
  }
  // Split into creditors and debtors
  let creditors = net.filter(n=>n.amt > 0).sort((a,b)=>b.amt - a.amt);
  let debtors = net.filter(n=>n.amt < 0).map(d=> ({...d, amt: -d.amt})).sort((a,b)=>b.amt - a.amt);

  const settlements = [];
  let i=0, j=0;
  while(i<debtors.length && j<creditors.length){
    const debtor = debtors[i];
    const creditor = creditors[j];
    const pay = Math.min(debtor.amt, creditor.amt);
    if(pay > 0){
      settlements.push({ from: debtor.name, to: creditor.name, amount: money(pay) });
      debtor.amt = +(debtor.amt - pay).toFixed(2);
      creditor.amt = +(creditor.amt - pay).toFixed(2);
    }
    if(debtor.amt <= 0.001) i++;
    if(creditor.amt <= 0.001) j++;
  }
  return settlements;
}

function renderSettlement(settlements){
  settlementDiv.innerHTML = '';
  if(settlements.length === 0){ settlementDiv.innerHTML = '<div class="small-muted">No settlements to show yet.</div>'; return; }
  const ul = document.createElement('ul'); ul.className='list';
  for(const s of settlements){
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${escapeHtml(s.from)}</strong> → <strong>${escapeHtml(s.to)}</strong></div><div class="badge">₹${s.amount}</div>`;
    ul.appendChild(li);
  }
  settlementDiv.appendChild(ul);
}

// CSV helpers
function arrayToCSV(rows){
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
}
function downloadBlob(filename, content, mime='text/csv'){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 100);
}

function exportMembersCSV(){
  const rows = [['id','name']];
  for(const m of members) rows.push([m.id, m.name]);
  downloadBlob('members.csv', arrayToCSV(rows));
}
function exportExpensesCSV(){
  // We'll output: id,desc,amount,payerId,split_json (split as JSON string)
  const rows = [['id','desc','amount','payerId','split_json']];
  for(const e of expenses) rows.push([e.id, e.desc, e.amount, e.payerId, JSON.stringify(e.split)]);
  downloadBlob('expenses.csv', arrayToCSV(rows));
}

function importMembersCSV(file){
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const objs = [];
    for(let i=1;i<lines.length;i++){
      const cols = parseCSVLine(lines[i]);
      if(cols.length>=2) objs.push({id: cols[0] || uid(), name: cols[1]});
    }
    if(objs.length>0){ members = members.concat(objs); save(); renderAll(); alert('Imported members: '+objs.length); }
  };
  reader.readAsText(file);
}

function importExpensesCSV(file){
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const objs = [];
    for(let i=1;i<lines.length;i++){
      const cols = parseCSVLine(lines[i]);
      if(cols.length>=5){
        let split = {};
        try{ split = JSON.parse(cols[4]); }catch(_){ split = {}; }
        objs.push({ id: cols[0] || uid(), desc: cols[1], amount: cols[2], payerId: cols[3], split });
      }
    }
    if(objs.length>0){ expenses = expenses.concat(objs); save(); renderAll(); alert('Imported expenses: '+objs.length); }
  };
  reader.readAsText(file);
}

// Simple CSV line parser for quoted values
function parseCSVLine(line){
  const res = [];
  let val = ''; let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"' ){
      if(inQuotes && line[i+1] === '"'){ val += '"'; i++; continue; }
      inQuotes = !inQuotes; continue;
    }
    if(ch === ',' && !inQuotes){ res.push(val); val=''; continue; }
    val += ch;
  }
  res.push(val);
  return res;
}

// helpers
function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// events
addMemberBtn.addEventListener('click', ()=>{ addMember(memberNameInput.value); memberNameInput.value=''; memberNameInput.focus(); });
memberNameInput.addEventListener('keyup', e=>{ if(e.key==='Enter') addMemberBtn.click(); });

addExpenseBtn.addEventListener('click', ()=>{
  const splitInd = !expenseEqual.checked;
  addExpense(expenseDesc.value, expenseAmount.value, splitInd);
  expenseDesc.value=''; expenseAmount.value=''; const inputs = splitGrid.querySelectorAll('input'); inputs.forEach(i=>i.value=''); expensePayer.value='';
});
expenseAmount.addEventListener('keyup', e=>{ if(e.key==='Enter') addExpenseBtn.click(); });

clearAllBtn.addEventListener('click', clearAll);
calcSettlementBtn.addEventListener('click', ()=>{ const s = calcSettlement(); renderSettlement(s); });

exportMembersBtn.addEventListener('click', exportMembersCSV);
exportExpensesBtn.addEventListener('click', exportExpensesCSV);

importMembersInput.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) importMembersCSV(f); ev.target.value=''; });
importExpensesInput.addEventListener('change', (ev)=>{ const f = ev.target.files && ev.target.files[0]; if(f) importExpensesCSV(f); ev.target.value=''; });

// init
load(); renderAll();

// Expose for debugging (optional)
window._bbs = { get members(){ return members; }, get expenses(){ return expenses; }, calcSettlement };