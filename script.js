function logMsg(msg, isError=false) { 
    const el = document.getElementById('statusLog'); 
    el.style.display='block'; 
    el.style.backgroundColor=isError?'#f8d7da':'#d1e7dd'; 
    el.style.color=isError?'#721c24':'#0f5132'; 
    el.style.borderColor=isError?'#f5c6cb':'#badbcc';
    el.innerText=msg; 
    setTimeout(() => { if(!isError) el.style.display='none'; }, 5000);
}

const distinctColors = ['#0055FF', '#D32F2F', '#00C853', '#F57C00', '#7B1FA2', '#00ACC1', '#C2185B', '#AFB42B', '#5D4037', '#616161', '#455A64', '#E64A19', '#512DA8', '#1976D2', '#388E3C', '#FBC02D', '#8E24AA', '#0288D1', '#689F38', '#E91E63'];

const EXCLUDED_ANALYSTS = [
    'Caíque Ferreira Batista', 
    'JEFERSON PITINGA NOGUEIRA', 
    'Automation for Jira', 
    'Vinicius Augusto Macedo Silva'
];

const sideLabelsPlugin = {
    id: 'sideLabels',
    afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart; const padding=5; const lineLength=10; const textPadding=3;
        const isLight = document.body.classList.contains('light-mode');
        const textColor = isLight ? '#000000' : '#FFFFFF';
        const meta0 = chart.getDatasetMeta(0);
        if(!meta0 || !meta0.data.length) return;
        meta0.data.forEach((barPoint, dataIndex) => {
            let stackRightEdge = barPoint.x + barPoint.width / 2;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (dataset.type==='line' || dataset.data[dataIndex]===0 || dataset.label==='Total') return;
                const meta = chart.getDatasetMeta(datasetIndex); 
                if(meta.hidden) return;
                const element = meta.data[dataIndex];
                if(!element) return;
                const segmentCenterY = element.getCenterPoint().y;
                const startX = stackRightEdge + padding; const endX = startX + lineLength; const textX = endX + textPadding;
                ctx.save(); ctx.beginPath(); ctx.strokeStyle = dataset.backgroundColor; ctx.lineWidth = 1;
                ctx.moveTo(startX, segmentCenterY); ctx.lineTo(endX, segmentCenterY); ctx.stroke();
                ctx.font = 'bold 10px Montserrat'; ctx.fillStyle = textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText(dataset.data[dataIndex], textX, segmentCenterY); ctx.restore();
            });
        });
    }
};

try {
    if(typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        Chart.defaults.set('plugins.datalabels', { color: '#E0E0E0', font: { weight: 'bold' }, formatter: Math.round, display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0, anchor: 'end', align: 'end' });
    }
    Chart.defaults.font.family = "'Montserrat', sans-serif";
} catch(e) { logMsg("Erro Init: " + e.message, true); }

let allTickets = [], monthlyData = {}, charts = {};

function initCharts() {
    const createChart = (id, type, cfg) => {
        const ctx = document.getElementById(id); if(!ctx) return null;
        const defaultPadding = (type === 'pie' || type === 'doughnut') 
            ? { padding: 20 } 
            : { padding: { top: 30, right: 35, left: 10, bottom: 10 } }; 
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
                scales: (type!=='pie'&&type!=='doughnut')?{x:{grid:{color:'#333'}},y:{grid:{color:'#333'}}}:{}, 
                onClick: onClickHandler, ...cfg 
            } 
        });
    };
    
    const outsideLabelsConfig = { position: 'bottom', labels: { color: '#E0E0E0' } };

    charts.trend = createChart('trendChart', 'line', {});
    charts.loc = createChart('locationChart', 'bar', {});
    charts.ass = createChart('assigneeChart', 'bar', { indexAxis:'y' });
    charts.type = createChart('typeChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.sla = createChart('slaChart', 'doughnut', { cutout:'65%', plugins: { legend: outsideLabelsConfig } });
    charts.status = createChart('statusChart', 'bar', {});
    charts.mVol = createChart('monthlyChart', 'line', {});
    charts.mSla = createChart('monthlySlaChart', 'doughnut', { cutout:'65%', plugins: { legend: outsideLabelsConfig } });
    charts.mUnits = createChart('monthlyUnitsChart', 'bar', { indexAxis:'y' });
    charts.mStatus = createChart('monthlyStatusChart', 'bar', {});
    charts.mType = createChart('monthlyTypeChart', 'pie', { plugins: { legend: outsideLabelsConfig } });
    charts.mAss = createChart('monthlyAssigneeChart', 'bar', { 
        scales:{ x:{stacked:true}, y:{stacked:true} }, 
        plugins:{ legend:{ display:true, position:'bottom', labels:{ filter: (i)=>i.text!=='Total' } }, sideLabels: sideLabelsPlugin }, 
        layout: { padding: { top: 30, right: 50, left: 10, bottom: 10 } } 
    });
    updateChartTheme();
}

function handleFileSelect(evt) { 
    const file = evt.target.files[0]; 
    if(!file) return; 
    if(file.lastModified) {
        const fileDate = new Date(file.lastModified);
        document.getElementById('currentDate').innerText = fileDate.toLocaleString('pt-BR');
    } else {
        document.getElementById('currentDate').innerText = new Date().toLocaleString('pt-BR');
    }
    const r = new FileReader(); 
    r.onload=(e)=>processCSV(e.target.result); 
    r.readAsText(file); 
}

function loadAutoCSV() { fetch('dados.csv').then(r=>{if(!r.ok)throw new Error();return r.text();}).then(t=>{logMsg("Dados carregados."); processCSV(t, true);}).catch(e=>logMsg("Modo Local. Use o botão Importar.")); }

function processCSV(text, isAuto=false) {
    if(!text) return;
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.replace(/"/g,'').trim().toLowerCase());
    
    const map = { 
        created: headers.findIndex(h=>h.includes('criado')||h.includes('created')), 
        updated: headers.findIndex(h=>h.includes('atualizado')||h.includes('updated')), 
        deadline: headers.findIndex(h=>h.includes('limite')||h.includes('due')), 
        status: headers.findIndex(h=>h.includes('status')), 
        assignee: headers.findIndex(h=>h.includes('responsável')||h.includes('assignee')), 
        type: headers.findIndex(h=>h.includes('tipo')||h.includes('type')), 
        loc: headers.findIndex(h=>h.includes('campo')||h.includes('local')),
        id: headers.findIndex(h=>h.includes('chave')||h.includes('issue id')||h.includes('key')||h.includes('número')),
        summary: headers.findIndex(h=>h.includes('resumo')||h.includes('summary')||h.includes('título'))
    };

    if(map.created===-1||map.status===-1){logMsg("CSV Inválido (Colunas não encontradas)",true);return;}
    const data = [];
    let maxDate = 0;

    for(let i=1; i<lines.length; i++) {
        let row = sep === ';' ? lines[i].split(';') : lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(row.length < headers.length) continue;
        const clean = (x) => x ? x.replace(/"/g,'').trim() : 'N/A';
        const parseDt = (s) => { if(!s)return null; let c=clean(s).split(' '); let dp=c[0],tp=c[1]||"00:00"; let d,m,y; if(dp.includes('/'))[d,m,y]=dp.split('/').map(Number); else if(dp.includes('-'))[y,m,d]=dp.split('-').map(Number); else return null; if(y<100)y+=2000; let [h,min]=tp.split(':').map(Number); if(c.includes('PM')&&h<12)h+=12; if(c.includes('AM')&&h===12)h=0; const dt=new Date(y,m-1,d,h,min); return isNaN(dt)?null:dt; };
        
        const cDt = parseDt(row[map.created]);
        const uDt = parseDt(row[map.updated]);
        
        if(isAuto) {
            if(cDt && cDt.getTime() > maxDate) maxDate = cDt.getTime();
            if(uDt && uDt.getTime() > maxDate) maxDate = uDt.getTime();
        }

        if(cDt) {
            data.push({ 
                created: cDt, updated: uDt, deadline: parseDt(row[map.deadline]), status: clean(row[map.status]), 
                assignee: clean(row[map.assignee])||'N/A', type: clean(row[map.type]), 
                location: map.loc>-1?clean(row[map.loc]):'Geral',
                id: map.id > -1 ? clean(row[map.id]) : `REQ-${i}`,
                summary: map.summary > -1 ? clean(row[map.summary]) : 'Sem resumo'
            });
        }
    }

    if(isAuto && maxDate > 0) {
        document.getElementById('currentDate').innerText = new Date(maxDate).toLocaleString('pt-BR');
    } else if (isAuto) {
        document.getElementById('currentDate').innerText = new Date().toLocaleString('pt-BR');
    }

    allTickets = data; recalculateKPIs(data);
    logMsg(`Sucesso! ${data.length} registros carregados.`);
}

function calculateBusinessTime(start, end) {
    if (start >= end) return 0;
    const startHour = 8; const endHour = 18;
    let totalMs = 0;
    let current = new Date(start);

    while (current < end) {
        const day = current.getDay();
        if (day === 0 || day === 6) {
            current.setHours(0,0,0,0); current.setDate(current.getDate() + 1); continue;
        }
        const workStart = new Date(current); workStart.setHours(startHour, 0, 0, 0);
        const workEnd = new Date(current); workEnd.setHours(endHour, 0, 0, 0);

        if (current >= workEnd) {
            current.setHours(0,0,0,0); current.setDate(current.getDate() + 1); continue;
        }
        if (current < workStart) current = workStart;
        
        let effectiveEnd = new Date(Math.min(end, workEnd));
        if (effectiveEnd > current) totalMs += (effectiveEnd - current);
        
        current.setDate(current.getDate() + 1); current.setHours(0, 0, 0, 0);
    }
    return totalMs;
}

function formatDuration(ms) { 
    if(!ms||ms<0)return "-"; 
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 10); 
    const remHours = hours % 10;
    return days > 0 ? `${days}d ${remHours}h` : `${hours}h`; 
}

function recalculateKPIs(data) {
    const s = {trend:{},loc:{},ass:{},type:{},status:{},slaOk:0,slaTot:0,durSum:0,durCount:0};
    data.forEach(t => {
        const k = `${String(t.created.getMonth()+1).padStart(2,'0')}/${t.created.getFullYear().toString().substr(2)}`;
        s.trend[k]=(s.trend[k]||0)+1; s.loc[t.location]=(s.loc[t.location]||0)+1; s.ass[t.assignee]=(s.ass[t.assignee]||0)+1; s.type[t.type]=(s.type[t.type]||0)+1; s.status[t.status]=(s.status[t.status]||0)+1;
        
        const statusLower = t.status.toLowerCase();
        const isRes = ['resolvido','fechada','concluído','done','fechado'].includes(statusLower);
        const isCanc = statusLower.includes('cancelado');

        if(t.deadline && !isCanc) { 
            s.slaTot++; 
            if((isRes&&t.updated<=t.deadline)||(!isRes&&new Date()<=t.deadline)) s.slaOk++; 
        }
        
        if(isRes && t.updated && !isCanc) { 
            const d = calculateBusinessTime(t.created, t.updated); 
            if(d>0){ s.durSum+=d; s.durCount++; } 
        }
    });
    
    document.getElementById('kpiTotal').innerText = data.length; 
    
    const slaVal = s.slaTot ? ((s.slaOk/s.slaTot)*100) : 0;
    const elKpiSla = document.getElementById('kpiSLA');
    elKpiSla.innerText = s.slaTot ? slaVal.toFixed(1)+"%" : "-";
    elKpiSla.className = 'kpi-value ' + (slaVal >= 70 ? 'text-warning' : 'text-danger');
    if(slaVal >= 90) elKpiSla.className = 'kpi-value text-success';

    document.getElementById('kpiSMA').innerText = s.durCount?formatDuration(s.durSum/s.durCount):"-";
    const topL = Object.entries(s.loc).sort((a,b)=>b[1]-a[1])[0]; document.getElementById('kpiLocation').innerText = topL?topL[0]:"-";
    
    const updateC = (k,l,d,p={}) => { charts[k].data.labels=l; charts[k].data.datasets=[{data:d,backgroundColor:p.bg||'#8680b1',borderColor:p.bd||'#8680b1',fill:p.fill||false}]; if(p.multi)charts[k].data.datasets[0].backgroundColor=p.bg; charts[k].update(); };
    const tK = Object.keys(s.trend).sort((a,b)=>{const[m1,y1]=a.split('/');const[m2,y2]=b.split('/');return y1==y2?m1-m2:y1-y2;}); updateC('trend',tK,tK.map(k=>s.trend[k]),{bg:'rgba(134,128,177,0.2)',fill:true});
    
    // FILTROS VISUAIS (Demandas por Unidade e Top Analistas)
    const sL = Object.entries(s.loc).filter(x => x[0] !== 'N/A').sort((a,b)=>b[1]-a[1]); 
    updateC('loc',sL.map(x=>x[0]),sL.map(x=>x[1]),{bg:'#0055FF'});
    
    // Filtro de Analistas: Exclui N/A, Desligados e com < 3 chamados
    const sA = Object.entries(s.ass)
        .filter(x => x[0] !== 'N/A' && !EXCLUDED_ANALYSTS.includes(x[0]) && x[1] >= 3)
        .sort((a,b)=>b[1]-a[1]).slice(0,10); 
    updateC('ass',sA.map(x=>x[0]),sA.map(x=>x[1]));
    
    updateC('type',Object.keys(s.type),Object.values(s.type),{multi:true,bg:distinctColors}); updateC('sla',['No Prazo','Fora'],[s.slaOk,s.slaTot-s.slaOk],{multi:true,bg:['#00C853','#FF5252']}); updateC('status',Object.keys(s.status),Object.values(s.status),{multi:true,bg:['#00C853','#455A64','#9E9E9E','#8680b1','#546E7A']});
    
    monthlyData={}; data.forEach(t=>{ const y=t.created.getFullYear().toString(); const m=(t.created.getMonth()+1).toString(); if(!monthlyData[y])monthlyData[y]={}; if(!monthlyData[y][m])monthlyData[y][m]=[]; monthlyData[y][m].push(t); });
    
    calculateTeamInsights(data);
    initMonthlyTab();
    updateChartTheme();
}

// --- INSIGHTS DE EQUIPE ---
function calculateTeamInsights(data) {
    const grid = document.getElementById('team-insights-grid');
    grid.innerHTML = "";

    const analystStats = {};
    let teamTotalTickets = 0;
    let teamTotalSlaOk = 0;
    let teamTotalSlaCount = 0;
    let teamTotalDur = 0;
    let teamTotalDurCount = 0;

    data.forEach(t => {
        const isRes = ['resolvido','fechada','concluído','done','fechado'].includes(t.status.toLowerCase());
        const isCanc = t.status.toLowerCase().includes('cancelado');
        if(!isRes || isCanc || !t.assignee || t.assignee === 'N/A' || EXCLUDED_ANALYSTS.includes(t.assignee)) return;

        if(!analystStats[t.assignee]) analystStats[t.assignee] = { count: 0, slaOk: 0, slaTot: 0, durSum: 0, durCount: 0 };
        analystStats[t.assignee].count++;
        teamTotalTickets++;

        if(t.deadline) {
            analystStats[t.assignee].slaTot++;
            teamTotalSlaCount++;
            if(t.updated <= t.deadline) {
                analystStats[t.assignee].slaOk++;
                teamTotalSlaOk++;
            }
        }
        const d = calculateBusinessTime(t.created, t.updated);
        if(d > 0) {
            analystStats[t.assignee].durSum += d;
            analystStats[t.assignee].durCount++;
            teamTotalDur += d;
            teamTotalDurCount++;
        }
    });

    const avgVol = Object.keys(analystStats).length ? teamTotalTickets / Object.keys(analystStats).length : 0;
    const avgSla = teamTotalSlaCount ? (teamTotalSlaOk / teamTotalSlaCount) * 100 : 0;
    const avgTma = teamTotalDurCount ? teamTotalDur / teamTotalDurCount : 0;

    Object.entries(analystStats).sort((a,b) => b[1].count - a[1].count).forEach(([name, s]) => {
        const sla = s.slaTot ? (s.slaOk / s.slaTot) * 100 : 0;
        const tma = s.durCount ? s.durSum / s.durCount : 0;
        let strength = ""; let weakness = ""; let action = "";

        if (sla > 90 && s.count > avgVol * 0.8) strength = "Alta confiabilidade e precisão técnica.";
        else if (s.count > avgVol * 1.2) strength = "Alta capacidade de vazão (Volume).";
        else if (tma < avgTma * 0.8) strength = "Agilidade na resolução de incidentes.";
        else strength = "Consistência operacional.";

        if (sla < 75) { weakness = "Cumprimento de SLA (Prazos)."; action = "Revisar fila de pendências e priorizar vencimentos."; }
        else if (tma > avgTma * 1.3) { weakness = "Tempo de atendimento elevado."; action = "Avaliar necessidade de treinamento ou escalonamento."; }
        else if (s.count < avgVol * 0.5) { weakness = "Baixo volume de entregas."; action = "Assumir tickets de backlog ou tarefas preventivas."; }
        else { weakness = "Nenhum ponto crítico detectado."; action = "Manter monitoramento de qualidade."; }

        const cardHTML = `
            <div class="insight-card">
                <div class="ic-header"><span class="ic-name">${name}</span></div>
                <div class="ic-metrics"><span>Vol: ${s.count}</span><span>SLA: ${sla.toFixed(0)}%</span><span>TMA: ${formatDuration(tma)}</span></div>
                <div class="ic-section"><span class="ic-label ic-strong">Ponto Forte</span>${strength}</div>
                <div class="ic-section"><span class="ic-label ic-weak">Ponto de Atenção</span>${weakness}</div>
                <div class="ic-section"><span class="ic-label ic-action">Plano de Ação</span>${action}</div>
            </div>
        `;
        grid.innerHTML += cardHTML;
    });
}

const yearSelect = document.getElementById('yearSelect'), monthSelect = document.getElementById('monthSelect'), mNames = {"1":"Janeiro","2":"Fevereiro","3":"Março","4":"Abril","5":"Maio","6":"Junho","7":"Julho","8":"Agosto","9":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
function initMonthlyTab() { yearSelect.innerHTML=""; const ys=Object.keys(monthlyData).sort(); if(!ys.length)return; ys.forEach(y=>yearSelect.add(new Option(y,y))); yearSelect.value=ys[ys.length-1]; updateMonthSelect(); }
function updateMonthSelect() { monthSelect.innerHTML=""; const y=yearSelect.value; if(!monthlyData[y])return; const ms=Object.keys(monthlyData[y]).sort((a,b)=>a-b); ms.forEach(m=>monthSelect.add(new Option(mNames[m],m))); monthSelect.value=ms[ms.length-1]; updateMonthlyView(); }

function updateMonthlyView() {
    const y = yearSelect.value;
    const m = monthSelect.value;
    const createdInMonth = monthlyData[y] && monthlyData[y][m] ? monthlyData[y][m] : [];
    
    // Filtro principal: Remove CANCELADOS das análises de performance
    const resolvedInMonth = allTickets.filter(t => {
        if (!t.updated) return false;
        const statusLower = t.status.toLowerCase();
        const isRes = ['resolvido', 'fechada', 'concluído', 'done', 'fechado'].includes(statusLower);
        const isCanc = statusLower.includes('cancelado');
        if (!isRes || isCanc) return false;
        
        return t.updated.getFullYear().toString() === y && (t.updated.getMonth() + 1).toString() === m;
    });

    const s = { slaOk: 0, slaTot: 0, durSum: 0, durCount: 0, unit: {}, ass: {}, matrix: {} };
    const det = { ass: {}, unit: {} };

    resolvedInMonth.forEach(t => {
        s.unit[t.location] = (s.unit[t.location] || 0) + 1;
        s.ass[t.assignee] = (s.ass[t.assignee] || 0) + 1;
        if (!s.matrix[t.assignee]) s.matrix[t.assignee] = {};
        s.matrix[t.assignee][t.location] = (s.matrix[t.assignee][t.location] || 0) + 1;

        const addD = (o, k) => {
            if (!o[k]) o[k] = { count: 0, slaOk: 0, slaTot: 0, durSum: 0, durCount: 0 };
            o[k].count++;
            if (t.deadline) { o[k].slaTot++; if (t.updated <= t.deadline) o[k].slaOk++; }
            const d = calculateBusinessTime(t.created, t.updated);
            if (d > 0) { o[k].durSum += d; o[k].durCount++; }
        };
        addD(det.ass, t.assignee);
        addD(det.unit, t.location);

        if (t.deadline) { s.slaTot++; if (t.updated <= t.deadline) s.slaOk++; }
        const dur = calculateBusinessTime(t.created, t.updated);
        if (dur > 0) { s.durSum += dur; s.durCount++; }
    });

    const elTotal = document.getElementById('monthlyTotal');
    const elSLA = document.getElementById('monthlySLA');
    const elSMA = document.getElementById('monthlySMA');
    
    elTotal.innerText = resolvedInMonth.length;
    elTotal.className = 'kpi-value text-normal'; 
    const slaVal = s.slaTot ? (s.slaOk / s.slaTot) * 100 : 0;
    elSLA.innerText = s.slaTot ? slaVal.toFixed(1) + "%" : "-";
    elSLA.className = 'kpi-value ' + (slaVal >= 70 ? 'text-warning' : 'text-danger'); 
    if(slaVal >= 90) elSLA.className = 'kpi-value text-success'; 
    elSMA.innerText = s.durCount ? formatDuration(s.durSum / s.durCount) : "-";
    elSMA.className = 'kpi-value text-success'; 

    const sVol = {};
    createdInMonth.forEach(t => { const d = t.created.getDate(); sVol[d] = (sVol[d] || 0) + 1; });
    const dK = Object.keys(sVol).sort((a, b) => a - b);
    charts.mVol.data.labels = dK;
    charts.mVol.data.datasets = [{ data: dK.map(k => sVol[k]), borderColor: '#8680b1', backgroundColor: 'rgba(134,128,177,0.2)', fill: true, label: 'Abertos' }];
    charts.mVol.update();

    charts.mSla.data.labels = ['No Prazo', 'Fora'];
    charts.mSla.data.datasets = [{ data: [s.slaOk, s.slaTot - s.slaOk], backgroundColor: ['#00C853', '#FF5252'] }];
    charts.mSla.update();

    const sStatus = {};
    createdInMonth.forEach(t => { sStatus[t.status] = (sStatus[t.status] || 0) + 1; });
    charts.mStatus.data.labels = Object.keys(sStatus);
    charts.mStatus.data.datasets = [{ data: Object.values(sStatus), backgroundColor: ['#00C853', '#8680b1', '#FF5252', '#0055FF'] }];
    charts.mStatus.update();

    const sType = {};
    createdInMonth.forEach(t => { sType[t.type] = (sType[t.type] || 0) + 1; });
    charts.mType.data.labels = Object.keys(sType);
    charts.mType.data.datasets = [{ data: Object.values(sType), backgroundColor: distinctColors }];
    charts.mType.update();

    const uS = Object.entries(s.unit)
        .filter(x => x[0] !== 'N/A') // Filtro N/A também no gráfico mensal
        .sort((a, b) => b[1] - a[1]).slice(0, 5);
    charts.mUnits.data.labels = uS.map(x => x[0]);
    charts.mUnits.data.datasets = [{ data: uS.map(x => x[1]), backgroundColor: '#0055FF' }];
    charts.mUnits.update();

    const topA = Object.entries(s.ass)
        .filter(([k, v]) => k !== 'N/A') // Filtra N/A
        .sort((a, b) => b[1] - a[1]).map(x => x[0]);
    
    let allU = new Set();
    topA.forEach(a => Object.keys(s.matrix[a] || {}).forEach(u => allU.add(u)));
    const unitDS = Array.from(allU).map((u, i) => ({
        label: u, type: 'bar', stack: 'combined', backgroundColor: distinctColors[i % distinctColors.length],
        data: topA.map(a => s.matrix[a][u] || 0), datalabels: { display: false }
    }));
    const totalDS = {
        label: 'Total', type: 'line', data: topA.map(a => s.ass[a]),
        backgroundColor: 'transparent', borderColor: 'transparent', pointRadius: 0,
        datalabels: { display: true, align: 'end', anchor: 'end', offset: -5, color: document.body.classList.contains('light-mode') ? '#000000' : '#FFFFFF', font: { weight: 'bold', size: 12 }, formatter: (v) => v }
    };
    charts.mAss.data.labels = topA;
    charts.mAss.data.datasets = [...unitDS, totalDS];
    charts.mAss.update();

    const renderTable = (id, dataObj, type) => {
        const tbody = document.querySelector(`#${id} tbody`);
        tbody.innerHTML = "";
        const entries = Object.entries(dataObj).filter(([k,v]) => k !== 'N/A').sort((a, b) => b[1].count - a[1].count);
        
        entries.forEach(([k, v]) => {
            const p = v.slaTot ? ((v.slaOk / v.slaTot) * 100).toFixed(1) : 0;
            const tmaVal = v.durCount ? (v.durSum / v.durCount) : 0;
            const c = p >= 70 ? 'sla-ok' : 'sla-nok';
            
            let rowHtml = `<tr><td><strong>${k}</strong></td><td>${v.count}</td>`;
            rowHtml += `<td class="clickable-cell" onclick="handleMetricClick('${k}', 'sla', '${type}')"><span class="sla-badge ${c}">${p}%</span></td>`;
            rowHtml += `<td class="clickable-cell" onclick="handleMetricClick('${k}', 'tma', '${type}')">${formatDuration(tmaVal)}</td>`;
            
            // REMOVIDO: Colunas de Diagnóstico e Ação para ficar igual ao painel da foto
            rowHtml += `</tr>`;
            tbody.innerHTML += rowHtml;
        });
    };
    renderTable('tableAssignee', det.ass, 'assignee'); 
    renderTable('tableUnit', det.unit, 'unit');
}

function handleMetricClick(entityName, metricType, entityType) {
    const y = yearSelect.value;
    const m = monthSelect.value;
    
    let tickets = allTickets.filter(t => {
        const statusLower = t.status.toLowerCase();
        const isRes = ['resolvido','fechada','concluído','done','fechado'].includes(statusLower);
        const isCanc = statusLower.includes('cancelado');
        return isRes && !isCanc && t.updated && t.updated.getFullYear().toString() === y && (t.updated.getMonth() + 1).toString() === m;
    });

    if (entityType === 'assignee') tickets = tickets.filter(t => t.assignee === entityName);
    else tickets = tickets.filter(t => t.location === entityName);

    let title = "";
    
    if (metricType === 'sla') {
        title = `Chamados fora do Prazo - ${entityName}`;
        tickets = tickets.filter(t => { if(!t.deadline) return false; return t.updated > t.deadline; })
            .map(t => { t.correction = entityType === 'assignee' ? "SLA estourado. Validar se houve espera de usuário." : "Atraso na localidade. Verificar rota ou acesso."; return t; });
    } 
    else if (metricType === 'tma') {
        title = `Chamados com TMA Alto - ${entityName}`;
        const totalDur = tickets.reduce((acc, t) => acc + calculateBusinessTime(t.created, t.updated), 0);
        const avgDur = tickets.length ? totalDur / tickets.length : 0;
        tickets = tickets.filter(t => { const d = calculateBusinessTime(t.created, t.updated); return d > avgDur; })
            .map(t => { t.correction = entityType === 'assignee' ? "Tempo técnico alto. Checar complexidade." : "Lentidão na unidade. Checar infraestrutura."; return t; });
    }
    openDrillDown(tickets, title, true);
}

// --- VARIÁVEIS GLOBAIS DE PAGINAÇÃO ---
let currentDrillDownData = [];
let currentDrillDownPage = 1;
const PAGE_SIZE = 50;
let showCorrectionMode = false;

// --- FUNÇÃO PRINCIPAL (ABRE O MODAL) ---
function openDrillDown(tickets, title = "Detalhes", showCorrection = false) {
    // 1. Salva os dados no estado global
    currentDrillDownData = tickets;
    currentDrillDownPage = 1;
    showCorrectionMode = showCorrection; // Salva se deve mostrar coluna de correção

    // 2. Configura Título
    const titleEl = document.getElementById('ddTitle');
    if(title) titleEl.innerText = title;

    // 3. Configura Cabeçalho da Tabela
    const tableHeader = document.querySelector('#ddTable thead tr');
    if (showCorrection) {
        tableHeader.innerHTML = `<th>ID</th><th>Resumo</th><th>Status</th><th>Data Res.</th><th>Correção Sugerida</th>`;
    } else { 
        tableHeader.innerHTML = `<th>ID</th><th>Resumo</th><th>Status</th><th>Responsável</th><th>Data</th>`; 
    }

    // 4. Renderiza a primeira página e abre o modal
    renderDrillDownPage();
    document.getElementById('drillDownModal').classList.add('open');
}

// --- FUNÇÃO DE RENDERIZAÇÃO DA PÁGINA ---
function renderDrillDownPage() {
    const tbody = document.querySelector('#ddTable tbody');
    tbody.innerHTML = "";

    // Se não tiver dados
    if (currentDrillDownData.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Nenhum registro encontrado.</td></tr>";
        document.getElementById('pageInfo').innerText = "0 registros";
        document.getElementById('btnPrev').disabled = true;
        document.getElementById('btnNext').disabled = true;
        return;
    }

    // Cálculos de Paginação
    const totalRecords = currentDrillDownData.length;
    const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
    
    // Garante que a página atual é válida
    if (currentDrillDownPage < 1) currentDrillDownPage = 1;
    if (currentDrillDownPage > totalPages) currentDrillDownPage = totalPages;

    const startIdx = (currentDrillDownPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalRecords);
    
    // Fatia os dados (Slice)
    const pageData = currentDrillDownData.slice(startIdx, endIdx);

    // Constrói o HTML (Batch String)
    let rowsHTML = "";
    pageData.forEach(t => {
        const dt = t.updated ? t.updated.toLocaleDateString('pt-BR') : '-';
        
        let rowContent = `
            <td style="font-weight:bold; color:var(--brand-blue);">${t.id || '-'}</td>
            <td>${t.summary || '-'}</td>
            <td><span class="sla-badge" style="background:#eee; color:#333;">${t.status}</span></td>
        `;

        if (showCorrectionMode) {
            rowContent += `<td>${dt}</td><td style="color:var(--danger); font-weight:600;">${t.correction || '-'}</td>`;
        } else { 
            const dtCria = t.created ? t.created.toLocaleDateString('pt-BR') : '-'; 
            rowContent += `<td>${t.assignee}</td><td>${dtCria}</td>`; 
        }
        
        rowsHTML += `<tr>${rowContent}</tr>`;
    });

    tbody.innerHTML = rowsHTML;

    // Atualiza Controles de Paginação (Texto e Botões)
    document.getElementById('pageInfo').innerText = `Página ${currentDrillDownPage} de ${totalPages} (${totalRecords} registros)`;
    
    document.getElementById('btnPrev').disabled = (currentDrillDownPage === 1);
    document.getElementById('btnNext').disabled = (currentDrillDownPage === totalPages);

    // Rola a tabela para o topo ao mudar de página
    document.querySelector('.fs-table-container').scrollTop = 0;
}

// --- CONTROLE DOS BOTÕES ---
function changeDrillDownPage(direction) {
    currentDrillDownPage += direction;
    renderDrillDownPage();
}

function closeDrillDown() {
    document.getElementById('drillDownModal').classList.remove('open');
}

function toggleTheme() { document.body.classList.toggle('light-mode'); updateChartTheme(); }

function updateChartTheme() {
    const isL = document.body.classList.contains('light-mode'); 
    document.getElementById('themeIcon').innerText = isL?'🌙':'☀️'; 
    const c = isL ? '#000000' : '#FFFFFF'; 
    const g = isL ? '#E0E0E0' : '#2C2C2C'; 
    Chart.defaults.color = c; 
    Chart.defaults.borderColor = g; 
    if(Chart.defaults.plugins.datalabels) Chart.defaults.plugins.datalabels.color = c; 
    Object.values(charts).forEach(ch => { 
        if(ch.config.type === 'pie' || ch.config.type === 'doughnut') { if(ch.options.plugins.legend && ch.options.plugins.legend.labels) ch.options.plugins.legend.labels.color = c; }
        if(ch!==charts.mAss) ch.update(); 
    }); 
    if(charts.mAss) { 
        charts.mAss.options.plugins.legend.labels.color = c;
        if(charts.mAss.options.scales.x) charts.mAss.options.scales.x.grid.color = g;
        if(charts.mAss.options.scales.y) charts.mAss.options.scales.y.grid.color = g;
        if(charts.mAss.data.datasets.length > 0) { const lastDS = charts.mAss.data.datasets[charts.mAss.data.datasets.length-1]; if(lastDS.label === 'Total') lastDS.datalabels.color = c; }
        charts.mAss.update(); 
    } 
}

function openTab(evt, n) { document.querySelectorAll('.tab-content, .tab-button').forEach(x=>x.classList.remove('active')); document.getElementById(n).classList.add('active'); evt.currentTarget.classList.add('active'); }
function downloadCSV() { if(!allTickets.length){alert("Vazio");return;} const h=["Criado,Status,Responsável,Tipo,Local"]; const r=allTickets.map(t=>[`${t.created.toLocaleDateString()}`,t.status,t.assignee,t.type,t.location].join(',')); const b=new Blob([h.concat(r).join('\n')],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="export.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }

let fsIdx=0, fsChart=null;
const fsTitles = ["Volume Diário", "SLA Mensal", "Status do Mês", "Tipos", "Top Unidades", "Analistas x Unidade", "Performance Analista", "Performance Unidade"];

function openFullscreenMode(i) { fsIdx=i; document.getElementById('fsModal').classList.add('open'); renderFs(); }
function closeFullscreenMode() { document.getElementById('fsModal').classList.remove('open'); }
function changeFullscreenChart(d) { fsIdx+=d; if(fsIdx<0)fsIdx=0; if(fsIdx>7)fsIdx=7; renderFs(); }

function renderFs() {
    document.getElementById('fsChartTitle').innerText = fsTitles[fsIdx] || "Detalhe";
    document.getElementById('fsFooterMsg').classList.toggle('visible', fsIdx===7);
    const cvsWrap = document.getElementById('fsCanvasWrapper'); const tblWrap = document.getElementById('fsTableWrapper');
    if(fsIdx < 6) {
        cvsWrap.style.display = 'block'; tblWrap.classList.remove('active');
        const ref = [{c:charts.mVol},{c:charts.mSla},{c:charts.mStatus},{c:charts.mType},{c:charts.mUnits},{c:charts.mAss}][fsIdx];
        const ctx = document.getElementById('fsCanvas'); if(fsChart) fsChart.destroy();
        const showLegend = ![0, 2, 4].includes(fsIdx);
        const fsPadding = (fsIdx===5) ? { top: 30, right: 120, left: 10, bottom: 40 } : { top: 30, right: 120, left: 10, bottom: 40 };
        const isL = document.body.classList.contains('light-mode');
        const fsColor = isL ? '#000000' : '#FFFFFF';
        const cfg = { 
            type: ref.c.config.type, data: JSON.parse(JSON.stringify(ref.c.config.data)), 
            options: { ...ref.c.config.options, maintainAspectRatio: false, plugins: { ...ref.c.config.options.plugins, legend: { display: showLegend, position:'bottom', labels:{color:fsColor, filter: (i)=>i.text!=='Total'} } }, layout: { padding: fsPadding } } 
        };
        if(fsIdx === 5) cfg.options.plugins.sideLabels = sideLabelsPlugin;
        fsChart = new Chart(ctx, cfg);
    } else {
        if(fsChart) fsChart.destroy(); cvsWrap.style.display = 'none'; tblWrap.classList.add('active');
        const srcId = fsIdx === 6 ? 'tableAssignee' : 'tableUnit';
        document.getElementById('fsTable').innerHTML = document.getElementById(srcId).innerHTML;
    }
}
document.addEventListener('keydown', e => { if(document.getElementById('fsModal').classList.contains('open')) { if(e.key=='ArrowLeft')changeFullscreenChart(-1); if(e.key=='ArrowRight')changeFullscreenChart(1); if(e.key=='Escape')closeFullscreenMode(); } });

function handleChartClick(chartId, index, datasetIndex, chart) {
    const clickedLabel = chart.data.labels[index];
    const y = yearSelect.value;
    const m = monthSelect.value;
    const isMonthlyTab = document.getElementById('tab-mensal').classList.contains('active');
    
    let filtered = allTickets;
    const isDeliveryChart = ['monthlySlaChart', 'slaChart', 'monthlyUnitsChart', 'locationChart', 'monthlyAssigneeChart', 'assigneeChart'].includes(chartId);

    if (isMonthlyTab) {
        if (isDeliveryChart) {
            filtered = allTickets.filter(t => {
                const isRes = ['resolvido','fechada','concluído','done','fechado'].includes(t.status.toLowerCase());
                return isRes && t.updated && t.updated.getFullYear().toString() === y && (t.updated.getMonth() + 1).toString() === m;
            });
        } else {
            filtered = allTickets.filter(t => t.created && t.created.getFullYear().toString() === y && (t.created.getMonth() + 1).toString() === m);
        }
    }

    if (chartId === 'monthlyStatusChart' || chartId === 'statusChart') {
        filtered = filtered.filter(t => t.status === clickedLabel);
        document.getElementById('ddTitle').innerText = `Chamados - Status: ${clickedLabel}`;
    }
    else if (chartId === 'monthlyTypeChart' || chartId === 'typeChart') {
        filtered = filtered.filter(t => t.type === clickedLabel);
        document.getElementById('ddTitle').innerText = `Chamados - Tipo: ${clickedLabel}`;
    }
    else if (chartId === 'monthlySlaChart' || chartId === 'slaChart') {
        const isOk = clickedLabel === 'No Prazo';
        filtered = filtered.filter(t => {
            if(!t.deadline) return false;
            const isRes = ['resolvido','fechada','concluído','done','fechado'].includes(t.status.toLowerCase());
            const ok = (isRes && t.updated <= t.deadline) || (!isRes && new Date() <= t.deadline);
            return isOk ? ok : !ok;
        });
        document.getElementById('ddTitle').innerText = `Chamados - SLA: ${clickedLabel}`;
    }
    else if (chartId === 'monthlyUnitsChart' || chartId === 'locationChart') {
        filtered = filtered.filter(t => t.location === clickedLabel);
        document.getElementById('ddTitle').innerText = `Chamados - Unidade: ${clickedLabel}`;
    }
    else if (chartId === 'monthlyAssigneeChart' || chartId === 'assigneeChart') {
        const datasetLabel = chart.data.datasets[datasetIndex].label;
        filtered = filtered.filter(t => t.assignee === clickedLabel);
        if(datasetLabel !== 'Total') {
            filtered = filtered.filter(t => t.location === datasetLabel);
            document.getElementById('ddTitle').innerText = `Chamados - ${clickedLabel} em ${datasetLabel}`;
        } else {
            document.getElementById('ddTitle').innerText = `Chamados - ${clickedLabel} (Total)`;
        }
    }
    else if (chartId === 'monthlyChart') {
        filtered = filtered.filter(t => t.created.getDate().toString() === clickedLabel);
        document.getElementById('ddTitle').innerText = `Chamados do dia ${clickedLabel}/${m}/${y}`;
    }
    else if (chartId === 'trendChart') {
        const [tm, ty] = clickedLabel.split('/');
        const fullY = "20" + ty;
        filtered = allTickets.filter(t => t.created && t.created.getMonth()+1 == tm && t.created.getFullYear() == fullY);
        document.getElementById('ddTitle').innerText = `Chamados de ${clickedLabel}`;
    }
    openDrillDown(filtered);
}

initCharts(); loadAutoCSV();