function openDrillDown(tickets, title = "Detalhes", showCorrection = false) {
    const tableHeader = document.querySelector('#ddTable thead tr');
    const tbody = document.querySelector('#ddTable tbody');
    
    // Limpa o conteúdo atual
    tbody.innerHTML = "";
    
    // Atualiza o título
    const titleEl = document.getElementById('ddTitle');
    if(title) titleEl.innerText = title;

    // Configura o cabeçalho
    if (showCorrection) {
        tableHeader.innerHTML = `<th>ID</th><th>Resumo</th><th>Status</th><th>Data Res.</th><th>Correção Sugerida</th>`;
    } else { 
        tableHeader.innerHTML = `<th>ID</th><th>Resumo</th><th>Status</th><th>Responsável</th><th>Data</th>`; 
    }
    
    if(tickets.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Nenhum registro encontrado.</td></tr>";
        return;
    }

    // --- OTIMIZAÇÃO DE PERFORMANCE ---
    
    // 1. Limite de Segurança: Renderizar no máximo 500 itens para não travar o DOM
    const MAX_ITEMS = 500;
    const renderData = tickets.slice(0, MAX_ITEMS);
    
    // Avisa no título se houver mais itens do que o mostrado
    if (tickets.length > MAX_ITEMS) {
        titleEl.innerText = `${title} (Exibindo ${MAX_ITEMS} de ${tickets.length} registros - Use Exportar para ver tudo)`;
    }

    // 2. Construção em Batch: Cria uma string gigante ao invés de manipular o DOM a cada linha
    let rowsHTML = "";

    renderData.forEach(t => {
        const dt = t.updated ? t.updated.toLocaleDateString('pt-BR') : '-';
        
        let rowContent = `
            <td style="font-weight:bold; color:var(--brand-blue);">${t.id || '-'}</td>
            <td>${t.summary || '-'}</td>
            <td><span class="sla-badge" style="background:#eee; color:#333;">${t.status}</span></td>
        `;

        if (showCorrection) {
            rowContent += `<td>${dt}</td><td style="color:var(--danger); font-weight:600;">${t.correction || '-'}</td>`;
        } else { 
            const dtCria = t.created ? t.created.toLocaleDateString('pt-BR') : '-'; 
            rowContent += `<td>${t.assignee}</td><td>${dtCria}</td>`; 
        }
        
        // Acumula na string
        rowsHTML += `<tr>${rowContent}</tr>`;
    });

    // 3. Injeção Única: Atualiza o DOM apenas uma vez
    tbody.innerHTML = rowsHTML;

    document.getElementById('drillDownModal').classList.add('open');
}
