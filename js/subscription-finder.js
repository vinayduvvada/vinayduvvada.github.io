// Subscription Leak Finder — static, client-side only.
// Parses a statement CSV in the browser. Nothing is uploaded.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var results = []; // { name, count, lastAmount, firstAmount, monthly, lastDate, flags[], keep }

    function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function showError(msg) { var e = $('csvError'); e.textContent = msg; e.hidden = !msg; }

    // Minimal CSV parser: handles quoted fields with commas and escaped quotes.
    function parseCsv(text) {
        var rows = [], row = [], field = '', inQuotes = false;
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
                } else field += c;
            } else if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else field += c;
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }
        return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
    }

    function findCol(header, names) {
        var h = header.map(function (x) { return String(x).toLowerCase().trim(); });
        for (var i = 0; i < names.length; i++) {
            var idx = h.findIndex(function (x) { return x.indexOf(names[i]) !== -1; });
            if (idx !== -1) return idx;
        }
        return -1;
    }
    function parseAmount(s) {
        if (s == null) return NaN;
        var clean = String(s).replace(/[$,()\s]/g, '').replace(/^\-/, '');
        // (123.45) in statements usually means a charge; strip parens above already
        var n = parseFloat(clean);
        return isNaN(n) ? NaN : Math.abs(n);
    }
    function parseDate(s) {
        var d = new Date(String(s).trim());
        return isNaN(d.getTime()) ? null : d;
    }
    function fmtDate(d) {
        return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    }

    // Normalize merchant: upper-case, strip card/location codes, collapse spaces.
    function normalizeDesc(raw) {
        var s = String(raw || '').toUpperCase().trim();
        s = s.replace(/\b\d{4,}\b/g, '');                 // long numbers / card refs
        s = s.replace(/\b[A-Z]{2}\s*$/g, '');             // trailing state code
        s = s.replace(/[^A-Z0-9 &.'-]/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        // Keep first 3 words — most statements append store/location after that
        var words = s.split(' ').filter(Boolean);
        return words.slice(0, 3).join(' ') || 'UNKNOWN';
    }
    function displayName(key) {
        // Title-case the normalized key for display
        return key.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function analyze(rows) {
        if (rows.length < 2) throw new Error('No data rows found in this CSV.');
        var header = rows[0];
        var dateCol = findCol(header, ['date', 'posted', 'transaction date']);
        var descCol = findCol(header, ['description', 'merchant', 'name', 'payee']);
        var amtCol = findCol(header, ['amount', 'debit', 'charge', 'total']);
        if (descCol === -1 || amtCol === -1) throw new Error('Could not find Description and Amount columns. Check the CSV has a header row with Date, Description, Amount.');
        if (dateCol === -1) dateCol = 0;

        var groups = {};
        for (var i = 1; i < rows.length; i++) {
            var r = rows[i];
            var amt = parseAmount(r[amtCol]);
            if (isNaN(amt) || amt <= 0) continue;
            var key = normalizeDesc(r[descCol]);
            if (key === 'UNKNOWN') continue;
            var d = parseDate(r[dateCol]);
            if (!groups[key]) groups[key] = { amounts: [], dates: [] };
            groups[key].amounts.push(amt);
            if (d) groups[key].dates.push(d);
        }

        var out = [];
        Object.keys(groups).forEach(function (key) {
            var g = groups[key];
            if (g.amounts.length < 2) return; // recurring = at least twice
            g.amounts.sort(function (a, b) { return a - b; });
            g.dates.sort(function (a, b) { return a - b; });
            var last = g.amounts[g.amounts.length - 1];
            var first = g.amounts[0];
            // Monthly equivalent: median amount, assuming monthly cadence.
            // If charges are ~30 days apart it is monthly; if ~7 days, weekly (x4.33).
            var median = g.amounts[Math.floor(g.amounts.length / 2)];
            var monthly = median;
            if (g.dates.length >= 2) {
                var spanDays = (g.dates[g.dates.length - 1] - g.dates[0]) / 86400000;
                var avgGap = spanDays / (g.dates.length - 1);
                if (avgGap <= 10) monthly = median * 4.33;      // weekly
                else if (avgGap >= 300) monthly = median / 12;  // yearly
            }
            var flags = [];
            if (last > first * 1.05) flags.push('Price up ' + money(first) + ' → ' + money(last));
            else if (last < first * 0.95) flags.push('Price down');
            out.push({
                name: displayName(key), count: g.amounts.length,
                lastAmount: last, firstAmount: first, monthly: monthly,
                lastDate: g.dates.length ? g.dates[g.dates.length - 1] : null,
                flags: flags, keep: true
            });
        });

        // Duplicate / similar-name flags: same first word + similar amount
        for (var a = 0; a < out.length; a++) {
            for (var b = a + 1; b < out.length; b++) {
                var wa = out[a].name.split(' ')[0], wb = out[b].name.split(' ')[0];
                if (wa === wb && Math.abs(out[a].monthly - out[b].monthly) / Math.max(out[a].monthly, 1) < 0.3) {
                    if (out[a].flags.indexOf('Possible duplicate') === -1) out[a].flags.push('Possible duplicate');
                    if (out[b].flags.indexOf('Possible duplicate') === -1) out[b].flags.push('Possible duplicate');
                }
            }
        }
        out.sort(function (x, y) { return y.monthly - x.monthly; });
        return out;
    }

    function render() {
        var kept = results.filter(function (r) { return r.keep; });
        $('summaryCards').hidden = !results.length;
        $('resultsCard').hidden = !results.length;
        if (!results.length) return;
        var monthly = kept.reduce(function (s, r) { return s + r.monthly; }, 0);
        var flagged = kept.filter(function (r) { return r.flags.length; }).length;
        $('statCount').textContent = kept.length;
        $('statCountSub').textContent = results.length + ' recurring groups detected';
        $('statMonthly').textContent = money(monthly);
        $('statYearly').textContent = money(monthly * 12);
        $('statFlagged').textContent = flagged;
        $('resultsBody').innerHTML = kept.map(function (r, idx) {
            var flags = r.flags.length
                ? r.flags.map(function (f) { return '<span class="flag">' + f.replace(/</g, '&lt;') + '</span>'; }).join('')
                : '<span class="flag flag--ok">Steady</span>';
            return '<tr><td></td><td>' + r.count + '&times;</td><td>' + money(r.lastAmount) + '</td><td>' +
                money(r.monthly) + '</td><td>' + fmtDate(r.lastDate) + '</td><td>' + flags + '</td>' +
                '<td><button type="button" class="cf-mini-btn" data-idx="' + idx + '">Remove</button></td></tr>';
        }).join('');
        // Fill names safely (avoid HTML injection from CSV descriptions)
        kept.forEach(function (r, idx) {
            var cell = $('resultsBody').rows[idx].cells[0];
            cell.textContent = r.name;
        });
        $('resultsBody').querySelectorAll('[data-idx]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var keptIdx = parseInt(btn.getAttribute('data-idx'), 10);
                kept[keptIdx].keep = false;
                render();
            });
        });
    }

    function handleText(text, fileName) {
        try {
            showError('');
            var rows = parseCsv(text);
            results = analyze(rows);
            if (!results.length) throw new Error('No recurring charges found — need at least one merchant appearing twice.');
            $('fileInfo').textContent = fileName ? 'Loaded ' + fileName + ' — ' + (rows.length - 1) + ' transactions scanned.' : '';
            render();
        } catch (err) {
            results = [];
            render();
            showError(err.message || 'Could not read this CSV.');
        }
    }
    function handleFile(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () { handleText(String(reader.result), file.name); };
        reader.onerror = function () { showError('Could not read that file.'); };
        reader.readAsText(file);
    }

    $('csvFile').addEventListener('change', function () { handleFile(this.files[0]); });
    var dz = $('dropZone');
    ['dragover', 'dragenter'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag-over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag-over'); }); });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });

    $('sampleBtn').addEventListener('click', function () {
        var sample = [
            'Date,Description,Amount',
            '2026-09-01,NETFLIX.COM,15.49',
            '2026-09-03,SPOTIFY USA,11.99',
            '2026-09-05,AMAZON PRIME 1234,14.99',
            '2026-09-10,GROCERY STORE 4821,86.20',
            '2026-10-01,NETFLIX.COM,15.49',
            '2026-10-03,SPOTIFY USA,11.99',
            '2026-10-05,AMAZON PRIME 1234,14.99',
            '2026-10-15,GYM MEMBERSHIP,29.00',
            '2026-11-01,NETFLIX.COM,17.99',
            '2026-11-03,SPOTIFY USA,11.99',
            '2026-11-05,AMAZON PRIME 1234,14.99',
            '2026-11-15,GYM MEMBERSHIP,29.00',
            '2026-11-20,NETFLIX PREMIUM,17.99'
        ].join('\n');
        handleText(sample, 'sample.csv');
    });
    $('clearBtn').addEventListener('click', function () {
        results = []; $('fileInfo').textContent = ''; $('csvFile').value = ''; showError(''); render();
    });
    $('exportBtn').addEventListener('click', function () {
        if (!results.length) return;
        var lines = ['Merchant,Times,Last Amount,Monthly,Last Charged,Flags'];
        results.filter(function (r) { return r.keep; }).forEach(function (r) {
            lines.push(['"' + r.name.replace(/"/g, '""') + '"', r.count, r.lastAmount.toFixed(2), r.monthly.toFixed(2), r.lastDate ? r.lastDate.toISOString().slice(0, 10) : '', '"' + r.flags.join('; ') + '"'].join(','));
        });
        var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'recurring-charges.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('manualForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('subName').value.trim();
        var amount = parseFloat($('subAmount').value);
        if (!name || !amount || amount <= 0) return;
        var freq = $('subFreq').value;
        var monthly = freq === 'yearly' ? amount / 12 : freq === 'weekly' ? amount * 4.33 : amount;
        results.push({ name: name, count: 1, lastAmount: amount, firstAmount: amount, monthly: monthly, lastDate: $('subDate').value ? new Date($('subDate').value + 'T00:00:00') : null, flags: ['Manual'], keep: true });
        results.sort(function (a, b) { return b.monthly - a.monthly; });
        e.target.reset();
        render();
    });
})();
