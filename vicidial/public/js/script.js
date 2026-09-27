document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dashboard = document.getElementById('dashboard');
    const outboundDashboard = document.getElementById('outbound-dashboard');
    const agentDashboard = document.getElementById('agent-dashboard');
    const agentSearch = document.getElementById('agent-search');
    const maqsamDashboard = document.getElementById('maqsam-dashboard');
    const maqsamAgentSearch = document.getElementById('maqsam-agent-search');
    const freepbxDashboard = document.getElementById('freepbx-dashboard');
    const freepbxDstSearch = document.getElementById('freepbx-dst-search');
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
    let lastAgentData = []; // For agent mode
    let lastFreepbxData = []; // For freepbx mode
    let lastFreepbxSrcData = []; // For freepbx SRC stats
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
        },
        agent: {
            title: "Agent Performance Report"
        },
        maqsam: {
            title: "Maqsam Report",
            networks: []
        },
        freepbx: {
            title: "FreePBX Report"
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
            lastAgentData = [];
            dashboard.style.display = 'none';
            outboundDashboard.style.display = 'none';
            if (agentDashboard) agentDashboard.style.display = 'none';
            if (maqsamDashboard) maqsamDashboard.style.display = 'none';
            if (freepbxDashboard) freepbxDashboard.style.display = 'none';
            exportBtn.style.display = 'none';
            document.querySelector('.upload-section').style.display = 'block';
            document.getElementById('file-input').value = '';
        });
    });

    // Export Logic
    exportBtn.addEventListener('click', () => {
        // Export logic varies slightly depending on mode
        if (currentDialer === 'outbound' || currentDialer === 'agent') {
            alert("Export for this report is coming soon!");
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
            } else if (currentDialer === 'agent') {
                const rawData = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, defval: ''});
                parseAgentData(rawData);
            } else if (currentDialer === 'maqsam') {
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false, defval: ''});
                parseMaqsamData(jsonData);
            } else if (currentDialer === 'freepbx') {
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {raw: false, defval: ''});
                parseFreepbxData(jsonData);
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

    // --- AGENT PERFORMANCE LOGIC --- //
    function parseAgentData(rawData) {
        let agentData = [];
        let isParsing = false;
        let headers = [];

        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            
            const rowStrArray = row.map(c => String(c || '').trim().toUpperCase());
            const firstCol = rowStrArray[0];
            
            // Find headers
            if ((firstCol === 'USER NAME' || firstCol === 'USER') && rowStrArray.includes('CALLS')) {
                headers = rowStrArray;
                isParsing = true;
                continue;
            }
            
            if (isParsing) {
                const rowStr = rowStrArray.join(' ');
                // Stop parsing if we hit the TOTALS row
                if (rowStr.includes('TOTALS') || firstCol === 'TOTALS') {
                    break;
                }
                
                // Skip completely empty rows
                if (rowStr.trim() === '') continue; 
                
                let agentObj = {};
                let hasData = false;
                row.forEach((cell, index) => {
                    if (headers[index]) {
                        agentObj[headers[index]] = cell;
                        if (cell !== undefined && cell !== null && cell !== '') hasData = true;
                    }
                });
                
                if (hasData && (agentObj['USER NAME'] || agentObj['USER'])) {
                    agentData.push(agentObj);
                }
            }
        }
        
        updateAgentDashboard(agentData);
    }

    function updateAgentDashboard(agentData) {
        lastAgentData = agentData;
        document.querySelector('.upload-section').style.display = 'none';
        agentDashboard.style.display = 'block';

        let totalCalls = 0;
        agentData.forEach(a => {
            totalCalls += parseInt(a['CALLS']) || 0;
        });

        // Update KPIs
        document.getElementById('agent-kpis').innerHTML = `
            <div class="stat-card" style="background: rgba(99,102,241,0.05); border-color: #6366f1;">
                <div class="stat-title" style="color: #818cf8;">Total Agents</div>
                <div class="stat-value">${agentData.length}</div>
            </div>
            <div class="stat-card" style="background: rgba(16,185,129,0.05); border-color: #10b981;">
                <div class="stat-title" style="color: #10b981;">Total Calls</div>
                <div class="stat-value">${totalCalls.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background: rgba(245,158,11,0.05); border-color: #f59e0b;">
                <div class="stat-title" style="color: #f59e0b;">Avg Calls / Agent</div>
                <div class="stat-value">${agentData.length > 0 ? (totalCalls / agentData.length).toFixed(1) : 0}</div>
            </div>
        `;

        renderAgentTable(agentData);
    }

    function renderAgentTable(data) {
        const tbody = document.querySelector('#agent-data-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(agent => {
            let cbCount = agent['CALLBK'] || agent['CALLBACK'] || agent['CBHOLD'] || agent['CALLBACKS'] || '0';
            let userName = agent['USER NAME'] || agent['USER'] || '-';
            let loginTime = agent['TIME'] || agent['LOGIN TIME'] || '0:00:00';
            let sales = agent['SALE'] || '0';
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${userName}</strong></td>
                    <td>${agent['ID'] || '-'}</td>
                    <td>${agent['CALLS'] || '0'}</td>
                    <td>${loginTime}</td>
                    <td>${agent['TALK'] || '0:00:00'}</td>
                    <td>${agent['WAIT'] || '0:00:00'}</td>
                    <td>${agent['PAUSE'] || '0:00:00'}</td>
                    <td>${cbCount}</td>
                    <td>${sales}</td>
                </tr>
            `;
        });
    }

    if (agentSearch) {
        agentSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = lastAgentData.filter(a => {
                const uName = String(a['USER NAME'] || a['USER'] || '').toLowerCase();
                const uId = String(a['ID'] || '').toLowerCase();
                return uName.includes(term) || uId.includes(term);
            });
            renderAgentTable(filtered);
        });
    }

    // --- MAQSAM REPORT LOGIC --- //
    let lastMaqsamAgentData = [];

    function parseDurationToMinutes(dur) {
        if (!dur) return 0;
        if (typeof dur === 'number') {
            if (dur > 0 && dur < 1) return dur * 1440; // Excel fractional day
            return dur / 60; // Assuming seconds
        }
        let str = String(dur).trim();
        if (str.includes(':')) {
            let parts = str.split(':').map(Number);
            if (parts.length === 3) return (parts[0] * 60) + parts[1] + (parts[2] / 60);
            if (parts.length === 2) return parts[0] + (parts[1] / 60);
        }
        let num = parseFloat(str);
        if (!isNaN(num)) {
            if (num > 0 && num < 1) return num * 1440;
            return num / 60;
        }
        return 0;
    }

    function parseMaqsamData(data) {
        const countryCounts = {};
        const agentStats = {};
        let totalCalls = 0;

        data.forEach(row => {
            let callee = row['Callee'] || row['callee'] || row['Contact'] || row['Number'] || '';
            let caller = row['Caller'] || row['caller'] || row['Source'] || '';
            let agent = row['Agent'] || row['agent'] || row['User'] || 'Unknown';
            let state = row['State'] || row['Call State'] || row['Status'] || row['status'] || row['Call Status'] || '';
            let duration = row['Handling Duration'] || row['Handling'] || row['Duration'] || row['duration'] || row['Talk Time'] || row['Call Duration'] || 0;
            
            if (!callee && !row['Agent']) return;

            totalCalls++;
            const country = window.getCountryByPrefix ? window.getCountryByPrefix(callee) : 'Other 🌍';

            countryCounts[country] = (countryCounts[country] || 0) + 1;

            if (!agentStats[agent]) {
                agentStats[agent] = { total: 0, countries: {} };
            }
            agentStats[agent].total++;
            
            if (!agentStats[agent].countries[country]) {
                agentStats[agent].countries[country] = { total: 0, answered: 0, unanswered: 0, duration: 0, calls: [] };
            }
            
            let cStats = agentStats[agent].countries[country];
            cStats.total++;
            
            let stateLower = String(state).toLowerCase();
            
            let isAnswered = false;
            if (stateLower.includes('successful') || stateLower.includes('completed') || 
               (stateLower.includes('answer') && !stateLower.includes('unanswer') && !stateLower.includes('no answer') && !stateLower.includes('not answer'))) {
                isAnswered = true;
            }
            
            let parsedDuration = parseDurationToMinutes(duration);
            if (!isAnswered && !stateLower.includes('no answer') && !stateLower.includes('unanswer') && !stateLower.includes('failed') && parsedDuration > 0) {
                isAnswered = true;
            }

            if (isAnswered) {
                cStats.answered++;
                cStats.duration += parsedDuration;
            } else {
                cStats.unanswered++;
            }

            cStats.calls.push({
                callee: callee,
                caller: caller,
                status: isAnswered ? 'Answered' : 'Unanswered',
                originalState: state || (isAnswered ? 'Successful' : 'No Answer'),
                duration: parsedDuration
            });
        });

        const agentDataArray = Object.keys(agentStats).map(agentName => {
            return {
                agentName: agentName,
                total: agentStats[agentName].total,
                countries: agentStats[agentName].countries
            };
        });
        
        lastMaqsamAgentData = agentDataArray;
        updateMaqsamDashboard(countryCounts, totalCalls, agentDataArray);
    }

    function updateMaqsamDashboard(countryCounts, totalCalls, agentDataArray) {
        document.querySelector('.upload-section').style.display = 'none';
        maqsamDashboard.style.display = 'block';

        const kpiContainer = document.getElementById('maqsam-country-kpis');
        kpiContainer.innerHTML = `
            <div class="stat-card" style="background: rgba(99,102,241,0.05); border-color: #6366f1;">
                <div class="stat-title" style="color: #818cf8;">Total Calls</div>
                <div class="stat-value">${totalCalls.toLocaleString()}</div>
            </div>
        `;
        
        const sortedCountries = Object.entries(countryCounts).sort((a,b) => b[1] - a[1]);
        sortedCountries.forEach(([country, count]) => {
            kpiContainer.innerHTML += `
                <div class="stat-card" style="background: rgba(16,185,129,0.05); border-color: #10b981;">
                    <div class="stat-title" style="color: #10b981;">${country}</div>
                    <div class="stat-value">${count.toLocaleString()}</div>
                </div>
            `;
        });

        renderMaqsamAgentTable(agentDataArray);
    }

    function renderMaqsamAgentTable(data) {
        const tbody = document.querySelector('#maqsam-agent-data-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.sort((a,b) => b.total - a.total).forEach((agent, index) => {
            let breakdownStr = Object.entries(agent.countries)
                .sort((a,b) => b[1].total - a[1].total)
                .map(([c, stats]) => `<span style="display:inline-block; margin-right:10px; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:12px; font-size:0.85rem;">${c}: ${stats.total}</span>`)
                .join('');

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.innerHTML = `
                <td><strong>${agent.agentName}</strong></td>
                <td>${agent.total}</td>
                <td>${breakdownStr}</td>
            `;
            
            tr.addEventListener('click', () => openMaqsamAgentModal(agent));
            tbody.appendChild(tr);
        });
    }

    function openMaqsamAgentModal(agent) {
        const modal = document.getElementById('maqsam-agent-modal');
        document.getElementById('maqsam-modal-title').innerText = `${agent.agentName} - Details`;
        
        document.getElementById('maqsam-modal-stats').innerHTML = `
            <div class="modal-stat-box">
                <span class="stat-label">Total Calls</span>
                <span class="stat-count">${agent.total}</span>
            </div>
        `;
        
        const tbody = document.querySelector('#maqsam-modal-table tbody');
        tbody.innerHTML = '';
        
        Object.entries(agent.countries).sort((a,b) => b[1].total - a[1].total).forEach(([country, stats]) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.innerHTML = `
                <td><strong>${country}</strong></td>
                <td>${stats.total}</td>
                <td style="color: #10b981;">${stats.answered}</td>
                <td style="color: #ef4444;">${stats.unanswered}</td>
                <td>${stats.duration.toFixed(2)} min</td>
            `;
            tr.addEventListener('click', () => openMaqsamCountryCallsModal(country, stats.calls));
            tbody.appendChild(tr);
        });
        
        modal.style.display = 'block';
    }

    function openMaqsamCountryCallsModal(country, calls) {
        const modal = document.getElementById('maqsam-country-calls-modal');
        document.getElementById('maqsam-country-calls-title').innerText = `${country} Calls`;
        const tbody = document.querySelector('#maqsam-country-calls-table tbody');
        tbody.innerHTML = '';
        
        calls.sort((a,b) => b.duration - a.duration).forEach(c => {
            let statusColor = c.status === 'Answered' ? '#10b981' : '#ef4444';
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.callee}</strong></td>
                    <td>${c.caller || '-'}</td>
                    <td style="color: ${statusColor};">${c.originalState}</td>
                    <td>${c.duration.toFixed(2)} min</td>
                </tr>
            `;
        });
        
        modal.style.display = 'block';
    }

    // Maqsam modal close logic
    const maqsamModal = document.getElementById('maqsam-agent-modal');
    const maqsamCloseBtn = document.querySelector('.maqsam-close-btn');
    if (maqsamCloseBtn) {
        maqsamCloseBtn.onclick = function() { maqsamModal.style.display = "none"; }
    }
    
    const maqsamCallsModal = document.getElementById('maqsam-country-calls-modal');
    const maqsamCallsCloseBtn = document.querySelector('.maqsam-country-calls-close-btn');
    if (maqsamCallsCloseBtn) {
        maqsamCallsCloseBtn.onclick = function() { maqsamCallsModal.style.display = "none"; }
    }
    
    window.addEventListener('click', function(event) { 
        if (event.target == maqsamModal) maqsamModal.style.display = "none"; 
        if (event.target == maqsamCallsModal) maqsamCallsModal.style.display = "none"; 
    });

    if (maqsamAgentSearch) {
        maqsamAgentSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = lastMaqsamAgentData.filter(a => a.agentName.toLowerCase().includes(term));
            renderMaqsamAgentTable(filtered);
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

    // --- FREEPBX LOGIC --- //
    function parseFreepbxData(data) {
        const dstMap = {};
        const srcMap = {};
        
        data.forEach(row => {
            let dst = row['dst'] || row['DST'] || row['Dst'] || '';
            let src = row['src'] || row['SRC'] || row['Src'] || '';
            let calldate = row['calldate'] || row['Date'] || row['date'] || row['CallDate'] || '';
            let duration = row['duration'] || row['billsec'] || row['Duration'] || 0;
            let disposition = row['disposition'] || row['Disposition'] || row['Status'] || '';
            let clid = row['clid'] || row['CLID'] || row['Clid'] || '';
            let channel = row['channel'] || row['Channel'] || '';
            
            let server = '-';
            if (channel && channel.includes('-')) {
                let parts = channel.split('-');
                if (parts.length >= 2) {
                    server = parts[1];
                }
            }
            
            let campaign = 'Unknown';
            let clidName = '';
            let clidNumber = '';
            
            if (clid) {
                let match = clid.match(/"?([^"]*)"?\s*<(\d+)>/);
                if (match) {
                    clidName = match[1].trim();
                    clidNumber = match[2].trim();
                } else {
                    clidName = clid;
                }
                
                if (clidNumber === '966115105700' || clid.includes('966115105700')) {
                    if (!clidName && clid.includes('<')) {
                        clidName = clid.split('<')[0].replace(/"/g, '').trim();
                    }
                    campaign = `Manual - ${clidName}`;
                } else if (clidName.toLowerCase().includes('backlog')) {
                    campaign = 'Backlog';
                } else if (clidName.toLowerCase().includes('taager')) {
                    campaign = 'Fresh';
                } else if (clidName) {
                    campaign = clidName;
                }
            }
            
            let isAnswered = String(disposition).toUpperCase() === 'ANSWERED';
            
            if (src) {
                if (!srcMap[src]) {
                    srcMap[src] = { src: src, totalCalls: 0, answered: 0 };
                }
                srcMap[src].totalCalls++;
                if (isAnswered) srcMap[src].answered++;
            }

            dst = String(dst).trim();
            if (!dst || dst === 'hangup' || dst === 's') return;
            
            if (!dstMap[dst]) {
                dstMap[dst] = {
                    dst: dst,
                    totalCalls: 0,
                    sources: new Set(),
                    calls: []
                };
            }
            
            dstMap[dst].totalCalls++;
            if (src) dstMap[dst].sources.add(src);
            
            dstMap[dst].calls.push({
                calldate: calldate,
                src: src,
                campaign: campaign,
                server: server,
                duration: duration,
                disposition: disposition
            });
        });
        
        lastFreepbxData = Object.values(dstMap);
        lastFreepbxSrcData = Object.values(srcMap);
        updateFreepbxDashboard();
    }
    
    function updateFreepbxDashboard() {
        document.querySelector('.upload-section').style.display = 'none';
        freepbxDashboard.style.display = 'block';
        
        let totalCalls = 0;
        let uniqueDst = lastFreepbxData.length;
        
        let answeredFirstCall = 0;
        let answeredWithinTwo = 0;
        let answeredWithinSeven = 0;
        
        let hourlyData = Array(24).fill(0).map(() => ({ total: 0, answered: 0 }));
        
        lastFreepbxData.forEach(d => {
            totalCalls += d.totalCalls;
            
            d.calls.sort((a, b) => new Date(a.calldate) - new Date(b.calldate));
            
            let foundAnswer = false;
            for (let i = 0; i < d.calls.length; i++) {
                let call = d.calls[i];
                let isAnswered = String(call.disposition).toUpperCase() === 'ANSWERED';
                
                let hourMatch = call.calldate.match(/(\d{1,2}):\d{2}/);
                let hour = hourMatch ? parseInt(hourMatch[1]) : new Date(call.calldate).getHours();
                if (!isNaN(hour) && hour >= 0 && hour < 24) {
                    hourlyData[hour].total++;
                    if (isAnswered) hourlyData[hour].answered++;
                }
                
                if (!foundAnswer && isAnswered) {
                    foundAnswer = true;
                    if (i === 0) answeredFirstCall++;
                    if (i <= 1) answeredWithinTwo++;
                    if (i <= 6) answeredWithinSeven++;
                }
            }
        });
        
        let overallCalls = 0;
        let overallAnswered = 0;
        lastFreepbxSrcData.forEach(s => {
            overallCalls += s.totalCalls;
            overallAnswered += s.answered;
        });
        let overallRate = overallCalls > 0 ? ((overallAnswered / overallCalls) * 100).toFixed(1) : 0;
        
        const kpis = document.getElementById('freepbx-kpis');
        kpis.innerHTML = `
            <div class="stat-card" style="background: rgba(99,102,241,0.05); border-color: #6366f1;">
                <div class="stat-title" style="color: #818cf8;">Total Unique Customers (DST)</div>
                <div class="stat-value">${uniqueDst.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background: rgba(16,185,129,0.05); border-color: #10b981;">
                <div class="stat-title" style="color: #10b981;">Total Call Attempts</div>
                <div class="stat-value">${totalCalls.toLocaleString()}</div>
            </div>
            <div class="stat-card" style="background: rgba(245,158,11,0.05); border-color: #f59e0b;">
                <div class="stat-title" style="color: #f59e0b;">Avg Attempts / Customer</div>
                <div class="stat-value">${uniqueDst > 0 ? (totalCalls / uniqueDst).toFixed(1) : 0}</div>
            </div>
            <div class="stat-card" style="background: rgba(236,72,153,0.05); border-color: #ec4899; cursor: pointer;" id="freepbx-src-kpi">
                <div class="stat-title" style="color: #ec4899;">Overall Answer Rate (Click for SRC Details)</div>
                <div class="stat-value">${overallRate}%</div>
            </div>
        `;
        
        let firstRate = uniqueDst > 0 ? ((answeredFirstCall / uniqueDst) * 100).toFixed(1) : 0;
        let twoRate = uniqueDst > 0 ? ((answeredWithinTwo / uniqueDst) * 100).toFixed(1) : 0;
        let sevenRate = uniqueDst > 0 ? ((answeredWithinSeven / uniqueDst) * 100).toFixed(1) : 0;
        
        const attemptKpis = document.getElementById('freepbx-attempts-kpis');
        if (attemptKpis) {
            attemptKpis.innerHTML = `
                <div class="stat-card" style="background: rgba(59,130,246,0.05); border-color: #3b82f6;">
                    <div class="stat-title" style="color: #3b82f6;">Answer Rate (1st Call)</div>
                    <div class="stat-value">${firstRate}%</div>
                </div>
                <div class="stat-card" style="background: rgba(139,92,246,0.05); border-color: #8b5cf6;">
                    <div class="stat-title" style="color: #8b5cf6;">Answer Rate (Max 2 Calls)</div>
                    <div class="stat-value">${twoRate}%</div>
                </div>
                <div class="stat-card" style="background: rgba(236,72,153,0.05); border-color: #ec4899;">
                    <div class="stat-title" style="color: #ec4899;">Answer Rate (First 7 Calls)</div>
                    <div class="stat-value">${sevenRate}%</div>
                </div>
            `;
        }
        
        document.getElementById('freepbx-src-kpi').addEventListener('click', () => {
            openFreepbxSrcModal(lastFreepbxSrcData);
        });
        
        renderFreepbxTable(lastFreepbxData);
        drawHourlyChart(hourlyData);
    }
    
    let hourlyChartInstance = null;
    function drawHourlyChart(hourlyData) {
        const ctx = document.getElementById('freepbx-hourly-chart');
        if (!ctx) return;
        
        if (hourlyChartInstance) {
            hourlyChartInstance.destroy();
        }
        
        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        const rates = hourlyData.map(d => d.total > 0 ? ((d.answered / d.total) * 100).toFixed(1) : 0);
        const totals = hourlyData.map(d => d.total);
        
        hourlyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Answer Rate (%)',
                        data: rates,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Total Calls Attempts',
                        data: totals,
                        type: 'bar',
                        backgroundColor: 'rgba(99,102,241,0.2)',
                        borderColor: 'rgba(99,102,241,0.5)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#fff',
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Answer Rate (%)', color: '#10b981' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Total Attempts', color: '#6366f1' },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#ccc' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#fff' } }
                }
            }
        });
    }
    
    function renderFreepbxTable(data) {
        const tbody = document.querySelector('#freepbx-dst-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        data.sort((a,b) => b.totalCalls - a.totalCalls).forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            
            tr.innerHTML = `
                <td><strong>${item.dst}</strong></td>
                <td>${item.totalCalls}</td>
                <td>${item.sources.size}</td>
            `;
            
            tr.addEventListener('click', () => openFreepbxDetailsModal(item));
            tbody.appendChild(tr);
        });
    }
    
    function openFreepbxDetailsModal(item) {
        const modal = document.getElementById('freepbx-details-modal');
        document.getElementById('freepbx-modal-title').innerText = `Calls to ${item.dst}`;
        
        const tbody = document.querySelector('#freepbx-modal-table tbody');
        tbody.innerHTML = '';
        
        item.calls.forEach(c => {
            let statusColor = String(c.disposition).toUpperCase() === 'ANSWERED' ? '#10b981' : '#ef4444';
            tbody.innerHTML += `
                <tr>
                    <td>${c.calldate}</td>
                    <td>${c.src || '-'}</td>
                    <td>${c.campaign || '-'}</td>
                    <td>${c.server || '-'}</td>
                    <td>${c.duration}</td>
                    <td style="color: ${statusColor}; font-weight: bold;">${c.disposition}</td>
                </tr>
            `;
        });
        
        modal.style.display = 'block';
    }
    
    function openFreepbxSrcModal(srcData) {
        const modal = document.getElementById('freepbx-src-modal');
        const tbody = document.querySelector('#freepbx-src-table tbody');
        tbody.innerHTML = '';
        
        srcData.sort((a,b) => b.totalCalls - a.totalCalls).forEach(item => {
            let rate = item.totalCalls > 0 ? ((item.answered / item.totalCalls) * 100).toFixed(1) : 0;
            tbody.innerHTML += `
                <tr>
                    <td><strong>${item.src}</strong></td>
                    <td>${item.totalCalls}</td>
                    <td style="color: #10b981;">${item.answered}</td>
                    <td>${rate}%</td>
                </tr>
            `;
        });
        
        modal.style.display = 'block';
    }
    
    if (freepbxDstSearch) {
        freepbxDstSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = lastFreepbxData.filter(d => String(d.dst).toLowerCase().includes(term));
            renderFreepbxTable(filtered);
        });
    }
    
    const freepbxModal = document.getElementById('freepbx-details-modal');
    const freepbxCloseBtn = document.querySelector('.freepbx-close-btn');
    if (freepbxCloseBtn) {
        freepbxCloseBtn.onclick = function() { freepbxModal.style.display = 'none'; }
    }
    
    const freepbxSrcModal = document.getElementById('freepbx-src-modal');
    const freepbxSrcCloseBtn = document.querySelector('.freepbx-src-close-btn');
    if (freepbxSrcCloseBtn) {
        freepbxSrcCloseBtn.onclick = function() { freepbxSrcModal.style.display = 'none'; }
    }
    
    window.addEventListener('click', function(event) {
        if (event.target == freepbxModal) freepbxModal.style.display = 'none';
        if (event.target == freepbxSrcModal) freepbxSrcModal.style.display = 'none';
    });

});
