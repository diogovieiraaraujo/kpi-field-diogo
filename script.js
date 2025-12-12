// =========================================================================
// SCRIPT.JS - VERSÃO TURBO (MATRIZ + CACHE)
// =========================================================================

// 👇👇👇 COLE SUA URL DO APPS SCRIPT AQUI 👇👇👇
const API_URL = "https://script.google.com/macros/s/AKfycbzc1yMuNm7u8EjvEPeuui-6f-mCnKADqY8erBZNlXlQkxRzqmfA8GQbdD-vkT029zbCDQ/exec";

// --- 1. CONFIGURAÇÃO E UTILS ---

function logMsg(msg, isError=false) { 
    const el = document.getElementById('statusLog'); 
    if(el) {
        el.style.display='block'; 
        el.style.backgroundColor=isError?'#f8d7da':'#d1e7dd'; 
        el.style.color=isError?'#721c24':'#0f5132'; 
        el.style.borderColor=isError?'#f5c6cb':'#badbcc';
        el.innerText=msg; 
        setTimeout(() => { if(!isError) el.style.display='none'; }, isError ? 10000 : 5000);
    }
    if(isError) console.error(msg); else console.log(msg);
}

const distinctColors = ['#0055FF', '#D32F2F', '#00C853', '#F57C00', '#7B1FA2', '#00ACC1', '#C2185B', '#AFB42B', '#5D4037', '#616161', '#455A64', '#E64A19', '#512DA8', '#1976D2', '#388E3C', '#FBC02D', '#8E24AA', '#0288D1', '#689F38', '#E91E63'];

const IGNORED_NAMES = [
    'Automation for Jira', 'JEFERSON PITINGA NOGUEIRA', 'moises.cavalcante', 'MARIANNA LIRA MEDINA',
    'Fabiana Ferreira Garcia de Oliveira', 'Joao Paulo de Macedo Torquato', 'Ramon Marchi',
    'Regina Paulino Gouveia Cruz', 'marcos francisco delgado', 'Fabiana Rufina de Oliveira Sousa',
    'Caíque Ferreira Batista', 'Vinicius Augusto Macedo Silva', 'System'
];

const isExcluded = (name) => {
    if (!name || name === 'N/A') return false; 
    const n = name.toLowerCase().trim();
    return IGNORED_NAMES.some(ignored => ignored.toLowerCase().trim() === n);
};

const STORAGE_KEY = 'ic_dashboard_csv_data';
let allTickets = [], monthlyData = {}, charts = {};

window.sideLabelsPlugin = {
    id: 'sideLabels',
    afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart;
        const meta0 = chart.getDatasetMeta(0);
        if(!meta0 || !meta0.data.length) return;
        meta0.data.forEach((barPoint, dataIndex) => {
            let stackRightEdge = barPoint.x + barPoint.width / 2;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (dataset.type==='line' || dataset.data[dataIndex]===0 || dataset.label==='Total') return;
                const meta = chart.getDatasetMeta(datasetIndex); if(meta.hidden) return;
                const element = meta.data[dataIndex]; if(!element) return;
                const segmentCenterY = element.getCenterPoint().y;
                const isL = document.body.classList.contains('light-mode');
                const txtColor = isL ? '#000' : '#fff';
                ctx.save(); ctx.beginPath(); ctx.strokeStyle = dataset.backgroundColor; ctx.lineWidth = 1;
                ctx.moveTo(stackRightEdge + 5, segmentCenterY); ctx.lineTo(stackRightEdge + 15, segmentCenterY); ctx.stroke();
                ctx.fillStyle = txtColor;
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(dataset.data[dataIndex], stackRightEdge + 18, segmentCenterY); ctx.restore();
            });
        });
    }
};

// --- 3. INICIALIZAÇÃO DE GRÁFICOS ---
function initCharts() {
    if (typeof Chart === 'undefined') {
        if(document.getElementById('chartError')) document.getElementById('chartError').style.display = 'block';
        return;
    }
    try {
        if(typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            Chart.defaults.font.family = "'Montserrat', sans-serif";
            Chart.defaults.set('plugins.datalabels', { 
                font: { weight: 'bold', family: "'Montserrat', sans-serif" }, 
                formatter: Math.round, 
                display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, 
                anchor: 'end', align: 'end' 
            });
        }
    } catch(e) { console.warn("Erro plugins", e); }

    const createChart = (id, type, cfg) => {
        const ctx = document.getElementById(id); if(!ctx) return null;
        const defaultPadding = (type === 'pie' || type === 'doughnut') ? { padding: 20 } : { padding: { top: 30, right: 35, left: 10, bottom: 10 } }; 
        let scalesConfig = {};
        if (type !== 'pie' && type !== 'doughnut') {
            scalesConfig = { x: { grid: { color: '#333' } }, y: { grid: { color: '#333' } } };
            if (cfg.indexAxis === 'y') { scalesConfig.x.grace = '15%'; }
        }
        const onClickHandler = (evt, elements, chart) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const datasetIndex = elements[0].datasetIndex;
                handleChartClick(id, index, datasetIndex, chart);
            }
        };
        return new Chart(ctx, { 
            type: type, 
            data: { labels:[], datasets:[] }, 
            options: { 
                responsive: true, maintainAspectRatio: false, layout: defaultPadding, 
                plugins: { legend: { display: false } }, 
                scales: scalesConfig, 
                onClick: onClickHandler, ...cfg 
            } 
        });
    };
    
    const outsideLabelsConfig = { position: 'bottom', labels: { font: { family: "'Montserrat', sans-serif" } } };
    const stackedBarConfig = {
        scales:{ x:{stacked:true}, y:{stacked:true} }, 
        plugins:{ legend:{ display:true, position:'bottom', labels:{ filter: (i)=>i.text!=='Total', font: { family: "'Montserrat', sans-serif" } } } }, 
        layout: { padding: { top: 30, right: 20, left: 10, bottom: 10 } } 
    };

    charts.trend = createChart('trendChart', 'line', {});
    charts.loc = createChart('locationChart', 'bar', {});
    charts.ass = createChart('assigneeChart', 'bar', { indexAxis:'y', plugins: { legend: { display: true, position: 'bottom' } }, layout: { padding: { top: 10, right: 30, left: 10, bottom: 10 } } }); 
    charts.mAss = createChart('monthlyAssigneeChart', 'bar', { ...stackedBarConfig, plugins: { ...stackedBarConfig.plugins, sideLabels: window.sideLabelsPlugin } });
    charts.type = createChart('typeChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.cat = createChart('categoryChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.sla = createChart('slaChart', 'doughnut', { cutout:'65%', plugins: { legend: outsideLabelsConfig } });
    charts.status = createChart('statusChart', 'bar', {});
    charts.reqGlobal = createChart('globalRequesterChart', 'bar', { indexAxis: 'y' });
    charts.mCCusto = createChart('monthlyCCustoChart', 'bar', { indexAxis: 'y' });
    charts.mRole = createChart('monthlyRoleChart', 'bar', { indexAxis: 'y' });
    charts.gCCusto = createChart('generalCCustoChart', 'bar', { indexAxis: 'y' });
    charts.gRole = createChart('generalRoleChart', 'bar', { indexAxis: 'y' });

    const createUnitCharts = (prefix) => {
        charts[prefix + 'Extrema'] = createChart(prefix + 'Extrema', 'bar', { indexAxis: 'y' });
        charts[prefix + 'Serra'] = createChart(prefix + 'Serra', 'bar', { indexAxis: 'y' });
        charts[prefix + 'Embu'] = createChart(prefix + 'Embu', 'bar', { indexAxis: 'y' });
        charts[prefix + 'Vila'] = createChart(prefix + 'Vila', 'bar', { indexAxis: 'y' });
        charts[prefix + 'Duque'] = createChart(prefix + 'Duque', 'bar', { indexAxis: 'y' });
        charts[prefix + 'Other'] = createChart(prefix + 'Other', 'bar', { indexAxis: 'y' });
    };
    createUnitCharts('unitChart'); createUnitCharts('mUnitChart'); createUnitCharts('gUnitChart');

    charts.mVol = createChart('monthlyChart', 'line', {});
    charts.mSla = createChart('monthlySlaChart', 'doughnut', { cutout:'65%', plugins: { legend: outsideLabelsConfig } });
    charts.mUnits = createChart('monthlyUnitsChart', 'bar', { indexAxis:'y' });
    charts.mStatus = createChart('monthlyStatusChart', 'bar', {});
    charts.mType = createChart('monthlyTypeChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.mCat = createChart('monthlyCategoryChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.mReq = createChart('monthlyRequesterChart', 'bar', { indexAxis: 'y' });
    updateChartTheme();
}

// --- 4. CARREGAMENTO OTIMIZADO ---

function handleFileSelect(evt) { 
    const file = evt.target.files[0]; 
    if(!file) return; 
    document.getElementById('currentDate').innerText = new Date().toLocaleString('pt-BR');
    const r = new FileReader(); 
    r.onload = (e) => {
        try { localStorage.setItem(STORAGE_KEY, e.target.result); } catch(err) {}
        logMsg("Lendo arquivo local...");
        setTimeout(() => processCSV(e.target.result), 100); 
    };
    r.readAsText(file); 
}

async function loadFromGoogle() {
    if (!API_URL || API_URL.includes("SUA_URL")) {
        logMsg("Modo Offline (API não configurada).", true);
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) processCSV(savedData, true);
        return;
    }

    logMsg("Sincronizando");
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Erro na conexão");
        
        // Agora recebemos uma matriz de arrays, não objetos
        const rawMatrix = await response.json();

        if (rawMatrix.error) throw new Error(rawMatrix.error);
        if (!Array.isArray(rawMatrix) || rawMatrix.length < 2) throw new Error("Planilha vazia ou formato inválido");

        processAPIData(rawMatrix);
        
    } catch (error) {
        logMsg("Erro ao buscar dados: " + error.message, true);
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            logMsg("Usando cache local devido a erro.", true);
            processCSV(savedData, true);
        }
    }
}

function clearLocalData() { 
    localStorage.removeItem(STORAGE_KEY); 
    logMsg("Cache limpo!", false); 
    setTimeout(() => location.reload(), 500); 
}

const parseDt = (s) => { 
    if(!s) return null; 
    try {
        let cleanS = String(s).replace(/"/g,'').trim();
        let parts = cleanS.split(' ')[0].split('/');
        if (parts.length < 3) parts = cleanS.split(' ')[0].split('-');
        if (parts.length >= 3) {
            let d = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);
            let y = parseInt(parts[2], 10);
            if (y < 100) y += 2000;
            const dt = new Date(y, m - 1, d);
            if (!isNaN(dt.getTime())) return dt;
        }
        return null;
    } catch(e) { return null; }
};

// NOVA FUNÇÃO: PROCESSA MATRIZ CRUA (MUITO MAIS RÁPIDO)
function processAPIData(matrix) {
    // Linha 0 são os cabeçalhos
    const headers = matrix[0].map(h => String(h).trim().toLowerCase());
    
    // Mapeia índices das colunas uma única vez
    const map = {
        created: headers.findIndex(h=>h.includes('criado')),
        updated: headers.findIndex(h=>h.includes('atualizado')),
        deadline: headers.findIndex(h=>h.includes('limite')||h.includes('due')),
        status: headers.findIndex(h=>h.includes('status')),
        assignee: headers.findIndex(h=>h.includes('respons')||h.includes('assignee')),
        type: headers.findIndex(h=>h.includes('tipo')),
        loc: headers.findIndex(h=>(h.includes('office')||h.includes('local')) && !h.includes('categor')),
        id: headers.findIndex(h=>h.includes('chave')||h.includes('key')),
        summary: headers.findIndex(h=>h.includes('resumo')),
        reporter: headers.findIndex(h=>h.includes('relator')),
        category: headers.findIndex(h=>h.includes('category')||h.includes('categor')),
        ccusto: headers.findIndex(h=>h.includes('ccusto')||h.includes('centro')),
        role: headers.findIndex(h=>h.includes('funcao')||h.includes('função'))
    };

    const data = [];
    let maxDate = 0;

    // Loop direto na matriz (começando da linha 1)
    for (let i = 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (row.length < 3) continue;

        // Pega valor pelo índice (acesso direto é instantâneo)
        const cDt = parseDt(row[map.created]);
        
        if (cDt) {
            if (cDt.getTime() > maxDate) maxDate = cDt.getTime();
            const clean = (idx) => (idx > -1 && row[idx]) ? String(row[idx]).trim() : 'N/A';
            
            data.push({
                created: cDt,
                updated: parseDt(row[map.updated]),
                deadline: parseDt(row[map.deadline]),
                status: clean(map.status),
                assignee: clean(map.assignee),
                type: clean(map.type),
                location: map.loc > -1 ? String(row[map.loc]).trim() : 'Geral',
                id: map.id > -1 ? String(row[map.id]).trim() : `REQ-${i}`,
                summary: map.summary > -1 ? String(row[map.summary]).trim() : 'Sem resumo',
                reporter: map.reporter > -1 ? String(row[map.reporter]).trim() : 'Desconhecido',
                category: map.category > -1 ? String(row[map.category]).trim() : 'Outros',
                ccusto: clean(map.ccusto),
                role: clean(map.role)
            });
        }
    }

    if (data.length === 0) { logMsg("Nenhum dado válido.", true); return; }
    if (maxDate > 0) document.getElementById('currentDate').innerText = new Date(maxDate).toLocaleString('pt-BR');
    
    allTickets = data;
    recalculateKPIs(data);
    logMsg(`Sincronizado: ${data.length} registros.`);
}

function processCSV(text, isAuto=false) {
    // Mantido para fallback manual
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows = []; let currentRow = []; let currentCell = ''; let insideQuotes = false;
    const firstLineEnd = cleanText.indexOf('\n');
    const firstLine = cleanText.substring(0, firstLineEnd > -1 ? firstLineEnd : cleanText.length);
    const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i]; const nextChar = cleanText[i + 1];
        if (char === '"') { if (insideQuotes && nextChar === '"') { currentCell += '"'; i++; } else { insideQuotes = !insideQuotes; } } 
        else if (char === sep && !insideQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; } 
        else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; 
            if (currentCell || currentRow.length > 0) currentRow.push(currentCell.trim());
            if (currentRow.length > 0) rows.push(currentRow);
            currentRow = []; currentCell = '';
        } else { currentCell += char; }
    }
    if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
    
    if(rows.length < 2) return;
    processAPIData(rows); // Reutiliza a função otimizada
}

function calculateBusinessTime(start, end) {
    if (!start || !end || start >= end) return 0;
    const startHour = 8; const endHour = 18; let totalMs = 0; let current = new Date(start);
    while (current < end) {
        const day = current.getDay();
        if (day === 0 || day === 6) { current.setHours(0,0,0,0); current.setDate(current.getDate() + 1); continue; }
        const workStart = new Date(current); workStart.setHours(startHour, 0, 0, 0); const workEnd = new Date(current); workEnd.setHours(endHour, 0, 0, 0);
        if (current >= workEnd) { current.setHours(0,0,0,0); current.setDate(current.getDate() + 1); continue; }
        if (current < workStart) current = workStart;
        let effectiveEnd = new Date(Math.min(end.getTime(), workEnd.getTime()));
        if (effectiveEnd > current) totalMs += (effectiveEnd - current);
        current.setDate(current.getDate() + 1); current.setHours(0, 0, 0, 0);
    }
    return totalMs;
}

function formatDuration(ms) { 
    if(!ms||ms<0)return "-"; const hours = Math.floor(ms / 3600000); const days = Math.floor(hours / 10); const remHours = hours % 10;
    return days > 0 ? `${days}d ${remHours}h` : `${hours}h`; 
}

function getTop10(data, key) {
    const counts = {};
    data.forEach(t => { 
        if(t[key]) {
            if ((key === 'reporter' || key === 'assignee') && isExcluded(t[key])) return;
            counts[t[key]] = (counts[t[key]] || 0) + 1; 
        }
    });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
}

function recalculateKPIs(data) {
    const s = {trend:{},loc:{},ass:{},type:{},status:{},cat:{},rep:{},slaOk:0,slaTot:0,durSum:0,durCount:0};
    monthlyData={}; 

    data.forEach(t => {
        if(t.created) {
            const y = t.created.getFullYear().toString(); 
            const m = (t.created.getMonth()+1).toString(); 
            if(!monthlyData[y]) monthlyData[y]={}; 
            if(!monthlyData[y][m]) monthlyData[y][m]=[]; 
            monthlyData[y][m].push(t); 
        }
        if(isExcluded(t.reporter)) return; 
        const k = `${String(t.created.getMonth()+1).padStart(2,'0')}/${t.created.getFullYear().toString().substr(2)}`;
        s.trend[k]=(s.trend[k]||0)+1; s.loc[t.location]=(s.loc[t.location]||0)+1; s.type[t.type]=(s.type[t.type]||0)+1; s.status[t.status]=(s.status[t.status]||0)+1; s.cat[t.category]=(s.cat[t.category]||0)+1; s.rep[t.reporter]=(s.rep[t.reporter]||0)+1;
        if(!isExcluded(t.assignee) && t.assignee !== 'N/A') s.ass[t.assignee]=(s.ass[t.assignee]||0)+1;
        const statusLower = t.status.toLowerCase();
        const isRes = ['resolvido','fechada','concluído','concluido','done','fechado'].some(x => statusLower.includes(x));
        const isCanc = statusLower.includes('cancelado');
        if(t.deadline && !isCanc) { s.slaTot++; if((isRes&&t.updated<=t.deadline)||(!isRes&&new Date()<=t.deadline)) s.slaOk++; }
        if(isRes && t.updated && !isCanc) { const d = calculateBusinessTime(t.created, t.updated); if(d>0){ s.durSum+=d; s.durCount++; } }
    });
    
    document.getElementById('kpiTotal').innerText = data.length; 
    const slaVal = s.slaTot ? ((s.slaOk/s.slaTot)*100) : 0;
    const elKpiSla = document.getElementById('kpiSLA');
    elKpiSla.innerText = s.slaTot ? slaVal.toFixed(1)+"%" : "-";
    elKpiSla.className = 'kpi-value ' + (slaVal >= 70 ? 'text-warning' : 'text-danger');
    if(slaVal >= 90) elKpiSla.className = 'kpi-value text-success';
    document.getElementById('kpiSMA').innerText = s.durCount?formatDuration(s.durSum/s.durCount):"-";
    const topL = Object.entries(s.loc).sort((a,b)=>b[1]-a[1])[0]; document.getElementById('kpiLocation').innerText = topL?topL[0]:"-";
    
    const updateC = (k,l,d,p={}) => { 
        if(!charts[k]) return; 
        charts[k].data.labels=l; 
        charts[k].data.datasets=[{
            data:d, backgroundColor:p.bg||'#8680b1', borderColor:p.bd||'#8680b1', fill:p.fill||false, label: p.label || 'Volume'
        }]; 
        if(p.multi)charts[k].data.datasets[0].backgroundColor=p.bg; 
        charts[k].update(); 
    };

    const tK = Object.keys(s.trend).sort((a,b)=>{const[m1,y1]=a.split('/');const[m2,y2]=b.split('/');return y1==y2?m1-m2:y1-y2;}); 
    updateC('trend',tK,tK.map(k=>s.trend[k]),{bg:'rgba(134,128,177,0.2)',fill:true, label: 'Chamados por Mês'});
    const sL = Object.entries(s.loc).filter(x => x[0] !== 'N/A').sort((a,b)=>b[1]-a[1]); 
    updateC('loc',sL.map(x=>x[0]),sL.map(x=>x[1]),{bg:'#0055FF', label: 'Chamados por Unidade'});
    
    const topAss = Object.entries(s.ass).sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts.ass.data.labels = topAss.map(x => x[0]);
    charts.ass.data.datasets = [{ label: 'Volume de Chamados', data: topAss.map(x => x[1]), backgroundColor: '#0055FF', barThickness: 20 }];
    charts.ass.update();

    updateC('type',Object.keys(s.type),Object.values(s.type),{multi:true,bg:distinctColors, label: 'Tipos'}); 
    
    const groupedCat = {}; let otherCatCount = 0;
    Object.entries(s.cat).forEach(([k, v]) => { if (v < 30) otherCatCount += v; else groupedCat[k] = v; });
    if (otherCatCount > 0) groupedCat['Demais Categorias'] = otherCatCount;
    const catLabels = Object.keys(groupedCat).sort((a, b) => groupedCat[b] - groupedCat[a]);
    const catData = catLabels.map(k => groupedCat[k]);
    charts.cat.data.labels = catLabels;
    charts.cat.data.datasets = [{ data: catData, backgroundColor: distinctColors, label: 'Categorias' }];
    charts.cat.update();

    updateC('sla',['No Prazo','Fora'],[s.slaOk,s.slaTot-s.slaOk],{multi:true,bg:['#00C853','#FF5252'], label: 'SLA'}); 
    updateC('status',Object.keys(s.status),Object.values(s.status),{multi:true,bg:['#00C853','#455A64','#9E9E9E','#8680b1','#546E7A'], label: 'Status'});
    
    const sRepArr = Object.entries(s.rep).sort((a,b)=>b[1]-a[1]).slice(0,10);
    updateC('reqGlobal', sRepArr.map(x=>x[0]), sRepArr.map(x=>x[1]), {bg: '#00ACC1', label: 'Solicitações'});
    
    const updateGeneralSpecialChart = (key, chartObj, obsId, color) => {
        if (!chartObj) return;
        const counts = {}; let notFoundCount = 0;
        data.forEach(t => {
            const val = t[key];
            if (val === 'Não Encontrado' || val === 'N/A' || !val) { notFoundCount++; } 
            else { if (isExcluded(t.reporter)) return; counts[val] = (counts[val] || 0) + 1; }
        });
        const obsEl = document.getElementById(obsId);
        if (obsEl) {
            if (notFoundCount > 0) {
                const formattedCount = notFoundCount.toLocaleString('pt-BR');
                obsEl.innerText = `Temos "${formattedCount}" da Automação do Jira ou de colaborador desligado`;
                obsEl.style.display = 'block';
            } else { obsEl.style.display = 'none'; }
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
        chartObj.data.labels = sorted.map(x => x[0]);
        chartObj.data.datasets = [{ data: sorted.map(x => x[1]), backgroundColor: color, label: 'Chamados' }];
        chartObj.update();
    };

    updateGeneralSpecialChart('ccusto', charts.gCCusto, 'obsCCusto', '#7B1FA2');
    updateGeneralSpecialChart('role', charts.gRole, 'obsRole', '#E64A19');

    updateUnitRequesterCharts(data, 'gUnitChart'); 
    updateUnitRequesterCharts(data, 'unitChart');

    initMonthlyTab(); 
    updateChartTheme();
}

function updateStackedAnalystChart(chartObj, dataset) {
    if(!chartObj) return;
    const counts = {}; const locations = new Set(); const analysts = new Set();
    dataset.forEach(t => { if (!t.assignee || isExcluded(t.assignee) || t.assignee === 'N/A') return; analysts.add(t.assignee); locations.add(t.location); if(!counts[t.assignee]) counts[t.assignee] = {}; counts[t.assignee][t.location] = (counts[t.assignee][t.location] || 0) + 1; });
    const sortedAnalysts = Array.from(analysts).sort((a,b) => { const totalA = Object.values(counts[a]).reduce((sum,v)=>sum+v,0); const totalB = Object.values(counts[b]).reduce((sum,v)=>sum+v,0); return totalB - totalA; }).slice(0, 20);
    const locArray = Array.from(locations).sort();
    const datasets = locArray.map((loc, i) => ({ label: loc, data: sortedAnalysts.map(a => counts[a][loc] || 0), backgroundColor: distinctColors[i % distinctColors.length], stack: 'total', datalabels: { display: false } }));
    const totals = sortedAnalysts.map(a => Object.values(counts[a]).reduce((s,v)=>s+v,0));
    datasets.push({ label: 'Total', data: totals, type: 'line', backgroundColor: 'transparent', borderColor: 'transparent', pointRadius: 0, datalabels: { display: true, align: 'end', anchor: 'end', offset: -4, font: { weight: 'bold', family: "'Montserrat', sans-serif" } } });
    chartObj.data.labels = sortedAnalysts; chartObj.data.datasets = datasets; chartObj.update();
}

function updateUnitRequesterCharts(data, chartPrefix) {
    const unitsMap = { 'Extrema': chartPrefix + 'Extrema', 'Serra': chartPrefix + 'Serra', 'Embu DCR': chartPrefix + 'Embu', 'Vila Olímpia': chartPrefix + 'Vila', 'Duque de Caxias': chartPrefix + 'Duque' };
    const stats = { 'Extrema': {}, 'Serra': {}, 'Embu DCR': {}, 'Vila Olímpia': {}, 'Duque de Caxias': {}, 'Outros': {} };
    const norm = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    data.forEach(t => { 
        if(isExcluded(t.reporter)) return; 
        let bucket = 'Outros'; const locNorm = norm(t.location);
        for(let u of Object.keys(unitsMap)) { const uNorm = norm(u); if(locNorm.includes(uNorm) || (u === 'Vila Olímpia' && locNorm.includes('vila'))) { bucket = u; break; } } 
        if(!stats[bucket][t.reporter]) stats[bucket][t.reporter] = 0; stats[bucket][t.reporter]++; 
    });
    const updateChart = (key, unitData) => { 
        if(!charts[key]) return; 
        const top5 = Object.entries(unitData).sort((a,b)=>b[1]-a[1]).slice(0,5); 
        charts[key].data.labels = top5.map(x=>x[0]); 
        charts[key].data.datasets = [{ data: top5.map(x=>x[1]), backgroundColor: '#5E35B1', label: 'Chamados' }]; 
        charts[key].update(); 
    };
    Object.keys(unitsMap).forEach(u => updateChart(unitsMap[u], stats[u])); 
    updateChart(chartPrefix + 'Other', stats['Outros']);
}

function getMoM(current, previous) {
    if (!previous || previous === 0) return { val: "0%", class: "", icon: "-" };
    const diff = ((current - previous) / previous) * 100; const absDiff = Math.abs(diff).toFixed(1);
    if (diff > 0) return { val: `+${absDiff}%`, class: "text-success", icon: "▲" };
    if (diff < 0) return { val: `-${absDiff}%`, class: "text-danger", icon: "▼" };
    return { val: "0%", class: "text-muted", icon: "-" };
}

function calculateTeamInsights(data) {
    const grid = document.getElementById('team-insights-grid'); 
    if(grid) grid.innerHTML = ""; else return; 
    
    if(!data || data.length === 0) { grid.innerHTML = "<p style='color:var(--text-muted); text-align:center; width:100%; grid-column:1/-1;'>Sem dados neste mês.</p>"; return; }
    const stats = {}; let totalTeamTickets = 0;
    data.forEach(t => { 
        if (!t.assignee || isExcluded(t.assignee) || t.assignee === 'N/A') return; 
        if(!stats[t.assignee]) stats[t.assignee] = { count: 0, slaOk: 0, slaTot: 0 }; 
        stats[t.assignee].count++; totalTeamTickets++; 
        if(t.deadline) { stats[t.assignee].slaTot++; if(t.updated <= t.deadline) stats[t.assignee].slaOk++; } 
    });
    const activeAnalysts = Object.keys(stats).length; const avgVol = activeAnalysts ? totalTeamTickets / activeAnalysts : 0;
    Object.entries(stats).sort((a,b) => b[1].count - a[1].count).forEach(([name, s]) => {
        const sla = s.slaTot ? (s.slaOk / s.slaTot) * 100 : 0;
        let profile = "Operacional", cardBorderColor = "var(--border-color)", icon = "👤";
        if (sla >= 95) { profile = "Perfil Técnico"; cardBorderColor = "var(--success)"; icon = "🛡️"; } else if (s.count > avgVol * 1.2) { profile = "Perfil Agilidade"; cardBorderColor = "var(--brand-blue)"; icon = "⚡"; }
        let strongTxt = "Consistência.", weakTxt = "Monitorar.", actionTxt = "Acompanhar.";
        if(sla >= 95) strongTxt = "Alta confiabilidade."; else if(s.count > avgVol) strongTxt = "Alta vazão.";
        if(sla < 85) { weakTxt = `SLA (${sla.toFixed(0)}%) baixo.`; actionTxt = "Priorizar prazos."; } else if(s.count < avgVol * 0.6) { weakTxt = "Volume baixo."; actionTxt = "Puxar backlog."; }
        grid.innerHTML += `<div class="insight-card" style="border-left-color: ${cardBorderColor}"><div class="ic-header-modern"><div class="ic-avatar">${icon}</div><div class="ic-info"><h4>${name}</h4><span>${profile}</span></div></div><div class="ic-blocks-row"><div class="ic-block bg-success-light"><div class="ic-block-title text-success">✔ Forte</div><div>${strongTxt}</div></div><div class="ic-block ${sla < 85 ? 'bg-danger-light' : 'bg-warning-light'}"><div class="ic-block-title ${sla < 85 ? 'text-danger' : 'text-warning'}">⚠ Atenção</div><div>${weakTxt}</div></div></div></div>`;
    });
}

const yearSelect = document.getElementById('yearSelect'), monthSelect = document.getElementById('monthSelect'), mNames = {"1":"Janeiro","2":"Fevereiro","3":"Março","4":"Abril","5":"Maio","6":"Junho","7":"Julho","8":"Agosto","9":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
function initMonthlyTab() { yearSelect.innerHTML=""; const ys=Object.keys(monthlyData).sort(); if(!ys.length)return; ys.forEach(y=>yearSelect.add(new Option(y,y))); yearSelect.value=ys[ys.length-1]; updateMonthSelect(); }
function updateMonthSelect() { monthSelect.innerHTML=""; const y=yearSelect.value; if(!monthlyData[y])return; const ms=Object.keys(monthlyData[y]).sort((a,b)=>a-b); ms.forEach(m=>monthSelect.add(new Option(mNames[m],m))); monthSelect.value=ms[ms.length-1]; updateMonthlyView(); }

function updateMonthlyView() {
    const y = yearSelect.value, m = monthSelect.value; if(!y || !m) return;
    const createdInMonth = (monthlyData[y] && monthlyData[y][m]) ? monthlyData[y][m] : [];
    
    const resolvedInMonth = allTickets.filter(t => { 
        if (!t.updated) return false; 
        if (isExcluded(t.assignee) && t.assignee !== 'N/A') return false; 
        const statusLower = t.status.toLowerCase(); 
        const isRes = ['resolvido','fechada','concluído','concluido','done','fechado'].some(x => statusLower.includes(x)); 
        return isRes && !statusLower.includes('cancelado') && t.updated.getFullYear().toString() === y && (t.updated.getMonth() + 1).toString() === m; 
    });
    
    let prevY = parseInt(y), prevM = parseInt(m) - 1; if (prevM === 0) { prevM = 12; prevY--; }
    const ticketsPrevMonth = allTickets.filter(t => { if (!t.updated) return false; const statusLower = t.status.toLowerCase(); const isRes = ['resolvido','fechada','concluído','done','fechado'].some(x => statusLower.includes(x)); return isRes && !statusLower.includes('cancelado') && t.updated.getFullYear() === prevY && (t.updated.getMonth() + 1) === prevM; });

    calculateTeamInsights(resolvedInMonth);
    const calcMetrics = (tickets) => { let slaOk = 0, slaTot = 0, durSum = 0, durCount = 0; tickets.forEach(t => { if (t.deadline) { slaTot++; if (t.updated <= t.deadline) slaOk++; } const dur = calculateBusinessTime(t.created, t.updated); if (dur > 0) { durSum += dur; durCount++; } }); return { count: tickets.length, sla: slaTot ? (slaOk/slaTot)*100 : 0, tma: durCount ? durSum/durCount : 0 }; };
    const cur = calcMetrics(resolvedInMonth); const prev = calcMetrics(ticketsPrevMonth);
    const momVol = getMoM(cur.count, prev.count); const momSLA = getMoM(cur.sla, prev.sla); const momTMA = getMoM(cur.tma, prev.tma); momTMA.class = cur.tma > prev.tma ? "text-danger" : "text-success"; if(cur.tma > prev.tma) momTMA.icon = "▲"; else if(cur.tma < prev.tma) momTMA.icon = "▼";

    const renderKPICard = (id, title, value, momData, isSLA=false) => { const el = document.getElementById(id); if(!el) return; const card = el.closest('.kpi-card'); let statusColor = "text-normal", statusIcon = "", badgeClass = "bg-success-light", badgeText = "Atualizado"; if(isSLA) { if(parseFloat(value) >= 90) { statusColor = "text-success"; statusIcon = "✔"; badgeText = "Meta OK"; } else if(parseFloat(value) < 70) { statusColor = "text-danger"; statusIcon = "⚠"; badgeClass = "bg-danger-light"; badgeText = "Crítico"; } else { statusColor = "text-warning"; statusIcon = "!"; badgeClass = "bg-warning-light"; badgeText = "Atenção"; } } card.innerHTML = `<div class="kpi-header-row"><span class="kpi-title">${title}</span><span class="kpi-icon-status ${statusColor}">${statusIcon}</span></div><div class="kpi-value ${statusColor}" id="${id}">${value}</div><div class="kpi-badge ${badgeClass}">${badgeText}</div><div class="kpi-mom"><span class="${momData.class}" style="font-weight:bold;">${momData.icon} ${momData.val}</span> vs mês anterior</div>`; };
    renderKPICard('monthlyTotal', "Entregas no Mês", cur.count, momVol); renderKPICard('monthlySLA', "SLA do Mês", cur.sla.toFixed(1) + "%", momSLA, true);
    if(document.getElementById('monthlySMA')) document.getElementById('monthlySMA').closest('.kpi-card').innerHTML = `<div class="kpi-header-row"><span class="kpi-title">TMA do Mês</span><span style="font-size:1.4rem;">⏱</span></div><div class="kpi-value text-normal" id="monthlySMA">${formatDuration(cur.tma)}</div><div class="kpi-badge bg-info-light">Tempo Médio</div><div class="kpi-mom"><span class="${momTMA.class}" style="font-weight:bold;">${momTMA.icon} ${momTMA.val}</span> vs mês anterior</div>`;

    const sVol = {}; if(createdInMonth.length > 0) createdInMonth.forEach(t => { const d = t.created.getDate(); sVol[d] = (sVol[d] || 0) + 1; }); const dK = Object.keys(sVol).sort((a, b) => a - b);
    if(charts.mVol) { charts.mVol.data.labels = dK.length ? dK : ['Sem dados']; charts.mVol.data.datasets = [{ data: dK.length ? dK.map(k => sVol[k]) : [0], borderColor: '#8680b1', backgroundColor: 'rgba(134,128,177,0.2)', fill: true, label: 'Abertos' }]; charts.mVol.update(); }
    let realSlaOk = 0; resolvedInMonth.forEach(t => { if(t.deadline && t.updated <= t.deadline) realSlaOk++; }); let realSlaTot = resolvedInMonth.filter(t=>t.deadline).length;
    if(charts.mSla) { charts.mSla.data.labels = ['No Prazo', 'Fora']; charts.mSla.data.datasets = [{ data: [realSlaOk, realSlaTot - realSlaOk], backgroundColor: ['#00C853', '#FF5252'], label: 'Chamados' }]; charts.mSla.update(); }
    const sStatus = {}; createdInMonth.forEach(t => { sStatus[t.status] = (sStatus[t.status] || 0) + 1; });
    if(charts.mStatus) { charts.mStatus.data.labels = Object.keys(sStatus); charts.mStatus.data.datasets = [{ data: Object.values(sStatus), backgroundColor: ['#00C853', '#8680b1', '#FF5252', '#0055FF'], label: 'Chamados' }]; charts.mStatus.update(); }
    const sType = {}; createdInMonth.forEach(t => { sType[t.type] = (sType[t.type] || 0) + 1; });
    if(charts.mType) { charts.mType.data.labels = Object.keys(sType); charts.mType.data.datasets = [{ data: Object.values(sType), backgroundColor: distinctColors, label: 'Tipos' }]; charts.mType.update(); }
    
    const sCat = {}; createdInMonth.forEach(t => { sCat[t.category] = (sCat[t.category] || 0) + 1; });
    const groupedCat = {}; let lowVol = 0;
    Object.entries(sCat).forEach(([k, v]) => { if(v < 5) lowVol += v; else groupedCat[k] = v; });
    if(lowVol > 0) groupedCat['Categorias de baixo volume'] = lowVol;
    const catKeys = Object.keys(groupedCat).sort((a,b) => groupedCat[b] - groupedCat[a]);
    if(charts.mCat) { charts.mCat.data.labels = catKeys; charts.mCat.data.datasets = [{ data: catKeys.map(k => groupedCat[k]), backgroundColor: distinctColors, label: 'Categorias' }]; charts.mCat.update(); }
    
    const sRep = {}; createdInMonth.forEach(t => { if(!isExcluded(t.reporter)) sRep[t.reporter] = (sRep[t.reporter]||0)+1; }); const topRep = Object.entries(sRep).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if(charts.mReq) { charts.mReq.data.labels = topRep.map(x=>x[0]); charts.mReq.data.datasets = [{ data: topRep.map(x=>x[1]), backgroundColor: '#00ACC1', label:'Chamados' }]; charts.mReq.update(); }

    const det = { ass: {}, unit: {} };
    resolvedInMonth.forEach(t => { const addD = (o, k) => { if (!o[k]) o[k] = { count: 0, slaOk: 0, slaTot: 0, durSum: 0, durCount: 0 }; o[k].count++; if (t.deadline) { o[k].slaTot++; if (t.updated <= t.deadline) o[k].slaOk++; } const d = calculateBusinessTime(t.created, t.updated); if (d > 0) { o[k].durSum += d; o[k].durCount++; } }; if(t.assignee !== 'N/A') addD(det.ass, t.assignee); addD(det.unit, t.location); });
    const renderTable = (id, dataObj, type) => { const tbody = document.querySelector(`#${id} tbody`); if(!tbody) return; tbody.innerHTML = ""; Object.entries(dataObj).filter(([k]) => k !== 'N/A').sort((a, b) => b[1].count - a[1].count).forEach(([k, v]) => { const p = v.slaTot ? ((v.slaOk / v.slaTot) * 100).toFixed(1) : 0; const c = p >= 90 ? 'pill-success' : (p >= 70 ? 'pill-warning' : 'pill-danger'); tbody.innerHTML += `<tr><td><strong>${k}</strong></td><td>${v.count}</td><td class="clickable-cell" onclick="handleMetricClick('${k}', 'sla', '${type}')"><span class="status-pill ${c}">${p}%</span></td><td class="clickable-cell" onclick="handleMetricClick('${k}', 'tma', '${type}')">${formatDuration(v.durCount ? v.durSum/v.durCount : 0)}</td></tr>`; }); };
    renderTable('tableAssignee', det.ass, 'assignee'); renderTable('tableUnit', det.unit, 'unit');
    const uS = Object.entries(det.unit).filter(x => x[0] !== 'N/A').sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    if(charts.mUnits) { charts.mUnits.data.labels = uS.map(x => x[0]); charts.mUnits.data.datasets = [{ data: uS.map(x => x[1].count), backgroundColor: '#0055FF', label: 'Chamados' }]; charts.mUnits.update(); }
    updateStackedAnalystChart(charts.mAss, resolvedInMonth);
    updateUnitRequesterCharts(createdInMonth, 'mUnitChart');

    const topCC = getTop10(createdInMonth, 'ccusto');
    charts.mCCusto.data.labels = topCC.map(x => x[0]); charts.mCCusto.data.datasets = [{ data: topCC.map(x => x[1]), backgroundColor: '#7B1FA2', label: 'Chamados' }]; charts.mCCusto.update();
    const topRole = getTop10(createdInMonth, 'role');
    charts.mRole.data.labels = topRole.map(x => x[0]); charts.mRole.data.datasets = [{ data: topRole.map(x => x[1]), backgroundColor: '#E64A19', label: 'Chamados' }]; charts.mRole.update();
}

function handleChartClick(chartId, index, datasetIndex, chart) {
    const clickedLabel = chart.data.labels[index];
    const y = yearSelect.value;
    const m = monthSelect.value;
    const norm = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    let filtered = allTickets;
    const isMonthlyChart = [ 'monthly', 'mUnitChart', 'mCCusto', 'mRole', 'mReq', 'mCat' ].some(token => chartId.includes(token));
    if (isMonthlyChart) {
        const isDelivery = ['monthlySla', 'monthlyUnits', 'monthlyAssignee', 'mUnitChart'].some(t => chartId.includes(t));
        if (isDelivery) {
            filtered = allTickets.filter(t => {
                const s = t.status.toLowerCase(); 
                const isRes = ['resolvido','fechada','concluído','done'].some(x => s.includes(x));
                return isRes && !s.includes('cancelado') && t.updated && t.updated.getFullYear().toString() === y && (t.updated.getMonth() + 1).toString() === m;
            });
        } else {
            filtered = allTickets.filter(t => t.created && t.created.getFullYear().toString() === y && (t.created.getMonth() + 1).toString() === m);
        }
    }
    let drillTitle = `Detalhes: ${clickedLabel}`;
    if (chartId.includes('Status')) { filtered = filtered.filter(t => t.status === clickedLabel); drillTitle = `Status: ${clickedLabel}`; }
    else if (chartId.includes('Type')) { filtered = filtered.filter(t => t.type === clickedLabel); drillTitle = `Tipo: ${clickedLabel}`; }
    else if (chartId.includes('Category')) {
        if(clickedLabel === 'Demais Categorias' || clickedLabel === 'Categorias de baixo volume') { drillTitle = `${clickedLabel} (Lista)`; } 
        else { filtered = filtered.filter(t => t.category === clickedLabel); drillTitle = `Categoria: ${clickedLabel}`; }
    }
    else if (chartId.includes('Sla')) {
        const isOk = clickedLabel === 'No Prazo';
        filtered = filtered.filter(t => {
            if(!t.deadline) return false;
            const isRes = ['resolvido','fechada','concluído'].some(x => t.status.toLowerCase().includes(x));
            const ok = (isRes && t.updated <= t.deadline) || (!isRes && new Date() <= t.deadline);
            return isOk ? ok : !ok;
        });
        drillTitle = `SLA: ${clickedLabel}`;
    }
    else if (chartId === 'monthlyUnitsChart' || chartId === 'locationChart') {
        filtered = filtered.filter(t => t.location === clickedLabel);
        drillTitle = `Unidade: ${clickedLabel}`;
    }
    else if (chartId === 'monthlyAssigneeChart') { 
        const datasetLabel = chart.data.datasets[datasetIndex].label;
        if(datasetLabel && datasetLabel !== 'Total') {
            filtered = filtered.filter(t => t.assignee === clickedLabel && t.location === datasetLabel);
            drillTitle = `${clickedLabel} em ${datasetLabel}`;
        } else {
            filtered = filtered.filter(t => t.assignee === clickedLabel);
            drillTitle = `Analista: ${clickedLabel}`;
        }
    }
    else if (chartId === 'assigneeChart') { 
        filtered = filtered.filter(t => t.assignee === clickedLabel);
        drillTitle = `Analista: ${clickedLabel}`;
    }
    else if (chartId.includes('Requester')) {
        filtered = filtered.filter(t => t.reporter === clickedLabel);
        drillTitle = `Solicitante: ${clickedLabel}`;
    }
    else if (chartId.includes('CCusto')) {
        filtered = filtered.filter(t => t.ccusto === clickedLabel);
        drillTitle = `Centro de Custo: ${clickedLabel}`;
    }
    else if (chartId.includes('Role')) {
        filtered = filtered.filter(t => t.role === clickedLabel);
        drillTitle = `Função: ${clickedLabel}`;
    }
    else if (chartId.includes('UnitChart')) {
        filtered = filtered.filter(t => t.reporter === clickedLabel);
        let targetUnit = "";
        if(chartId.includes('Extrema')) targetUnit = "Extrema";
        else if(chartId.includes('Serra')) targetUnit = "Serra";
        else if(chartId.includes('Embu')) targetUnit = "Embu DCR";
        else if(chartId.includes('Vila')) targetUnit = "Vila Olímpia";
        else if(chartId.includes('Duque')) targetUnit = "Duque de Caxias";
        if(targetUnit) {
            const uNorm = norm(targetUnit);
            filtered = filtered.filter(t => {
                const locNorm = norm(t.location);
                return locNorm.includes(uNorm) || (targetUnit === "Vila Olímpia" && locNorm.includes("vila"));
            });
            drillTitle = `${clickedLabel} em ${targetUnit}`;
        } else {
            drillTitle = `${clickedLabel} em Outras`;
        }
    }
    else if (chartId === 'monthlyChart') {
        filtered = filtered.filter(t => t.created.getDate().toString() === clickedLabel);
        drillTitle = `Dia ${clickedLabel}`;
    }
    else if (chartId === 'trendChart') {
        const [tm, ty] = clickedLabel.split('/');
        const fullY = "20" + ty;
        filtered = allTickets.filter(t => t.created && t.created.getMonth()+1 == tm && t.created.getFullYear() == fullY);
        drillTitle = `Período: ${clickedLabel}`;
    }

    openDrillDown(filtered, drillTitle);
}

function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) { tabContents[i].classList.remove("active"); }
    const tabButtons = document.getElementsByClassName("tab-button");
    for (let i = 0; i < tabButtons.length; i++) { tabButtons[i].classList.remove("active"); }
    const target = document.getElementById(tabName);
    if (target) target.classList.add("active");
    if (evt && evt.currentTarget) evt.currentTarget.classList.add("active");
    setTimeout(() => { Object.values(charts).forEach(c => c && typeof c.resize === 'function' && c.resize()); }, 50);
}

function downloadCSV() { 
    if(!allTickets || allTickets.length === 0){ alert("Sem dados."); return; } 
    const h=["Criado,Status,Responsável,Tipo,Local,Resumo,ID,CCusto,Funcao"]; 
    const r=allTickets.map(t=>[`${t.created.toLocaleDateString()}`,t.status,t.assignee,t.type,t.location,`"${t.summary}"`,t.id,t.ccusto,t.role].join(',')); 
    const b=new Blob([h.concat(r).join('\n')],{type:"text/csv"}); 
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="export_dashboard.csv"; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

let fsIdx=0, fsChart=null;
const fsTitles = {
    0: "Volume de Aberturas (Mensal)", 1: "SLA (Entregas)", 2: "Backlog (Status do Mês)", 3: "Tipos (Demanda)", 
    4: "Top Unidades (Entregas)", 5: "Analistas x Unidade (Entregas)", 
    8: "Evolução de Chamados (Histórico)", 9: "Demandas por Unidade", 10: "Top Analistas (Volume)", 
    12: "Cumprimento de Prazos", 13: "Distribuição por Status", 
    14: "Categorias (Mês)", 15: "Top Solicitantes (Mês)", 16: "Categorias (Geral)", 
    17: "Top Centros de Custo (Mês)", 18: "Top Funções (Mês)", 
    19: "Top Centros de Custo (Geral)", 20: "Top Funções (Geral)",
    21: "Extrema (Mensal)", 22: "Serra (Mensal)", 23: "Embu DCR (Mensal)", 24: "Vila Olímpia (Mensal)", 25: "Duque de Caxias (Mensal)", 26: "Outras (Mensal)",
    27: "Top Solicitantes (Geral)",
    28: "Extrema (Geral)", 29: "Serra (Geral)", 30: "Embu DCR (Geral)", 31: "Vila Olímpia (Geral)", 32: "Duque de Caxias (Geral)", 33: "Outras (Geral)",
    34: "Extrema (Equipe)", 35: "Serra (Equipe)", 36: "Embu DCR (Equipe)", 37: "Vila Olímpia (Equipe)", 38: "Duque de Caxias (Equipe)", 39: "Outras (Equipe)"
};

const chartGroups = {
    'mensal': [0, 1, 2, 3, 4, 14, 15, 17, 18, 5, 21, 22, 23, 24, 25, 26],
    'geral': [8, 27, 19, 20, 28, 29, 30, 31, 32, 33],
    'equipe': [9, 10, 16, 34, 35, 36, 37, 38, 39],
    'status': [12, 13]
};

function getChartByIndex(i) {
    const map = { 
        0: charts.mVol, 1: charts.mSla, 2: charts.mStatus, 3: charts.mType, 4: charts.mUnits, 5: charts.mAss, 
        8: charts.trend, 9: charts.loc, 10: charts.ass, 
        12: charts.sla, 13: charts.status, 
        14: charts.mCat, 15: charts.mReq, 16: charts.cat, 
        17: charts.mCCusto, 18: charts.mRole, 19: charts.gCCusto, 20: charts.gRole,
        21: charts.mUnitChartExtrema, 22: charts.mUnitChartSerra, 23: charts.mUnitChartEmbu, 24: charts.mUnitChartVila, 25: charts.mUnitChartDuque, 26: charts.mUnitChartOther,
        27: charts.reqGlobal,
        28: charts.gUnitChartExtrema, 29: charts.gUnitChartSerra, 30: charts.gUnitChartEmbu, 31: charts.gUnitChartVila, 32: charts.gUnitChartDuque, 33: charts.gUnitChartOther,
        34: charts.unitChartExtrema, 35: charts.unitChartSerra, 36: charts.unitChartEmbu, 37: charts.unitChartVila, 38: charts.unitChartDuque, 39: charts.unitChartOther
    };
    return map[i];
}

function openFullscreenMode(i) { 
    fsIdx = i; 
    document.getElementById('fsModal').classList.add('open'); 
    renderFs(); 
}

function closeFullscreenMode() { document.getElementById('fsModal').classList.remove('open'); }

function changeFullscreenChart(d) { 
    let currentGroup = null;
    for (const groupName in chartGroups) {
        if (chartGroups[groupName].includes(fsIdx)) {
            currentGroup = chartGroups[groupName];
            break;
        }
    }
    if (!currentGroup) {
        if(fsIdx === 6 || fsIdx === 7) return; 
        fsIdx += d; 
    } else {
        const currentIndexInGroup = currentGroup.indexOf(fsIdx);
        const newIndexInGroup = currentIndexInGroup + d;
        if (newIndexInGroup >= 0 && newIndexInGroup < currentGroup.length) {
            fsIdx = currentGroup[newIndexInGroup];
        }
    }
    renderFs(); 
}

function renderFs() {
    document.getElementById('fsChartTitle').innerText = fsTitles[fsIdx] || "Detalhe";
    const cvsWrap = document.getElementById('fsCanvasWrapper'); 
    const tblWrap = document.getElementById('fsTableWrapper');
    const prevBtn = document.querySelector('.fs-prev');
    const nextBtn = document.querySelector('.fs-next');
    let currentGroup = null;
    for (const groupName in chartGroups) { if (chartGroups[groupName].includes(fsIdx)) { currentGroup = chartGroups[groupName]; break; } }
    
    if (currentGroup) {
        const idxInGroup = currentGroup.indexOf(fsIdx);
        prevBtn.style.opacity = idxInGroup === 0 ? '0.3' : '1';
        prevBtn.style.pointerEvents = idxInGroup === 0 ? 'none' : 'auto';
        nextBtn.style.opacity = idxInGroup === currentGroup.length - 1 ? '0.3' : '1';
        nextBtn.style.pointerEvents = idxInGroup === currentGroup.length - 1 ? 'none' : 'auto';
        prevBtn.style.display = 'block'; nextBtn.style.display = 'block';
    } else {
        prevBtn.style.display = 'none'; nextBtn.style.display = 'none';
    }

    if(fsIdx !== 6 && fsIdx !== 7) {
        cvsWrap.style.display = 'block'; tblWrap.classList.remove('active');
        const targetChart = getChartByIndex(fsIdx);
        if(targetChart) {
            const ctx = document.getElementById('fsCanvas'); if(fsChart) fsChart.destroy();
            const isLight = document.body.classList.contains('light-mode'); 
            const fsColor = isLight ? '#000000' : '#FFFFFF';
            const cfg = { 
                type: targetChart.config.type, 
                data: JSON.parse(JSON.stringify(targetChart.config.data)), 
                options: { 
                    ...targetChart.config.options, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        ...targetChart.config.options.plugins, 
                        legend: { display: true, position: 'bottom', labels: { color: fsColor, filter: (i)=>i.text!=='Total', font: { size: 14 } } },
                        datalabels: { ...targetChart.config.options.plugins.datalabels, font: { size: 14 } }
                    }, 
                    layout: { padding: 20 },
                    scales: targetChart.config.options.scales,
                    onClick: (evt, elements, chart) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const datasetIndex = elements[0].datasetIndex;
                            handleChartClick(targetChart.canvas.id, index, datasetIndex, chart);
                        }
                    }
                } 
            };
            if (!isLight && cfg.options.scales) {
                if (cfg.options.scales.x) { cfg.options.scales.x.ticks = { ...cfg.options.scales.x.ticks, color: '#FFF' }; cfg.options.scales.x.grid = { ...cfg.options.scales.x.grid, color: '#444' }; }
                if (cfg.options.scales.y) { cfg.options.scales.y.ticks = { ...cfg.options.scales.y.ticks, color: '#FFF' }; cfg.options.scales.y.grid = { ...cfg.options.scales.y.grid, color: '#444' }; }
            }
            if(fsIdx === 5) { cfg.options.plugins.sideLabels = window.sideLabelsPlugin; }
            fsChart = new Chart(ctx, cfg);
        }
    } else { 
        if(fsChart) fsChart.destroy(); 
        cvsWrap.style.display = 'none'; tblWrap.classList.add('active'); 
        const srcId = fsIdx === 6 ? 'tableAssignee' : 'tableUnit'; 
        document.getElementById('fsTable').innerHTML = document.getElementById(srcId).innerHTML; 
    }
}
document.addEventListener('keydown', e => { if(document.getElementById('fsModal').classList.contains('open')) { if(e.key=='ArrowLeft')changeFullscreenChart(-1); if(e.key=='ArrowRight')changeFullscreenChart(1); if(e.key=='Escape')closeFullscreenMode(); } });

let currentDrillData = []; let drillPage = 1; const DRILL_PER_PAGE = 10;
function openDrillDown(data, title) { currentDrillData = data; drillPage = 1; document.getElementById('ddTitle').innerText = title; document.getElementById('drillDownModal').classList.add('open'); renderDrillDownTable(); }
function closeDrillDown() { document.getElementById('drillDownModal').classList.remove('open'); }
function changeDrillDownPage(d) { const maxPage = Math.ceil(currentDrillData.length / DRILL_PER_PAGE) || 1; drillPage += d; if (drillPage < 1) drillPage = 1; if (drillPage > maxPage) drillPage = maxPage; renderDrillDownTable(); }
function renderDrillDownTable() {
    const tbody = document.querySelector('#ddTable tbody'); tbody.innerHTML = '';
    const total = currentDrillData.length; const maxPage = Math.ceil(total / DRILL_PER_PAGE) || 1;
    const start = (drillPage - 1) * DRILL_PER_PAGE; const end = start + DRILL_PER_PAGE;
    const pageData = currentDrillData.slice(start, end);
    document.getElementById('pageInfo').innerText = `Página ${drillPage} de ${maxPage} (${total} registros)`;
    document.getElementById('btnPrev').disabled = drillPage === 1;
    document.getElementById('btnNext').disabled = drillPage === maxPage;
    pageData.forEach(t => {
        const tr = document.createElement('tr');
        let slaBadge = '<span class="status-pill pill-gray">-</span>';
        if(t.deadline) {
            const isRes = ['resolvido','fechada','concluído'].some(x => t.status.toLowerCase().includes(x));
            const isOk = (isRes && t.updated <= t.deadline) || (!isRes && new Date() <= t.deadline);
            slaBadge = isOk ? '<span class="status-pill pill-success">No Prazo</span>' : '<span class="status-pill pill-danger">Atrasado</span>';
        }
        tr.innerHTML = `<td>${t.id}</td><td>${t.summary}</td><td>${t.status}</td><td>${t.assignee}</td><td>${slaBadge}</td>`;
        tbody.appendChild(tr);
    });
}

function updateChartTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const txtC = isLight ? '#000000' : '#FFFFFF'; 
    const gridC = isLight ? '#DADCE0' : '#444'; 
    Chart.defaults.color = txtC;
    Chart.defaults.borderColor = gridC;
    Object.values(charts).forEach(c => {
        if (!c) return;
        if (c.options.scales) {
            if (c.options.scales.x) { c.options.scales.x.grid.color = gridC; c.options.scales.x.ticks.color = txtC; }
            if (c.options.scales.y) { c.options.scales.y.grid.color = gridC; c.options.scales.y.ticks.color = txtC; }
        }
        if (c.options.plugins && c.options.plugins.legend) { c.options.plugins.legend.labels.color = txtC; }
        c.update();
    });
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('themeIcon').innerText = isLight ? '🌙' : '☀️';
    updateChartTheme();
}

function handleMetricClick(label, metricType, context) { console.log(`Clique em métrica: ${label}, ${metricType}, ${context}`); }

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initCharts, 100);
    setTimeout(loadFromGoogle, 500);
});