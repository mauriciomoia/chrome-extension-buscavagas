document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES ---
    const HISTORY_KEY = 'searchHistory';
    const CURRENT_TERM_KEY = 'currentSearchTerm';
    const SAVED_JOBS_KEY = 'savedJobs';
    const LINKEDIN_SAVED_KEY = 'linkedinSaved';
    const LAST_ACTIVE_TAB_KEY = 'lastActiveTab';
    const DARK_MODE_KEY = 'darkModeEnabled'; // Nova constante para o modo noturno
    const MAX_HISTORY_ITEMS = 10;
    const ALL_PLATFORMS = ['gupy', 'solides', 'linkedin', 'vagas', 'glassdoor', 'remotar'];

    // --- ELEMENTOS DA UI ---
    const navSearchBtn = document.getElementById('navSearchBtn');
    const navSavedBtn = document.getElementById('navSavedBtn');
    const navLinkedinBtn = document.getElementById('navLinkedinBtn');
    const navSettingsBtn = document.getElementById('navSettingsBtn');
    const searchView = document.getElementById('searchView');
    const savedJobsView = document.getElementById('savedJobsView');
    const linkedinSavedView = document.getElementById('linkedinSavedView');
    const settingsView = document.getElementById('settingsView');
    const searchInput = document.getElementById('searchInput');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const historyList = document.getElementById('historyList');
    const historyContainer = document.getElementById('historyContainer');
    const searchAllBtn = document.getElementById('searchAllBtn');
    const dynamicSaveContainer = document.getElementById('dynamicSaveContainer');
    const dynamicSaveBtn = document.getElementById('dynamicSaveBtn');
    const savedJobsList = document.getElementById('savedJobsList');
    const linkedinSavedList = document.getElementById('linkedinSavedList');
    const darkModeToggle = document.getElementById('darkModeToggle');

    // --- LÓGICA DE MODO NOTURNO ---
    const applyDarkMode = (enabled) => {
        document.body.classList.toggle('dark-mode', enabled);
        if (darkModeToggle) darkModeToggle.checked = enabled;
    };

    const handleDarkModeToggle = () => {
        const isEnabled = darkModeToggle.checked;
        applyDarkMode(isEnabled);
        chrome.storage.local.set({ [DARK_MODE_KEY]: isEnabled });
    };

    // --- LÓGICA DE NAVEGAÇÃO ENTRE ABAS ---
    const switchView = (viewToShow) => {
        [searchView, savedJobsView, linkedinSavedView, settingsView].forEach(v => v.classList.add('hidden'));
        [navSearchBtn, navSavedBtn, navLinkedinBtn, navSettingsBtn].forEach(b => b.classList.remove('active'));
        
        if (viewToShow === 'saved') {
            savedJobsView.classList.remove('hidden');
            navSavedBtn.classList.add('active');
            loadAndRenderSavedJobs();
        } else if (viewToShow === 'linkedin') {
            linkedinSavedView.classList.remove('hidden');
            navLinkedinBtn.classList.add('active');
            loadAndRenderLinkedinSaved();
        } else if (viewToShow === 'settings') {
            settingsView.classList.remove('hidden');
            navSettingsBtn.classList.add('active');
        } else {
            searchView.classList.remove('hidden');
            navSearchBtn.classList.add('active');
        }
        chrome.storage.local.set({ [LAST_ACTIVE_TAB_KEY]: viewToShow });
    };

    // --- LÓGICA DO BOTÃO DE SALVAR DINÂMICO ---
    const updateDynamicSaveButton = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0] || !tabs[0].url) return;
            const url = tabs[0].url;
            let action = null;
            if (url.includes('linkedin.com/in/')) {
                action = { text: '<i class="fa-solid fa-bookmark"></i> Salvar Perfil', handler: saveLinkedinProfile };
            } else if (url.includes('linkedin.com/company/')) {
                action = { text: '<i class="fa-solid fa-bookmark"></i> Salvar Empresa', handler: saveLinkedinProfile };
            } else if (url.startsWith('http')) {
                action = { text: '<i class="fa-solid fa-bookmark"></i> Salvar Vaga', handler: saveJob };
            }
            if (action) {
                dynamicSaveBtn.innerHTML = action.text;
                dynamicSaveBtn.onclick = action.handler;
                dynamicSaveContainer.classList.remove('hidden');
            } else {
                dynamicSaveContainer.classList.add('hidden');
            }
        });
    };

    // --- LÓGICA DE SALVAR ---
    const saveJob = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            const currentTab = tabs[0];
            const newJob = { id: Date.now(), url: currentTab.url, siteName: getSiteName(currentTab.url), savedAt: new Date().toISOString().split('T')[0] };
            chrome.storage.local.get([SAVED_JOBS_KEY], (result) => {
                const jobs = result[SAVED_JOBS_KEY] || [];
                if (jobs.some(job => job.url === newJob.url)) { alert('Esta vaga já foi salva!'); return; }
                jobs.unshift(newJob);
                chrome.storage.local.set({ [SAVED_JOBS_KEY]: jobs }, () => {
                    dynamicSaveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Vaga Salva!';
                    setTimeout(() => updateDynamicSaveButton(), 1500);
                });
            });
        });
    };

    const saveLinkedinProfile = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const isPerson = tab.url.includes('/in/');
            const type = isPerson ? 'person' : 'company';
            let name = 'Desconhecido', urlToSave = tab.url;
            try {
                const parts = tab.url.split('/'), slugIndex = parts.indexOf(isPerson ? 'in' : 'company') + 1;
                name = parts[slugIndex].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            } catch (e) {}
            if (!isPerson) { urlToSave = `https://www.linkedin.com/company/${name.toLowerCase().replace(/\s/g, '-')}/jobs/`; }
            const newProfile = { id: Date.now(), url: urlToSave, name, type, savedAt: new Date().toISOString().split('T')[0] };
            chrome.storage.local.get([LINKEDIN_SAVED_KEY], (result) => {
                const profiles = result[LINKEDIN_SAVED_KEY] || [];
                if (profiles.some(p => p.url.includes(name.toLowerCase().replace(/\s/g, '-')))) { alert('Este perfil já foi salvo!'); return; }
                profiles.unshift(newProfile);
                chrome.storage.local.set({ [LINKEDIN_SAVED_KEY]: profiles }, () => {
                    dynamicSaveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Salvo!';
                    setTimeout(() => updateDynamicSaveButton(), 1500);
                });
            });
        });
    };

    // --- FUNÇÃO GENÉRICA PARA CRIAR ITENS SALVOS ---
    const createSavedItemElement = (item, isJob) => {
        const li = document.createElement('li');
        li.className = 'saved-item';
        const row1 = document.createElement('div');
        row1.className = 'item-row';
        const mainInfo = document.createElement('div');
        mainInfo.className = 'item-main-info';
        const icon = document.createElement('span');
        icon.className = 'item-icon';
        const name = document.createElement('span');
        name.className = 'item-name';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        const row2 = document.createElement('div');
        row2.className = 'item-row';
        const link = document.createElement('a');
        link.className = 'item-link';
        link.href = item.url;
        link.target = '_blank';
        link.title = item.url;
        link.textContent = item.url;
        const date = document.createElement('span');
        date.className = 'item-date';
        date.textContent = new Date(item.savedAt).toLocaleDateString('pt-BR');
        if (isJob) {
            icon.innerHTML = '<i class="fa-solid fa-briefcase"></i>';
            name.textContent = getSiteName(item.url);
            deleteBtn.title = 'Remover vaga salva';
            deleteBtn.addEventListener('click', () => deleteSavedJob(item.id));
        } else {
            icon.innerHTML = item.type === 'person' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-building"></i>';
            name.textContent = item.name;
            deleteBtn.title = `Remover ${item.name}`;
            deleteBtn.addEventListener('click', () => deleteLinkedinSaved(item.id));
        }
        mainInfo.appendChild(icon);
        mainInfo.appendChild(name);
        row1.appendChild(mainInfo);
        row1.appendChild(deleteBtn);
        row2.appendChild(link);
        row2.appendChild(date);
        li.appendChild(row1);
        li.appendChild(row2);
        return li;
    };

    // --- LÓGICA DE RENDERIZAÇÃO ---
    const loadAndRenderSavedJobs = () => { chrome.storage.local.get([SAVED_JOBS_KEY], result => { const jobs = result[SAVED_JOBS_KEY] || []; savedJobsList.innerHTML = ''; if (jobs.length === 0) { savedJobsList.innerHTML = '<li>Nenhuma vaga salva ainda.</li>'; return; } jobs.forEach(job => savedJobsList.appendChild(createSavedItemElement(job, true))); }); };
    const deleteSavedJob = (jobId) => { chrome.storage.local.get([SAVED_JOBS_KEY], result => { let jobs = result[SAVED_JOBS_KEY] || []; jobs = jobs.filter(job => job.id !== jobId); chrome.storage.local.set({ [SAVED_JOBS_KEY]: jobs }, () => loadAndRenderSavedJobs()); }); };
    const loadAndRenderLinkedinSaved = () => { chrome.storage.local.get([LINKEDIN_SAVED_KEY], result => { const profiles = result[LINKEDIN_SAVED_KEY] || []; linkedinSavedList.innerHTML = ''; if (profiles.length === 0) { linkedinSavedList.innerHTML = '<li>Nenhum perfil ou empresa salvo.</li>'; return; } profiles.forEach(profile => linkedinSavedList.appendChild(createSavedItemElement(profile, false))); }); };
    const deleteLinkedinSaved = (profileId) => { chrome.storage.local.get([LINKEDIN_SAVED_KEY], result => { let profiles = result[LINKEDIN_SAVED_KEY] || []; profiles = profiles.filter(p => p.id !== profileId); chrome.storage.local.set({ [LINKEDIN_SAVED_KEY]: profiles }, () => loadAndRenderLinkedinSaved()); }); };
    const renderHistory = (history) => { historyList.innerHTML = ''; historyContainer.classList.toggle('hidden', history.length === 0); if (history.length > 0) { history.forEach(term => { const li = document.createElement('li'); li.className = 'history-item'; const termText = document.createElement('span'); termText.textContent = term; li.appendChild(termText); const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-btn'; deleteBtn.title = `Remover "${term}" do histórico`; deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>'; deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteSearchTerm(term); }); li.addEventListener('click', () => { searchInput.value = term; searchInput.focus(); toggleClearButtonVisibility(); saveCurrentSearchTerm(); }); historyList.appendChild(li); }); } };

    // --- LÓGICA DE BUSCA E HISTÓRICO ---
    const getSiteName = (url) => { try { const hostname = new URL(url).hostname; if (hostname.includes('gupy.io')) return 'Gupy'; if (hostname.includes('solides.com')) return 'Solides'; if (hostname.includes('linkedin.com/jobs')) return 'LinkedIn Jobs'; if (hostname.includes('vagas.com')) return 'Vagas.com'; if (hostname.includes('glassdoor.com')) return 'Glassdoor'; if (hostname.includes('remotar.com')) return 'Remotar'; const genericName = hostname.replace('www.', '').split('.')[0]; return genericName.charAt(0).toUpperCase() + genericName.slice(1); } catch (e) { return 'Link Inválido'; } };
    const getSearchUrl = (platform, searchTerm) => { if (!searchTerm) return null; const encodedTerm = encodeURIComponent(searchTerm); const hyphenatedTerm = searchTerm.toLowerCase().replace(/\s+/g, '-'); switch (platform) { case 'gupy': return `https://portal.gupy.io/job-search/term=${encodedTerm}`; case 'solides': return `https://vagas.solides.com.br/vagas/todos/${encodeURIComponent(hyphenatedTerm)}?page=1`; case 'linkedin': return `https://www.linkedin.com/jobs/search/?keywords=${encodedTerm}&origin=JOB_SEARCH_PAGE_SEARCH_BUTTON`; case 'vagas': return `https://www.vagas.com.br/vagas-de-${hyphenatedTerm}`; case 'glassdoor': return `https://www.glassdoor.com.br/Vaga/trabalho-remoto-brasil-${hyphenatedTerm}-vagas-SRCH_IL.0,22_IS12226_KO23,${23 + hyphenatedTerm.length}.htm`; case 'remotar': return `https://remotar.com.br/search/jobs?q=${encodedTerm}`; default: return null; } };
    const performSearch = (platform) => { const searchTerm = searchInput.value.trim(); saveSearchTermToHistory(searchTerm); const url = getSearchUrl(platform, searchTerm); if (url) chrome.tabs.create({ url }); };
    const performSearchAll = () => { const searchTerm = searchInput.value.trim(); if (!searchTerm) { alert('Por favor, digite um termo para buscar.'); searchInput.focus(); return; } saveSearchTermToHistory(searchTerm); ALL_PLATFORMS.forEach(platform => { const url = getSearchUrl(platform, searchTerm); if (url) chrome.tabs.create({ url }); }); };
    const toggleClearButtonVisibility = () => { clearInputBtn.classList.toggle('hidden', searchInput.value.length === 0); };
    const saveCurrentSearchTerm = () => { chrome.storage.local.set({ [CURRENT_TERM_KEY]: searchInput.value }); };
    const loadHistory = () => { chrome.storage.local.get([HISTORY_KEY], r => renderHistory(r[HISTORY_KEY] || [])); };
    const saveSearchTermToHistory = (term) => { if (!term) return; chrome.storage.local.get([HISTORY_KEY], r => { let history = (r[HISTORY_KEY] || []).filter(i => i.toLowerCase() !== term.toLowerCase()); history.unshift(term); history = history.slice(0, MAX_HISTORY_ITEMS); chrome.storage.local.set({ [HISTORY_KEY]: history }, () => renderHistory(history)); }); };
    const deleteSearchTerm = (termToDelete) => { chrome.storage.local.get([HISTORY_KEY], r => { const newHistory = (r[HISTORY_KEY] || []).filter(i => i.toLowerCase() !== termToDelete.toLowerCase()); chrome.storage.local.set({ [HISTORY_KEY]: newHistory }, () => renderHistory(newHistory)); }); };
    
    // --- EVENT LISTENERS ---
    navSearchBtn.addEventListener('click', () => switchView('search'));
    navSavedBtn.addEventListener('click', () => switchView('saved'));
    navLinkedinBtn.addEventListener('click', () => switchView('linkedin'));
    navSettingsBtn.addEventListener('click', () => switchView('settings'));
    if (darkModeToggle) darkModeToggle.addEventListener('change', handleDarkModeToggle);
    searchAllBtn.addEventListener('click', performSearchAll);
    searchInput.addEventListener('input', () => { toggleClearButtonVisibility(); saveCurrentSearchTerm(); });
    clearInputBtn.addEventListener('click', () => { searchInput.value = ''; toggleClearButtonVisibility(); saveCurrentSearchTerm(); searchInput.focus(); });
    document.querySelectorAll('.search-btn').forEach(btn => btn.addEventListener('click', () => performSearch(btn.id.replace('Btn', ''))));
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); const searchTerm = searchInput.value.trim(); if (searchTerm) { saveSearchTermToHistory(searchTerm); searchInput.blur(); } } });
    
    // --- INICIALIZAÇÃO ---
    const loadInitialState = () => {
        chrome.storage.local.get([LAST_ACTIVE_TAB_KEY, CURRENT_TERM_KEY, DARK_MODE_KEY], result => {
            applyDarkMode(result[DARK_MODE_KEY] || false);
            const lastTab = result[LAST_ACTIVE_TAB_KEY] || 'search';
            switchView(lastTab);
            loadHistory();
            updateDynamicSaveButton();
            searchInput.value = result[CURRENT_TERM_KEY] || '';
            toggleClearButtonVisibility();
        });
    };

    loadInitialState();
});