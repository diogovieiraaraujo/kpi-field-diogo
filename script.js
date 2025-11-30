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

const sideLabelsPlugin = {
    id: 'sideLabels',
    afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart; const padding=5; const lineLength=10; const textPadding=3;
        const isLight = document.body.classList.contains('light-mode');
        const textColor = isLight ? '#1A1A1A' : '#E0E0E0';
        
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
    document.getElementById('currentDate').innerText = new Date().toLocaleString('pt-BR');
    
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

        return new Chart(ctx, { 
            type: type, 
            data: { labels:[], datasets:[] }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                layout: defaultPadding, 
                plugins: { legend: { display: false } }, 
                scales: (type!=='pie'&&type!=='doughnut')?{x:{grid:{color:'#333'}},y:{grid:{color:'#333'}}}:{}, 
                ...cfg 
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
        scales:{x:{stacked:true, grid:{color:'#333'}}, y:{stacked:true, grid:{color:'#333'}}}, 
        plugins:{legend:{display:true, position:'bottom', labels:{color:'#E0E0E0', filter: (i)=>i.text!=='Total'}}, sideLabels: sideLabelsPlugin}, 
        layout: { padding: { top: 30, right: 50, left: 10, bottom: 10 } } 
    });
    
    toggleTheme(); toggleTheme();
}

function handleFileSelect(evt) { const file = evt.target.files[0]; if(!file)return; const r = new FileReader(); r.onload=(e)=>processCSV(e.target.result); r.readAsText(file); }
function loadAutoCSV() { fetch('dados.csv').then(r=>{if(!r.ok)throw new Error();return r.text();}).then(t=>{logMsg("Dados carregados."); processCSV(t);}).catch(e=>logMsg("Modo Local. Use o botão Importar.")); }

function processCSV(text) {
    if(!text) return;
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.replace(/"/g,'').trim().toLowerCase());
    const map = { created: headers.findIndex(h=>h.includes('criado')||h.includes('created')), updated: headers.findIndex(h=>h.includes('atualizado')), deadline: headers.findIndex(h=>h.includes('limite')), status: headers.findIndex(h=>h.includes('status')), assignee: headers.findIndex(h=>h.includes('responsável')), type: headers.findIndex(h=>h.includes('tipo')), loc: headers.findIndex(h=>h.includes('campo')||h.includes('local')) };
    if(map.created===-1||map.status===-1){logMsg("CSV Inválido (Colunas não encontradas)",true);return;}
    const data = [];
    for(let i=1; i<lines.length; i++) {
        let row = sep === ';' ? lines[i].split(';') : lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if(row.length < headers.length) continue;
        const clean = (x) => x ? x.replace(/"/g,'').trim() : 'N/A';
        const parseDt = (s) => { if(!s)return null; let c=clean(s).split(' '); let dp=c[0],tp=c[1]||"00:00"; let d,m,y; if(dp.includes('/'))[d,m,y]=dp.split('/').map(Number); else if(dp.includes('-'))[y,m,d]=dp.split('-').map(Number); else return null; if(y<100)y+=2000; let [h,min]=tp.split(':').map(Number); if(c.includes('PM')&&h<12)h+=12; if(c.includes('AM')&&h===12)h=0; const dt=new Date(y,m-1,d,h,min); return isNaN(dt)?null:dt; };
        const cDt = parseDt(row[map.created]);
        if(cDt) data.push({ created: cDt, updated: parseDt(row[map.updated]), deadline: parseDt(row[map.deadline]), status: clean(row[map.status]), assignee: clean(row[map.assignee])||'N/A', type: clean(row[map.type]), location: map.loc>-1?clean(row[map.loc]):'Geral' });
    }
    allTickets = data; recalculateKPIs(data);
    logMsg(`Sucesso! ${data.length} registros carregados.`);
}

function formatDuration(ms) { if(!ms||ms<0)return "-"; const h=Math.floor(ms/3600000), d=Math.floor(h/24); return d>0?`${d}d ${h%24}h`:`${h}h`; }

function recalculateKPIs(data) {
    const s = {trend:{},loc:{},ass:{},type:{},status:{},slaOk:0,slaTot:0,durSum:0,durCount:0};
    data.forEach(t => {
        const k = `${String(t.created.getMonth()+1).padStart(2,'0')}/${t.created.getFullYear().toString().substr(2)}`;
        s.trend[k]=(s.trend[k]||0)+1; s.loc[t.location]=(s.loc[t.location]||0)+1; s.ass[t.assignee]=(s.ass[t.assignee]||0)+1; s.type[t.type]=(s.type[t.type]||0)+1; s.status[t.status]=(s.status[t.status]||0)+1;
        const isRes = ['resolvido','fechada','concluído'].includes(t.status.toLowerCase());
        if(t.deadline) { s.slaTot++; if((isRes&&t.updated<=t.deadline)||(!isRes&&new Date()<=t.deadline)) s.slaOk++; }
        
        // CÁLCULO DE TMA (Tempo Médio de Atendimento)
        if(isRes && t.updated) { const d=t.updated-t.created; if(d>0){ s.durSum+=d; s.durCount++; } }
    });
    document.getElementById('kpiTotal').innerText = data.length; 
    document.getElementById('kpiSLA').innerText = s.slaTot?((s.slaOk/s.slaTot)*100).toFixed(1)+"%":"-"; 
    // Atualizado ID de SMA para TMA
    document.getElementById('kpiTMA').innerText = s.durCount?formatDuration(s.durSum/s.durCount):"-";
    const topL = Object.entries(s.loc).sort((a,b)=>b[1]-a[1])[0]; document.getElementById('kpiLocation').innerText = topL?topL[0]:"-";
    
    const updateC = (k,l,d,p={}) => { charts[k].data.labels=l; charts[k].data.datasets=[{data:d,backgroundColor:p.bg||'#8680b1',borderColor:p.bd||'#8680b1',fill:p.fill||false}]; if(p.multi)charts[k].data.datasets[0].backgroundColor=p.bg; charts[k].update(); };
    const tK = Object.keys(s.trend).sort((a,b)=>{const[m1,y1]=a.split('/');const[m2,y2]=b.split('/');return y1==y2?m1-m2:y1-y2;}); updateC('trend',tK,tK.map(k=>s.trend[k]),{bg:'rgba(134,128,177,0.2)',fill:true});
    const sL = Object.entries(s.loc).sort((a,b)=>b[1]-a[1]); updateC('loc',sL.map(x=>x[0]),sL.map(x=>x[1]),{bg:'#0055FF'});
    const sA = Object.entries(s.ass).sort((a,b)=>b[1]-a[1]).slice(0,10); updateC('ass',sA.map(x=>x[0]),sA.map(x=>x[1]));
    updateC('type',Object.keys(s.type),Object.values(s.type),{multi:true,bg:distinctColors}); updateC('sla',['No Prazo','Fora'],[s.slaOk,s.slaTot-s.slaOk],{multi:true,bg:['#00C853','#FF5252']}); updateC('status',Object.keys(s.status),Object.values(s.status),{multi:true,bg:['#00C853','#455A64','#9E9E9E','#8680b1','#546E7A']});
    
    monthlyData={}; data.forEach(t=>{ const y=t.created.getFullYear().toString(); const m=(t.created.getMonth()+1).toString(); if(!monthlyData[y])monthlyData[y]={}; if(!monthlyData[y][m])monthlyData[y][m]=[]; monthlyData[y][m].push(t); });
    initMonthlyTab();
    
    toggleTheme(); toggleTheme();
}

const yearSelect = document.getElementById('yearSelect'), monthSelect = document.getElementById('monthSelect'), mNames = {"1":"Janeiro","2":"Fevereiro","3":"Março","4":"Abril","5":"Maio","6":"Junho","7":"Julho","8":"Agosto","9":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"};
function initMonthlyTab() { yearSelect.innerHTML=""; const ys=Object.keys(monthlyData).sort(); if(!ys.length)return; ys.forEach(y=>yearSelect.add(new Option(y,y))); yearSelect.value=ys[ys.length-1]; updateMonthSelect(); }
function updateMonthSelect() { monthSelect.innerHTML=""; const y=yearSelect.value; if(!monthlyData[y])return; const ms=Object.keys(monthlyData[y]).sort((a,b)=>a-b); ms.forEach(m=>monthSelect.add(new Option(mNames[m],m))); monthSelect.value=ms[ms.length-1]; updateMonthlyView(); }

function updateMonthlyView() {
    const y=yearSelect.value, m=monthSelect.value; if(!monthlyData[y]||!monthlyData[y][m]) return;
    const tks = monthlyData[y][m];
    const s = {vol:{},unit:{},status:{},type:{},ass:{},matrix:{},slaOk:0,slaTot:0,durSum:0,durCount:0}, det = {ass:{},unit:{}};
    tks.forEach(t => {
        const d=t.created.getDate(); s.vol[d]=(s.vol[d]||0)+1; s.unit[t.location]=(s.unit[t.location]||0)+1; s.status[t.status]=(s.status[t.status]||0)+1; s.type[t.type]=(s.type[t.type]||0)+1; s.ass[t.assignee]=(s.ass[t.assignee]||0)+1; if(!s.matrix[t.assignee])s.matrix[t.assignee]={}; s.matrix[t.assignee][t.location]=(s.matrix[t.assignee][t.location]||0)+1;
        const isRes=['resolvido','fechada','concluído'].includes(t.status.toLowerCase()); let hit=false,dur=0; if(t.deadline){s.slaTot++; if((isRes&&t.updated<=t.deadline)||(!isRes&&new Date()<=t.deadline)){s.slaOk++;hit=true;}} 
        // CÁLCULO DE TMA MENSAL
        if(isRes&&t.updated){dur=t.updated-t.created;if(dur>0){s.durSum+=dur;s.durCount++;}}
        const addD=(o,k)=>{if(!o[k])o[k]={count:0,slaOk:0,slaTot:0,durSum:0,durCount:0}; o[k].count++; if(t.deadline){o[k].slaTot++; if(hit)o[k].slaOk++;} if(dur>0){o[k].durSum+=dur;o[k].durCount++;}}; addD(det.ass,t.assignee); addD(det.unit,t.location);
    });
    document.getElementById('monthlyTotal').innerText = tks.length; document.getElementById('monthlySLA').innerText = s.slaTot?((s.slaOk/s.slaTot)*100).toFixed(1)+"%":"-"; 
    // ATUALIZADO PARA TMA MENSAL
    document.getElementById('monthlyTMA').innerText = s.durCount?formatDuration(s.durSum/s.durCount):"-";
    
    const dK=Object.keys(s.vol).sort((a,b)=>a-b); charts.mVol.data.labels=dK; charts.mVol.data.datasets=[{data:dK.map(k=>s.vol[k]),borderColor:'#8680b1',backgroundColor:'rgba(134,128,177,0.2)',fill:true}]; charts.mVol.update();
    charts.mSla.data.labels=['No Prazo','Fora']; charts.mSla.data.datasets=[{data:[s.slaOk,s.slaTot-s.slaOk],backgroundColor:['#00C853','#FF5252']}]; charts.mSla.update();
    const uS=Object.entries(s.unit).sort((a,b)=>b[1]-a[1]).slice(0,5); charts.mUnits.data.labels=uS.map(x=>x[0]); charts.mUnits.data.datasets=[{data:uS.map(x=>x[1]),backgroundColor:'#0055FF'}]; charts.mUnits.update();
    charts.mStatus.data.labels=Object.keys(s.status); charts.mStatus.data.datasets=[{data:Object.values(s.status),backgroundColor:['#00C853','#8680b1','#FF5252','#0055FF']}]; charts.mStatus.update();
    charts.mType.data.labels=Object.keys(s.type); charts.mType.data.datasets=[{data:Object.values(s.type),backgroundColor:distinctColors}]; charts.mType.update();

    const topA = Object.entries(s.ass).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]); let allU = new Set(); topA.forEach(a => Object.keys(s.matrix[a]||{}).forEach(u => allU.add(u)));
    const unitDS = Array.from(allU).map((u, i) => ({ label: u, type: 'bar', stack: 'combined', backgroundColor: distinctColors[i%distinctColors.length], data: topA.map(a => s.matrix[a][u] || 0), datalabels: { display: false } }));
    const totalDS = { label: 'Total', type: 'line', data: topA.map(a => s.ass[a]), backgroundColor: 'transparent', borderColor: 'transparent', pointRadius: 0, datalabels: { display: true, align: 'end', anchor: 'end', offset: -5, color: document.body.classList.contains('light-mode')?'#1A1A1A':'#E0E0E0', font: { weight: 'bold', size: 12 }, formatter: (v) => v } };
    charts.mAss.data.labels = topA; charts.mAss.data.datasets = [...unitDS, totalDS]; charts.mAss.update();

    // RENDERIZAÇÃO DA TABELA COM COLUNA TMA
    const rndTbl = (id, o) => { 
        const b = document.querySelector(`#${id} tbody`); 
        b.innerHTML=""; 
        Object.entries(o).sort((a,b)=>b[1].count-a[1].count).forEach(([k,v]) => { 
            const p=v.slaTot?((v.slaOk/v.slaTot)*100).toFixed(1):0; 
            const c=p>=70?'sla-ok':'sla-nok'; 
            // Coluna final agora exibe o TMA (durSum/durCount)
            b.innerHTML += `<tr><td><strong>${k}</strong></td><td>${v.count}</td><td><span class="sla-badge ${c}">${p}%</span></td><td>${v.durCount?formatDuration(v.durSum/v.durCount):"-"}</td></tr>`; 
        }); 
    };
    rndTbl('tableAssignee', det.ass); rndTbl('tableUnit', det.unit);
}

function toggleTheme() { 
    document.body.classList.toggle('light-mode'); 
    const isL = document.body.classList.contains('light-mode'); 
    document.getElementById('themeIcon').innerText = isL?'🌙':'☀️'; 
    const c = isL ? '#1A1A1A' : '#E0E0E0'; 
    const g = isL ? '#DADCE0' : '#333'; 
    
    Chart.defaults.color = c; 
    Chart.defaults.borderColor = g; 
    
    if(Chart.defaults.plugins.datalabels) {
        Chart.defaults.plugins.datalabels.color = c; 
    }

    Object.values(charts).forEach(ch => { 
        if(ch.config.type === 'pie' || ch.config.type === 'doughnut') {
             if(ch.options.plugins.legend && ch.options.plugins.legend.labels) {
                 ch.options.plugins.legend.labels.color = c;
             }
        }
        if(ch!==charts.mAss) ch.update(); 
    }); 

    if(charts.mAss && charts.mAss.data.datasets.length > 0) { 
        const lastDS = charts.mAss.data.datasets[charts.mAss.data.datasets.length-1]; 
        if(lastDS.label === 'Total') lastDS.datalabels.color = c; 
        charts.mAss.update(); 
    } 
}

function openTab(evt, n) { document.querySelectorAll('.tab-content, .tab-button').forEach(x=>x.classList.remove('active')); document.getElementById(n).classList.add('active'); evt.currentTarget.classList.add('active'); }
function downloadCSV() { if(!allTickets.length){alert("Vazio");return;} const h=["Criado,Status,Responsável,Tipo,Local"]; const r=allTickets.map(t=>[`${t.created.toLocaleDateString()}`,t.status,t.assignee,t.type,t.location].join(',')); const b=new Blob([h.concat(r).join('\n')],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="export.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }

let fsIdx=0, fsChart=null;
const fsTitles = ["Volume Diário", "SLA Mensal", "Status", "Tipos", "Top Unidades", "Analistas x Unidade", "Performance Analista", "Performance Unidade"];

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
        const fsPadding = (fsIdx===5) 
            ? { top: 30, right: 60, left: 10, bottom: 10 } 
            : { top: 30, right: 40, left: 10, bottom: 10 };

        const isL = document.body.classList.contains('light-mode');
        const fsColor = isL ? '#1A1A1A' : '#E0E0E0';
        
        const cfg = { 
            type: ref.c.config.type, 
            data: JSON.parse(JSON.stringify(ref.c.config.data)), 
            options: { 
                ...ref.c.config.options, 
                maintainAspectRatio: false, 
                plugins: { 
                    ...ref.c.config.options.plugins, 
                    legend: { display: showLegend, position:'bottom', labels:{color:fsColor, filter: (i)=>i.text!=='Total'} } 
                }, 
                layout: { padding: fsPadding } 
            } 
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

initCharts(); loadAutoCSV();