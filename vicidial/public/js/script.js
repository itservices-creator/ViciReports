document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dashboard = document.getElementById('dashboard');
    const outboundDashboard = document.getElementById('outbound-dashboard');
    const modal = document.getElementById('details-modal');
    const closeBtn = document.querySelector('.close-btn');
    const mainTitle = document.getElementById('main-title');
    const navItems = document.querySelectorAll('.nav-item');
    const exportBtn = document.getElementById('export-btn');
    const copyBtn = document.getElementById('copy-btn');
    const statusFilter = document.getElementById('status-filter');
    const copyFeedback = document.getElementById('copy-feedback');

    // State
    let currentDialer = 'iraq';
    let lastJsonData = null;
    let lastRawData = null; // For outbound mode
    let currentModalData = []; 
    let globalStatusCounts = {};
    let globalTotal = 0;
    let networkData = {};

    const dialerConfigs = {
        iraq: {
            title: "Iraq Dialer Daily Report",
            networks: [
                { key: 'zain', title: 'Zain (96478, 96479)', prefixes: ['96478', '96479'], className: 'zain' },
                { key: 'korek', title: 'Korek (96475)', prefixes: ['96475'], className: 'korek' },
                { key: 'asia', title: 'Asia Cell (96477)', prefixes: ['96477'], className: 'asia' }
            ]
        },
        ksa: {
            title: "Saudi Dialer Daily Report",
            networks: [
                { key: 'ksa', title: 'Saudi Numbers (966)', prefixes: ['966'], className: 'ksa' }
            ]
        },
        outbound: {
            title: "Outbound Calling Report"
        }
    };

    const vicidialStatuses = {
        'SALE': 'Sale Made - تم البيع بنجاح',
        'NI': 'Not Interested - العميل غير مهتم',
        'CBHOLD': 'Call Back Hold - العميل طلب معاودة الاتصال',
        'CALLBK': 'Call Back - تمت جدولة معاودة الاتصال',
        'DROP': 'Dropped Call - المكالمة سقطت قبل رد العميل',
        'NA': 'No Answer - العميل لم يرد',
        'B': 'Busy - الخط مشغول',
        'A': 'Answering Machine - جهاز الرد الآلي / البريد الصوتي',
        'AA': 'Answering Machine Auto - رد آلي (تلقائي)',
        'AM': 'Answering Machine - جهاز الرد الآلي',
        'AL': 'Answering Machine Msg Played - تم تشغيل رسالة الرد الآلي',
        'DC': 'Disconnected Number - الرقم مفصول أو خارج الخدمة',
        'N': 'No Answer - لا يوجد رد',
        'DNC': 'Do Not Call - طلب العميل عدم الاتصال به مجدداً',
        'NEW': 'New Lead - رقم جديد لم يتم الاتصال به',
        'INCALL': 'Lead being called - يتم الاتصال بالعميل حالياً',
        'QUEUE': 'Lead in Queue - العميل على قائمة الانتظار',
        'XDROP': 'Agent Dropped - الوكيل أنهى المكالمة مبكراً',
        'PDROP': 'Pre-Routing Drop - المكالمة سقطت قبل التوجيه',
        'SVYEXT': 'Survey Sent to Extension - تم تحويل العميل للتقييم',
        'TIMEOT': 'Inbound Drop Timeout - انقضى وقت الانتظار',
        'AFTHRS': 'Inbound After Hours Drop - اتصال خارج أوقات العمل',
        'NANQUE': 'Inbound No Agent No Queue Drop - لا يوجد وكيل متاح للرد',
        'AB': 'Busy Auto - الخط مشغول (تم الكشف تلقائياً)',
        'ADC': 'Disconnected Number Auto - الرقم مفصول (تم الكشف تلقائياً)',
        'BADD': 'Bad Number - رقم خاطئ أو غير صالح',
        'DAIR': 'Dead Air - لا يوجد صوت بعد الرد (خط صامت)'
    };

    function getStatusClass(status) {
        const s = status.toUpperCase();
        if (s === 'SALE' || s === 'NEW') return 'status-success';
        if (s === 'CALLBK' || s === 'CBHOLD') return 'status-warning';
        if (s === 'AB' || s === 'NA' || s === 'DROP' || s === 'DAIR') return 'status-muted';
        return '';
    }

    // Navigation Click Listeners
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            if (!target || target === 'options') return;

            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            currentDialer = target;
            mainTitle.innerText = dialerConfigs[currentDialer].title;

            // Reset UI
            lastJsonData = null;
            lastRawData = null;
            dashboard.style.display = 'none';
            outboundDashboard.style.display = 'none';
            exportBtn.style.display = 'none';
            document.querySelector('.upload-section').style.display = 'block';
            document.getElementById('file-input').value = '';
        });
    });

    // Export Logic
    exportBtn.addEventListener('click', () => {
        // Export logic varies slightly depending on mode
        if (currentDialer === 'outbound') {
            alert("Export for Outbound Report is coming soon!");
            return;
        }

        if (!lastJsonData) return;
        const wb = XLSX.utils.book_new();
        
        const summaryData = [["Network", "Count", "Percentage"]];
        const config = dialerConfigs[currentDialer];
        
        config.networks.forEach(net => {
            const count = networkData[net.key].length;
            const pct = globalTotal > 0 ? ((count / globalTotal) * 100).toFixed(1) + '%' : '0%';
            summaryData.push([net.title, count, pct]);
        });
        summaryData.push(["Other Networks", networkData.other.length, globalTotal > 0 ? ((networkData.other.length / globalTotal) * 100).toFixed(1) + '%' : '0%']);
        summaryData.push([]);
        summaryData.push(["Status Code", "Count", "Percentage"]);
        
        const sortedStatuses = Object.entries(globalStatusCounts).sort((a, b) => b[1] - a[1]);
        sortedStatuses.forEach(([status, count]) => {
            const pct = globalTotal > 0 ? ((count / globalTotal) * 100).toFixed(1) + '%' : '0%';
            summaryData.push([status, count, pct]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        config.networks.forEach(net => {
            const wsData = XLSX.utils.json_to_sheet(networkData[net.key]);
            XLSX.utils.book_append_sheet(wb, wsData, net.title.split(' ')[0]);
        });
        const wsOther = XLSX.utils.json_to_sheet(networkData.other);
        XLSX.utils.book_append_sheet(wb, wsOther, "Other");

        XLSX.writeFile(wb, `${currentDialer.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    });

    // Modal Event Listeners
    closeBtn.onclick = function() { modal.style.display = "none"; }
    window.onclick = function(event) { if (event.target == modal) modal.style.display = "none"; }

    // Copy Logic in Modal
    copyBtn.addEventListener('click', () => {
        const filterVal = statusFilter.value;
        const dataToCopy = filterVal === 'ALL' 
            ? currentModalData 
            : currentModalData.filter(r => r.status === filterVal);
            
        const textToCopy = dataToCopy.map(r => r.phone).join('\n');
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyFeedback.style.opacity = '1';
            setTimeout(() => { copyFeedback.style.opacity = '0'; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });

    statusFilter.addEventListener('change', (e) => {
        renderModalTable(currentModalData, e.target.value);
    });

    // Drag and Drop Events
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            if (currentDialer === 'outbound') {
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, defval: ''});
                lastRawData = rawData;
                parseOutboundData(rawData);
            } else {
                lastJsonData = XLSX.utils.sheet_to_json(worksheet);
                analyzeData(lastJsonData);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- OUTBOUND REPORT LOGIC --- //
    function parseOutboundData(rawData) {
        let totalCalls = 0;
        let humanAnswered = 0;
        let dropCalls = 0;
        let dropPercent = '0%';
        let naCalls = 0;
        let naPercent = '0%';
        
        const agentData = [];
        const statusData = [];
        const hangupData = [];
        const listData = [];
        
        let parsingMode = null;

        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            
            const rowStr = row.map(cell => String(cell || '').trim()).join(' ').replace(/\s+/g, ' ');
            
            // Robust KPI extraction
            if (rowStr.includes('Total Calls placed from this Campaign:')) {
                const numbers = row.filter(cell => cell && !isNaN(parseInt(cell)) && !String(cell).includes('Total'));
                if (numbers.length > 0) totalCalls = numbers[0];
            }
            if (rowStr.includes('Total Human Answered calls for this Campaign:')) {
                const numbers = row.filter(cell => cell && !isNaN(parseInt(cell)) && !String(cell).includes('Total'));
                if (numbers.length > 0) humanAnswered = numbers[0];
            }
            if (rowStr.includes('Total Outbound DROP Calls:')) {
                const numbers = row.filter(cell => cell && (!isNaN(parseInt(cell)) || String(cell).includes('%')));
                if (numbers.length > 0) {
                    dropCalls = numbers[0];
                    // We'll let the next row override dropPercent if available, or fall back to this one
                    if (numbers.length >= 2) dropPercent = numbers[1];
                }
            }
            if (rowStr.includes('Percent of DROP Calls taken out of Answers:')) {
                const percentages = row.filter(cell => cell && String(cell).includes('%'));
                if (percentages.length > 0) {
                    dropPercent = percentages[0];
                }
            }
            if (rowStr.includes('Total NA calls -Busy,Disconnect,RingNoAnswer:')) {
                const numbers = row.filter(cell => cell && (!isNaN(parseInt(cell)) || String(cell).includes('%')));
                if (numbers.length >= 2) {
                    naCalls = numbers[0];
                    naPercent = numbers[1];
                } else if (numbers.length === 1) {
                    naCalls = numbers[0];
                }
            }
            
            // Identify non-empty columns to handle dynamic shifts (CSV vs Excel)
            const nonEmptyCols = row.filter(cell => String(cell).trim() !== '');
            if (nonEmptyCols.length === 0) continue;

            const firstCol = String(nonEmptyCols[0]).trim();
            const secondCol = nonEmptyCols[1] ? String(nonEmptyCols[1]).trim() : '';
            
            if (firstCol.includes('STATUS') && (secondCol.includes('DESC') || rowStr.includes('DESCRIPTION'))) {
                parsingMode = 'STATUS';
                continue;
            }
            if (firstCol.includes('AGENT') && (secondCol.includes('CALL') || rowStr.includes('CALLS'))) {
                parsingMode = 'AGENT';
                continue;
            }
            if ((firstCol.includes('HANGUP') || rowStr.includes('HANGUP REASON')) && rowStr.includes('CALLS')) {
                parsingMode = 'HANGUP';
                continue;
            }
            if ((firstCol === 'LIST' || firstCol.includes('LIST ID')) && rowStr.includes('CALLS')) {
                parsingMode = 'LIST';
                continue;
            }
            
            if (parsingMode) {
                // Stop parsing table if we hit TOTALs or unrelated headers
                if (firstCol === '' || firstCol.toUpperCase().startsWith('TOTAL') || firstCol === '#NAME?' || firstCol.startsWith('VDAD')) {
                    parsingMode = null;
                    continue;
                }
            }
            
            if (parsingMode === 'STATUS') {
                let callsIdx = -1;
                for (let j = 1; j < nonEmptyCols.length; j++) {
                    if (!isNaN(parseInt(nonEmptyCols[j]))) {
                        callsIdx = j;
                        break;
                    }
                }
                
                statusData.push({
                    status: firstCol,
                    desc: callsIdx > 1 ? nonEmptyCols.slice(1, callsIdx).join(' ') : 'Unknown',
                    calls: callsIdx !== -1 ? parseInt(nonEmptyCols[callsIdx]) : 0,
                    avgTime: (callsIdx !== -1 && nonEmptyCols[callsIdx + 2]) ? nonEmptyCols[callsIdx + 2] : '0:00:00'
                });
            }
            
            if (parsingMode === 'AGENT') {
                agentData.push({
                    agent: firstCol,
                    calls: parseInt(nonEmptyCols[1]) || 0,
                    time: nonEmptyCols[2] || '0:00:00',
                    avgTime: nonEmptyCols[3] || '0:00:00'
                });
            }

            if (parsingMode === 'HANGUP') {
                hangupData.push({
                    reason: firstCol,
                    calls: parseInt(nonEmptyCols[1]) || 0
                });
            }

            if (parsingMode === 'LIST') {
                listData.push({
                    list: firstCol,
                    calls: parseInt(nonEmptyCols[1]) || parseInt(nonEmptyCols[firstCol === nonEmptyCols[0] ? 1 : 2]) || 0
                });
            }
        }

        updateOutboundDashboard({ totalCalls, humanAnswered, dropCalls, dropPercent, naCalls, naPercent, agentData, statusData, hangupData, listData });
    }

    function updateOutboundDashboard(data) {
        document.querySelector('.upload-section').style.display = 'none';
        outboundDashboard.style.display = 'block';

        const answerRate = data.totalCalls > 0 ? ((data.humanAnswered / data.totalCalls) * 100).toFixed(2) + '%' : '0%';

        // Update KPIs
        document.getElementById('outbound-kpis').innerHTML = `
            <div class="stat-card" style="background: rgba(99,102,241,0.05); border-color: #6366f1;">
                <div class="stat-title" style="color: #818cf8;">Total Calls</div>
                <div class="stat-value">${data.totalCalls.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background: rgba(16,185,129,0.05); border-color: #10b981;">
                <div class="stat-title" style="color: #10b981;">Human Answered (Answer Rate)</div>
                <div class="stat-value">${data.humanAnswered.toLocaleString()} <span style="font-size: 1rem; color: #10b981;">(${answerRate})</span></div>
            </div>
            <div class="stat-card" style="background: rgba(245,158,11,0.05); border-color: #f59e0b;">
                <div class="stat-title" style="color: #f59e0b;">Drop Rate</div>
                <div class="stat-value">${data.dropCalls} <span style="font-size: 1rem; color: #94a3b8;">(${data.dropPercent})</span></div>
            </div>
            <div class="stat-card" style="background: rgba(239,68,68,0.05); border-color: #ef4444;">
                <div class="stat-title" style="color: #ef4444;">NA Rate</div>
                <div class="stat-value">${data.naCalls} <span style="font-size: 1rem; color: #94a3b8;">(${data.naPercent})</span></div>
            </div>
        `;

        // Update Agent Table
        const agentTbody = document.querySelector('#agent-stats-table tbody');
        agentTbody.innerHTML = '';
        data.agentData.sort((a,b) => b.calls - a.calls).forEach(agent => {
            agentTbody.innerHTML += `
                <tr>
                    <td><strong>${agent.agent}</strong></td>
                    <td>${agent.calls}</td>
                    <td>${agent.time}</td>
                    <td>${agent.avgTime}</td>
                </tr>
            `;
        });

        // Update Status Table
        const statusTbody = document.querySelector('#outbound-status-table tbody');
        statusTbody.innerHTML = '';
        data.statusData.sort((a,b) => b.calls - a.calls).forEach(stat => {
            const statusClass = getStatusClass(stat.status);
            const statusTooltip = vicidialStatuses[stat.status.toUpperCase()] || stat.desc || 'System Status';
            statusTbody.innerHTML += `
                <tr>
                    <td><span class="status-badge ${statusClass}" data-tooltip="${statusTooltip}">${stat.status}</span></td>
                    <td>${stat.calls}</td>
                    <td>${stat.avgTime}</td>
                </tr>
            `;
        });

        // Update Hangup Table
        const hangupTbody = document.querySelector('#hangup-table tbody');
        hangupTbody.innerHTML = '';
        data.hangupData.sort((a,b) => b.calls - a.calls).forEach(h => {
            hangupTbody.innerHTML += `
                <tr>
                    <td><strong>${h.reason}</strong></td>
                    <td>${h.calls}</td>
                </tr>
            `;
        });

        // Update List Table
        const listTbody = document.querySelector('#list-table tbody');
        listTbody.innerHTML = '';
        data.listData.sort((a,b) => b.calls - a.calls).forEach(l => {
            listTbody.innerHTML += `
                <tr>
                    <td><strong>${l.list}</strong></td>
                    <td>${l.calls}</td>
                </tr>
            `;
        });
    }

    // --- REGULAR DIALER LOGIC --- //
    function analyzeData(data) {
        networkData = { other: [] };
        const config = dialerConfigs[currentDialer];
        
        config.networks.forEach(net => { networkData[net.key] = []; });

        globalTotal = 0;
        globalStatusCounts = {};

        data.forEach(row => {
            let phone = null;
            let status = null;

            for (const key in row) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('phone') || lowerKey === 'phone_number') phone = String(row[key]).trim();
                if (lowerKey.includes('status') || lowerKey === 'statu') status = String(row[key]).trim();
            }

            if (phone) {
                globalTotal++;
                const record = { phone, status: status || 'UNKNOWN' };
                
                let matched = false;
                for (const net of config.networks) {
                    if (net.prefixes.some(prefix => phone.startsWith(prefix))) {
                        networkData[net.key].push(record);
                        matched = true;
                        break;
                    }
                }
                if (!matched) networkData.other.push(record);

                if (status) {
                    globalStatusCounts[status] = (globalStatusCounts[status] || 0) + 1;
                }
            }
        });

        updateDashboard();
    }

    function updateDashboard() {
        dashboard.style.display = 'block';
        exportBtn.style.display = 'flex';
        document.querySelector('.upload-section').style.display = 'none';
        document.getElementById('total-rows').innerText = `${globalTotal.toLocaleString()} Total Records`;

        const networkStats = document.getElementById('network-stats');
        const config = dialerConfigs[currentDialer];
        
        let htmlContent = '';
        config.networks.forEach(net => {
            htmlContent += createStatCard(net.title, networkData[net.key].length, globalTotal, net.key, net.title, net.className);
        });
        htmlContent += createStatCard('Other Networks', networkData.other.length, globalTotal, 'other', 'Other Networks', 'other');
        networkStats.innerHTML = htmlContent;

        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', function() {
                const network = this.getAttribute('data-network');
                const title = this.getAttribute('data-title');
                openModal(network, title);
            });
        });

        updateStatusTable();
    }

    function createStatCard(title, count, total, networkKey, dataTitle, className) {
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        return `
            <div class="stat-card ${className}" data-network="${networkKey}" data-title="${dataTitle}">
                <div class="stat-title">${title}</div>
                <div class="stat-value">${count.toLocaleString()}</div>
                <div class="stat-percentage">${percentage}%</div>
            </div>
        `;
    }

    function openModal(networkKey, title) {
        currentModalData = networkData[networkKey];
        document.getElementById('modal-title').innerText = `${title} Details (${currentModalData.length} records)`;
        
        const localStatusCounts = {};
        currentModalData.forEach(r => {
            localStatusCounts[r.status] = (localStatusCounts[r.status] || 0) + 1;
        });

        const modalStats = document.getElementById('modal-stats');
        modalStats.innerHTML = `
            <div class="modal-stat-box">
                <span class="stat-label">Total</span>
                <span class="stat-count">${currentModalData.length}</span>
            </div>
        `;
        
        const sortedLocalStatuses = Object.entries(localStatusCounts).sort((a, b) => b[1] - a[1]);
        
        sortedLocalStatuses.forEach(([s, count]) => {
            const statusClass = getStatusClass(s);
            const statusTooltip = vicidialStatuses[s.toUpperCase()] || 'System Status';
            modalStats.innerHTML += `
                <div class="modal-stat-box">
                    <span class="stat-label"><span class="status-badge ${statusClass}" data-tooltip="${statusTooltip}">${s}</span></span>
                    <span class="stat-count">${count}</span>
                </div>
            `;
        });

        statusFilter.innerHTML = '<option value="ALL">All Statuses</option>';
        sortedLocalStatuses.forEach(([s, count]) => {
            statusFilter.innerHTML += `<option value="${s}">${s} (${count})</option>`;
        });

        renderModalTable(currentModalData, 'ALL');
        modal.style.display = "block";
    }

    function renderModalTable(data, filterStatus) {
        const tbody = document.querySelector('#modal-table tbody');
        tbody.innerHTML = '';
        
        const filteredData = filterStatus === 'ALL' ? data : data.filter(r => r.status === filterStatus);

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No records found</td></tr>';
        } else {
            filteredData.forEach(record => {
                const statusClass = getStatusClass(record.status);
                const statusTooltip = vicidialStatuses[record.status.toUpperCase()] || 'System Status';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${record.phone}</td>
                    <td><span class="status-badge ${statusClass}" data-tooltip="${statusTooltip}">${record.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    function updateStatusTable() {
        const tbody = document.querySelector('#status-table tbody');
        tbody.innerHTML = '';
        const sortedStatuses = Object.entries(globalStatusCounts).sort((a, b) => b[1] - a[1]);

        sortedStatuses.forEach(([status, count]) => {
            const percentage = ((count / globalTotal) * 100).toFixed(1);
            const statusClass = getStatusClass(status);
            const statusTooltip = vicidialStatuses[status.toUpperCase()] || 'System Status';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="status-badge ${statusClass}" data-tooltip="${statusTooltip}">${status}</span></td>
                <td>${count.toLocaleString()}</td>
                <td>${percentage}%</td>
            `;
            tbody.appendChild(tr);
        });
    }
});
