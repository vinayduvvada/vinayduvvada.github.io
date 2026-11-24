// Cash Flow Kanban — static, client-side only. Bills live in localStorage.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var KEY = 'cash-flow-kanban-v1';
    var bills = [];
    var income = 0;
    var payday = '';

    function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
    function todayStr() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function daysUntil(dateStr) {
        if (!dateStr) return null;
        var a = new Date(todayStr() + 'T00:00:00');
        var b = new Date(dateStr + 'T00:00:00');
        return Math.round((b - a) / 86400000);
    }
    function addMonths(dateStr, n) {
        var d = new Date(dateStr + 'T00:00:00');
        d.setMonth(d.getMonth() + n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function fmtDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    // --- Duplicate fix ---
    // Marking a bill paid creates next month's copy (roll-forward). That copy
    // must be created once, and moving the paid bill back must remove it —
    // otherwise a drag to Paid, then back, leaves two copies of the same bill.
    function normName(n) { return (n || '').trim().toLowerCase(); }
    function nextDueDate(b) {
        if (b.recurs === 'monthly') return addMonths(b.due, 1);
        if (b.recurs === 'yearly') return addMonths(b.due, 12);
        if (b.recurs === 'weekly') { var d = new Date(b.due + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }
        return b.due;
    }
    function findRollForward(b) {
        var next = nextDueDate(b);
        return bills.find(function (x) {
            return x.id !== b.id && normName(x.name) === normName(b.name) && x.amount === b.amount && x.due === next && x.status !== 'paid';
        });
    }
    function dedupeBills() {
        var seen = {}, removed = 0;
        bills = bills.filter(function (b) {
            var key = normName(b.name) + '|' + b.amount + '|' + b.due + '|' + b.status;
            if (seen[key]) { removed += 1; return false; }
            seen[key] = true; return true;
        });
        return removed;
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify({ bills: bills, income: income, payday: payday })); } catch (e) {}
    }
    function load() {
        try {
            var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (raw) { bills = raw.bills || []; income = raw.income || 0; payday = raw.payday || ''; }
        } catch (e) { bills = []; }
        $('monthlyIncome').value = income || '';
        $('payday').value = payday || '';
    }

    // Effective status: paid stays paid; unpaid + due within 7 days = due, else upcoming
    function effectiveStatus(b) {
        if (b.status === 'paid') return 'paid';
        var d = daysUntil(b.due);
        if (d != null && d <= 7) return 'due';
        return 'upcoming';
    }

    function render() {
        var cols = { upcoming: $('colUpcoming'), due: $('colDue'), paid: $('colPaid') };
        var counts = { upcoming: 0, due: 0, paid: 0 };
        var sums = { upcoming: 0, due: 0, paid: 0 };
        Object.keys(cols).forEach(function (k) { cols[k].innerHTML = ''; });

        bills.slice().sort(function (a, b) { return (a.due || '').localeCompare(b.due || ''); }).forEach(function (b) {
            var st = effectiveStatus(b);
            counts[st] += 1;
            sums[st] += b.amount;
            var d = daysUntil(b.due);
            var overdue = st !== 'paid' && d != null && d < 0;
            var card = document.createElement('div');
            card.className = 'cf-card' + (overdue ? ' cf-card--overdue' : '');
            card.draggable = true;
            card.dataset.id = b.id;
            var dueLabel = overdue ? '<span class="overdue">Overdue by ' + Math.abs(d) + 'd</span>' :
                (d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : 'Due ' + fmtDate(b.due));
            card.innerHTML =
                '<div class="cf-card-top"><span class="cf-card-name"></span><span class="cf-card-amount">' + money(b.amount) + '</span></div>' +
                '<div class="cf-card-meta">' + dueLabel + ' &middot; ' + b.recurs + '</div>' +
                '<div class="cf-card-actions">' +
                (st !== 'paid' ? '<button type="button" class="cf-mini-btn" data-act="paid">Mark paid</button>' : '<button type="button" class="cf-mini-btn" data-act="unpaid">Move back</button>') +
                '<button type="button" class="cf-mini-btn cf-mini-btn--danger" data-act="delete">Delete</button>' +
                '</div>';
            card.querySelector('.cf-card-name').textContent = b.name;
            card.addEventListener('dragstart', function (e) {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', b.id);
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
            card.querySelectorAll('[data-act]').forEach(function (btn) {
                btn.addEventListener('click', function () { actOn(b.id, btn.getAttribute('data-act')); });
            });
            cols[st].appendChild(card);
        });

        Object.keys(cols).forEach(function (k) {
            if (!cols[k].children.length) cols[k].innerHTML = '<div class="cf-empty">No bills here yet.</div>';
        });
        $('countUpcoming').textContent = counts.upcoming;
        $('countDue').textContent = counts.due;
        $('countPaid').textContent = counts.paid;

        var upcomingTotal = sums.upcoming + sums.due;
        $('statUpcoming').textContent = money(upcomingTotal);
        $('statPaid').textContent = money(sums.paid);
        var left = (income || 0) - upcomingTotal;
        $('statLeft').textContent = money(left);
        $('statLeft').style.color = left < 0 ? 'var(--primary)' : '';
        var f = $('forecastText');
        if (income > 0 && payday) {
            var pd = daysUntil(payday);
            f.innerHTML = pd >= 0
                ? 'Next payday is in <strong>' + pd + ' day' + (pd === 1 ? '' : 's') + '</strong>. After upcoming bills, you would have <strong>' + money(left) + '</strong> left from this pay cycle.'
                : 'Payday has passed — update the next payday date to refresh the forecast.';
        } else if (income > 0) {
            f.textContent = 'Add your next payday date to see a forecast before payday.';
        } else {
            f.textContent = 'Add your monthly take-home pay above to see what is left after upcoming bills.';
        }
        save();
    }

    function actOn(id, act) {
        var b = bills.find(function (x) { return x.id === id; });
        if (!b) return;
        if (act === 'delete') {
            bills = bills.filter(function (x) { return x.id !== id; });
        } else if (act === 'paid') {
            if (b.status === 'paid') { render(); return; }
            b.status = 'paid';
            // Recurring bills roll forward: keep the paid record, add next cycle as upcoming.
            // Only once — if next month's copy already exists, don't create a second one.
            if (b.recurs !== 'once' && !findRollForward(b)) {
                bills.push({ id: uid(), name: b.name, amount: b.amount, due: nextDueDate(b), recurs: b.recurs, status: 'upcoming' });
            }
        } else if (act === 'unpaid') {
            // Moving a paid bill back undoes the roll-forward: remove next
            // month's copy if it is still unpaid, so the bill is a single move, not a copy.
            var roll = findRollForward(b);
            if (roll) bills = bills.filter(function (x) { return x.id !== roll.id; });
            b.status = 'upcoming';
        }
        render();
    }

    // Drag and drop between columns
    var lastDrop = { id: '', at: 0 };
    document.querySelectorAll('.cf-column').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', function () { col.classList.remove('drag-over'); });
        col.addEventListener('drop', function (e) {
            e.preventDefault(); col.classList.remove('drag-over');
            var id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            // Guard against the same drop firing twice for one drag.
            var now = Date.now();
            if (lastDrop.id === id && now - lastDrop.at < 1000) return;
            lastDrop = { id: id, at: now };
            var b = bills.find(function (x) { return x.id === id; });
            if (!b) return;
            var target = col.getAttribute('data-status');
            if (target === 'paid') actOn(id, 'paid');
            else if (b.status === 'paid') actOn(id, 'unpaid');
            else { b.status = 'upcoming'; render(); }
        });
    });

    $('addBillForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('billName').value.trim();
        var amount = parseFloat($('billAmount').value);
        var due = $('billDue').value;
        if (!name || !amount || amount <= 0 || !due) return;
        bills.push({ id: uid(), name: name, amount: amount, due: due, recurs: $('billRecurs').value, status: 'upcoming' });
        e.target.reset();
        $('billDue').value = todayStr();
        render();
    });
    // Try sample data — same one-click pattern as Subscription Leak Finder:
    // no confirm, dates relative to today so Due Soon / Upcoming / Paid all show.
    function loadSampleData() {
        function inDays(n) {
            var d = new Date(); d.setDate(d.getDate() + n);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
        bills = [
            { id: uid(), name: 'Mortgage', amount: 5996, due: inDays(2), recurs: 'monthly', status: 'upcoming' },
            { id: uid(), name: 'Electric', amount: 180, due: inDays(5), recurs: 'monthly', status: 'upcoming' },
            { id: uid(), name: 'Internet', amount: 80, due: inDays(12), recurs: 'monthly', status: 'upcoming' },
            { id: uid(), name: 'Car insurance', amount: 220, due: inDays(18), recurs: 'monthly', status: 'upcoming' },
            { id: uid(), name: 'Groceries', amount: 450, due: inDays(-1), recurs: 'monthly', status: 'paid' }
        ];
        income = 8000; payday = inDays(7);
        $('monthlyIncome').value = 8000;
        $('payday').value = payday;
        var info = $('sampleInfo');
        if (info) {
            info.textContent = 'Sample data loaded — income $8,000, upcoming bills $6,476, paid $450, $1,524 left. Clear all to start fresh.';
            info.hidden = false;
        }
        render();
    }
    // Primary button (new id), plus the old id for any cached / older copy.
    if ($('sampleBtn')) $('sampleBtn').addEventListener('click', loadSampleData);
    if ($('loadSampleBtn')) $('loadSampleBtn').addEventListener('click', loadSampleData);
    $('clearAllBtn').addEventListener('click', function () {
        if (!bills.length || confirm('Delete all bills?')) { bills = []; render(); }
    });
    if ($('dedupeBtn')) $('dedupeBtn').addEventListener('click', function () {
        var removed = dedupeBills();
        var info = $('sampleInfo');
        if (info) { info.textContent = removed ? ('Removed ' + removed + ' duplicate bill' + (removed === 1 ? '' : 's') + '.') : 'No duplicates found.'; info.hidden = false; }
        render();
    });
    $('monthlyIncome').addEventListener('change', function () { income = parseFloat(this.value) || 0; render(); });
    $('payday').addEventListener('change', function () { payday = this.value; render(); });

    if (!$('billDue').value) $('billDue').value = todayStr();
    load();
    render();
})();
