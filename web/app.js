// ReleascenFR Dashboard App

let appState = {
    rawReleases: [],
    allReleases: [],
    filteredReleases: [],
    rawStats: [],
    currentPage: 1,
    itemsPerPage: 15,
    charts: {},
    allDates: []
};

// Start
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initFilterHandlers();
    initPaginationButtons();

    const dateSelect = document.getElementById('filter-date');

    // Load databases
    const [rawReleases, rawStats] = await Promise.all([
        loadDatabaseFile('data/data.db.gz'),
        loadDatabaseFile('data/stats.db.gz')
    ]);

    const explorerTab = document.querySelector('.nav-tab[data-target="releases-view"]');
    const statsTab = document.querySelector('.nav-tab[data-target="stats-view"]');

    let explorerEnabled = false;
    let statsEnabled = false;

    // 1. Process Explorer Database
    if (rawReleases && rawReleases.length > 0) {
        explorerEnabled = true;
        appState.rawReleases = rawReleases;
        // Sort raw releases by date descending (newest first)
        appState.rawReleases.sort((a, b) => parseDateAdded(b.date_added) - parseDateAdded(a.date_added));

        // Extract unique days
        const datesSet = new Set();
        appState.rawReleases.forEach(item => {
            if (item.date_added) {
                const parts = item.date_added.split(' ')[0].split('/');
                if (parts.length === 3) {
                    const yyyymmdd = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    datesSet.add(yyyymmdd);
                }
            }
        });
        appState.allDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

        // Populate date selector
        if (dateSelect) {
            dateSelect.innerHTML = '';
            const ranges = [
                { value: 'all', label: 'Toutes les dates' },
                { value: 'last24h', label: 'Dernières 24 heures' },
                { value: 'last48h', label: 'Dernières 48 heures' },
                { value: 'last7d', label: '7 derniers jours' },
                { value: 'last30d', label: '30 derniers jours' },
                { value: 'last180d', label: '6 derniers mois' }
            ];
            ranges.forEach(r => {
                const option = document.createElement('option');
                option.value = r.value;
                option.textContent = r.label;
                dateSelect.appendChild(option);
            });
            dateSelect.value = 'all';
        }

        // Populate groups selector
        const groupSelect = document.getElementById('filter-group');
        if (groupSelect) {
            groupSelect.innerHTML = '<option value="">Tous les groupes</option>';
            const groupsSet = new Set();
            appState.rawReleases.forEach(r => {
                if (r.group) groupsSet.add(r.group.toUpperCase());
            });
            Array.from(groupsSet).sort().forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                groupSelect.appendChild(opt);
            });
        }

        // Populate audio selector
        const audioSelect = document.getElementById('filter-audio');
        if (audioSelect) {
            audioSelect.innerHTML = '<option value="">Tous les codecs audio</option>';
            const audioSet = new Set();
            appState.rawReleases.forEach(item => {
                if (item.audio) {
                    audioSet.add(item.audio.toUpperCase());
                }
            });
            Array.from(audioSet).sort().forEach(aud => {
                const option = document.createElement('option');
                option.value = aud;
                option.textContent = aud;
                audioSelect.appendChild(option);
            });
        }

        // Populate channels selector
        const channelsSelect = document.getElementById('filter-channels');
        if (channelsSelect) {
            channelsSelect.innerHTML = '<option value="">Tous les canaux</option>';
            const channelsSet = new Set();
            appState.rawReleases.forEach(item => {
                if (item.channels) {
                    channelsSet.add(item.channels.toUpperCase());
                }
            });
            Array.from(channelsSet).sort().forEach(chan => {
                const option = document.createElement('option');
                option.value = chan;
                option.textContent = chan;
                channelsSelect.appendChild(option);
            });
        }

        // Populate extension selector
        const extensionSelect = document.getElementById('filter-extension');
        if (extensionSelect) {
            extensionSelect.innerHTML = '<option value="">Toutes les extensions</option>';
            const extensionSet = new Set();
            appState.rawReleases.forEach(item => {
                if (item.filename) {
                    const parts = item.filename.split('.');
                    if (parts.length > 1) {
                        const ext = parts[parts.length - 1].toLowerCase();
                        if (/^[a-z0-9]{2,4}$/.test(ext)) {
                            extensionSet.add(ext.toUpperCase());
                        }
                    }
                }
            });
            Array.from(extensionSet).sort().forEach(ext => {
                const option = document.createElement('option');
                option.value = ext;
                option.textContent = ext;
                extensionSelect.appendChild(option);
            });
        }

        // Populate video codec selector
        const codecSelect = document.getElementById('filter-codec');
        if (codecSelect) {
            codecSelect.innerHTML = '<option value="">Tous les codecs vidéo</option>';
            const codecSet = new Set();
            let hasEmptyCodec = false;
            appState.rawReleases.forEach(item => {
                if (item.codec) {
                    codecSet.add(item.codec.toUpperCase());
                } else {
                    hasEmptyCodec = true;
                }
            });
            Array.from(codecSet).sort().forEach(cod => {
                const option = document.createElement('option');
                option.value = cod;
                option.textContent = cod;
                codecSelect.appendChild(option);
            });
            if (hasEmptyCodec) {
                const option = document.createElement('option');
                option.value = 'NON SPÉCIFIÉ';
                option.textContent = 'Non spécifié';
                codecSelect.appendChild(option);
            }
        }

        applyDateFilter('all');
        // Trigger filter handler
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.dispatchEvent(new Event('input'));
        }
    } else {
        // Disable explorer tab
        if (explorerTab) {
            explorerTab.disabled = true;
            explorerTab.classList.remove('active');
        }
        document.getElementById('releases-view').classList.remove('active');
        const container = document.getElementById('releases-list');
        container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-dim);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--accent-blue);"></i>
                    Le fichier de l'explorateur (data/data.db.gz) n'est pas disponible.<br>
                    <small style="opacity: 0.7;">Le menu Explorateur a été désactivé.</small>
                </div>
            `;
    }

    // 2. Process Stats Database
    if (rawStats && rawStats.length > 0) {
        statsEnabled = true;
        appState.rawStats = rawStats;
        updateStatsDashboard();
    } else {
        // Disable stats tab
        if (statsTab) {
            statsTab.disabled = true;
            statsTab.classList.remove('active');
        }
        document.getElementById('stats-view').classList.remove('active');
        const statsContainer = document.getElementById('stats-view');
        statsContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-dim);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--accent-cyan);"></i>
                    Le fichier des statistiques (data/stats.db.gz) n'est pas disponible.<br>
                    <small style="opacity: 0.7;">Le menu Statistiques a été désactivé.</small>
                </div>
            `;
    }

    // 3. Set default active view
    if (explorerEnabled && !statsEnabled) {
        // Show explorer
        if (explorerTab) explorerTab.classList.add('active');
        document.getElementById('releases-view').classList.add('active');
    } else if (!explorerEnabled && statsEnabled) {
        // Show stats
        if (statsTab) statsTab.classList.add('active');
        document.getElementById('stats-view').classList.add('active');
        updateStatsDashboard();
        setTimeout(renderStatsCharts, 50);
    } else if (explorerEnabled && statsEnabled) {
        // Show explorer by default
        if (explorerTab) explorerTab.classList.add('active');
        document.getElementById('releases-view').classList.add('active');
    } else {
        // Neither loaded, show error message
        const mainContainer = document.querySelector('.app-main');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div style="padding: 80px 40px; text-align: center; color: var(--text-dim); max-width: 600px; margin: 0 auto;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; display: block; color: var(--accent-cyan);"></i>
                    <h2>Aucune données disponibles</h2>
                </div>
            `;
        }
    }

    // Display last update time if element exists
    const updateEl = document.getElementById('last-update-time');
    if (updateEl) {
        let lastUpdateStr = '';

        // Find latest release date from data
        let latestTime = 0;
        let latestDateStr = '';
        const checkLatest = (item) => {
            if (item && item.date_added) {
                const t = parseDateAdded(item.date_added);
                if (t > latestTime) {
                    latestTime = t;
                    latestDateStr = item.date_added;
                }
            }
        };

        if (appState.rawReleases) appState.rawReleases.forEach(checkLatest);
        if (appState.rawStats) appState.rawStats.forEach(checkLatest);

        if (latestDateStr) {
            // Format to "DD/MM/YYYY HH:MM" (strip seconds)
            const parts = latestDateStr.split(':');
            if (parts.length === 3) {
                lastUpdateStr = `${parts[0]}:${parts[1]}`;
            } else {
                lastUpdateStr = latestDateStr;
            }
        }

        if (lastUpdateStr) {
            updateEl.innerHTML = `<i class="far fa-clock"></i> Mise à jour : ${lastUpdateStr}`;
            updateEl.style.display = 'inline-flex';
        } else {
            updateEl.style.display = 'none';
        }
    }

    // Set up date select listener (if explorer is enabled)
    if (explorerEnabled && dateSelect) {
        dateSelect.addEventListener('change', () => {
            const selectedDate = dateSelect.value;
            resetFiltersUI();
            if (selectedDate) {
                applyDateFilter(selectedDate);
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.dispatchEvent(new Event('input'));
                }
            }
        });
    }
});

// Helper to parse date string format "DD/MM/YYYY HH:MM:SS" for sorting
function parseDateAdded(dateStr) {
    if (!dateStr) return 0;
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return 0;
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    if (dateParts.length !== 3 || timeParts.length !== 3) return 0;
    return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]).getTime();
}

// Load and decompress a database file (gzip JSON)
async function loadDatabaseFile(filename) {
    try {
        const res = await fetch(filename);
        if (!res.ok) return null;

        const ds = new DecompressionStream('gzip');
        const decompressedStream = res.body.pipeThrough(ds);
        const jsonText = await new Response(decompressedStream).text();
        const parsed = JSON.parse(jsonText);

        // Reconstruct columnar format into array of objects
        let items = [];
        if (parsed && parsed.keys && parsed.rows) {
            items = parsed.rows.map(row => {
                const item = {};
                parsed.keys.forEach((key, index) => {
                    const val = row[index];
                    if (val !== null && val !== undefined) {
                        item[key] = val;
                    }
                });
                return item;
            });
        } else if (Array.isArray(parsed)) {
            items = parsed;
        } else {
            return parsed;
        }

        return items;
    } catch (e) {
        console.warn(`Failed to fetch ${filename}:`, e);
        return null;
    }
}

// Filter the in-memory raw releases list based on date ranges
function applyDateFilter(dateVal) {
    const now = new Date();

    if (dateVal === 'all') {
        appState.allReleases = [...appState.rawReleases];
    } else if (dateVal === 'last24h') {
        const limit = now.getTime() - 24 * 60 * 60 * 1000;
        appState.allReleases = appState.rawReleases.filter(r => parseDateAdded(r.date_added) >= limit);
    } else if (dateVal === 'last48h') {
        const limit = now.getTime() - 48 * 60 * 60 * 1000;
        appState.allReleases = appState.rawReleases.filter(r => parseDateAdded(r.date_added) >= limit);
    } else if (dateVal === 'last7d') {
        const limit = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        appState.allReleases = appState.rawReleases.filter(r => parseDateAdded(r.date_added) >= limit);
    } else if (dateVal === 'last30d') {
        const limit = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        appState.allReleases = appState.rawReleases.filter(r => parseDateAdded(r.date_added) >= limit);
    } else if (dateVal === 'last180d') {
        const limit = now.getTime() - 180 * 24 * 60 * 60 * 1000;
        appState.allReleases = appState.rawReleases.filter(r => parseDateAdded(r.date_added) >= limit);
    } else {
        appState.allReleases = appState.rawReleases.filter(r => {
            if (!r.date_added) return false;
            const parts = r.date_added.split(' ')[0].split('/');
            if (parts.length === 3) {
                const yyyymmdd = `${parts[2]}-${parts[1]}-${parts[0]}`;
                return yyyymmdd === dateVal;
            }
            return false;
        });
    }
}

// Reset filters UI
function resetFiltersUI() {
    const search = document.getElementById('search-input');
    const cat = document.getElementById('filter-category');
    const res = document.getElementById('filter-resolution');
    const qual = document.getElementById('filter-quality');
    const lang = document.getElementById('filter-language');
    const group = document.getElementById('filter-group');
    const audio = document.getElementById('filter-audio');
    const channels = document.getElementById('filter-channels');
    const extension = document.getElementById('filter-extension');
    const codec = document.getElementById('filter-codec');

    if (search) search.value = '';
    if (cat) cat.value = '';
    if (res) res.value = '';
    if (qual) qual.value = '';
    if (lang) lang.value = '';
    if (group) group.value = '';
    if (audio) audio.value = '';
    if (channels) channels.value = '';
    if (extension) extension.value = '';
    if (codec) codec.value = '';
}

// Initialize pagination button listeners
function initPaginationButtons() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            if (appState.currentPage > 1) {
                appState.currentPage--;
                renderReleasesTable();
                document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(appState.filteredReleases.length / appState.itemsPerPage) || 1;
            if (appState.currentPage < totalPages) {
                appState.currentPage++;
                renderReleasesTable();
                document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
}

// Tab Navigation
function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.getAttribute('data-target');
            document.querySelectorAll('.view-section').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(target).classList.add('active');

            if (target === 'stats-view') {
                // Populate/refresh statistics dashboard and charts
                updateStatsDashboard();
                setTimeout(renderStatsCharts, 50);
            }
        });
    });
}

function initFilterHandlers() {
    const search = document.getElementById('search-input');
    const cat = document.getElementById('filter-category');
    const res = document.getElementById('filter-resolution');
    const qual = document.getElementById('filter-quality');
    const lang = document.getElementById('filter-language');
    const group = document.getElementById('filter-group');
    const audio = document.getElementById('filter-audio');
    const channels = document.getElementById('filter-channels');
    const extension = document.getElementById('filter-extension');
    const codec = document.getElementById('filter-codec');

    const handleFilters = () => {
        appState.currentPage = 1;
        const query = search.value.toLowerCase().trim();
        const categoryVal = cat.value;
        const resVal = res.value;
        const qualVal = qual.value;
        const langVal = lang.value;
        const groupVal = group.value;
        const audioVal = audio ? audio.value : '';
        const channelsVal = channels ? channels.value : '';
        const extensionVal = extension ? extension.value : '';
        const codecVal = codec ? codec.value : '';

        appState.filteredReleases = appState.allReleases.filter(item => {
            // Search Query matching
            const matchQuery = !query ||
                item.filename.toLowerCase().includes(query) ||
                (item.title && item.title.toLowerCase().includes(query)) ||
                (item.group && item.group.toLowerCase().includes(query)) ||
                (item.imdb_id && String(item.imdb_id).includes(query)) ||
                (item.link_source && item.link_source.toLowerCase().includes(query));

            // Category matching
            const matchCategory = !categoryVal || item.category === categoryVal;

            // Resolution matching
            const matchResolution = !resVal || (item.resolution && item.resolution.toLowerCase() === resVal.toLowerCase());

            // Quality matching
            const matchQuality = !qualVal || (item.quality && item.quality.toUpperCase() === qualVal.toUpperCase());

            // Language matching
            const matchLanguage = !langVal || (item.languages && item.languages.some(l => l.toUpperCase() === langVal.toUpperCase()));

            // Group matching
            const matchGroup = !groupVal || (item.group && item.group.toUpperCase() === groupVal.toUpperCase());

            // Audio matching
            const matchAudio = !audioVal || (item.audio && item.audio.toUpperCase() === audioVal.toUpperCase());

            // Channels matching
            const matchChannels = !channelsVal || (item.channels && item.channels.toUpperCase() === channelsVal.toUpperCase());

            // Extension matching
            let matchExtension = true;
            if (extensionVal) {
                if (item.filename) {
                    const parts = item.filename.split('.');
                    if (parts.length > 1) {
                        const ext = parts[parts.length - 1].toUpperCase();
                        matchExtension = (ext === extensionVal.toUpperCase());
                    } else {
                        matchExtension = false;
                    }
                } else {
                    matchExtension = false;
                }
            }

            // Codec matching
            let matchCodec = false;
            if (!codecVal) {
                matchCodec = true;
            } else if (codecVal === 'NON SPÉCIFIÉ') {
                matchCodec = !item.codec;
            } else {
                matchCodec = item.codec && item.codec.toUpperCase() === codecVal.toUpperCase();
            }

            return matchQuery && matchCategory && matchResolution && matchQuality && matchLanguage && matchGroup && matchAudio && matchChannels && matchExtension && matchCodec;
        });

        renderReleasesTable();
    };

    search.addEventListener('input', handleFilters);
    cat.addEventListener('change', handleFilters);
    res.addEventListener('change', handleFilters);
    qual.addEventListener('change', handleFilters);
    lang.addEventListener('change', handleFilters);
    if (group) group.addEventListener('change', handleFilters);
    if (audio) audio.addEventListener('change', handleFilters);
    if (channels) channels.addEventListener('change', handleFilters);
    if (extension) extension.addEventListener('change', handleFilters);
    if (codec) codec.addEventListener('change', handleFilters);
}

// Helper to format date into friendly relative age
function formatAge(dateStr) {
    if (!dateStr) return 'Inconnu';

    // Parse format "DD/MM/YYYY HH:MM:SS"
    const parts = dateStr.split(' ');
    if (parts.length < 2) return dateStr;
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    if (dateParts.length < 3 || timeParts.length < 2) return dateStr;

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const min = parseInt(timeParts[1], 10);
    const sec = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

    const parsedDate = new Date(year, month, day, hour, min, sec);
    const now = new Date();
    const diffMs = now - parsedDate;

    if (isNaN(diffMs) || diffMs < 0) {
        return parts[0]; // Fallback to date only
    }

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} j`;

    return parts[0]; // Return DD/MM/YYYY
}

// Render Release List Rows
function renderReleasesTable() {
    const container = document.getElementById('releases-list');
    container.innerHTML = '';

    const totalItems = appState.filteredReleases.length;
    const totalPages = Math.ceil(totalItems / appState.itemsPerPage) || 1;

    if (appState.currentPage > totalPages) {
        appState.currentPage = totalPages;
    }
    if (appState.currentPage < 1) {
        appState.currentPage = 1;
    }

    // Update pagination controls UI
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const infoSpan = document.getElementById('pagination-info');

    if (prevBtn && nextBtn && infoSpan) {
        prevBtn.disabled = appState.currentPage === 1;
        nextBtn.disabled = appState.currentPage === totalPages;
        infoSpan.textContent = `Page ${appState.currentPage} sur ${totalPages} (${totalItems} fichiers)`;
    }

    if (totalItems === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-dim);">
                <i class="fas fa-search" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                Aucun fichier ne correspond à vos filtres
            </div>
        `;
        return;
    }

    const startIndex = (appState.currentPage - 1) * appState.itemsPerPage;
    const endIndex = Math.min(startIndex + appState.itemsPerPage, totalItems);
    const paginatedItems = appState.filteredReleases.slice(startIndex, endIndex);

    paginatedItems.forEach((item, idx) => {
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'table-row-container';
        rowWrapper.id = `row-${idx}`;

        // Category Badge
        const catBadgeHtml = item.category === 'series'
            ? `<span class="cat-badge series"><i class="fas fa-tv"></i> Série</span>`
            : `<span class="cat-badge movie"><i class="fas fa-film"></i> Film</span>`;

        // Attributes Badges
        let badgesHtml = '';
        if (item.resolution) {
            const resClass = `res-${item.resolution.toLowerCase()}`;
            badgesHtml += `<span class="parsed-badge ${resClass}">${item.resolution.toUpperCase()}</span>`;
        }
        if (item.quality) {
            badgesHtml += `<span class="parsed-badge">${item.quality}</span>`;
        }
        if (item.codec) {
            const codecClass = `codec-${item.codec.toLowerCase()}`;
            badgesHtml += `<span class="parsed-badge ${codecClass}">${item.codec}</span>`;
        }
        if (item.v_quality) {
            const isHdr = item.v_quality.toUpperCase().includes('HDR') || item.v_quality.toUpperCase().includes('DV');
            badgesHtml += `<span class="parsed-badge ${isHdr ? 'hdr' : ''}">${item.v_quality}</span>`;
        }
        if (item.languages && item.languages.length > 0) {
            item.languages.forEach(l => {
                const isMulti = l.toUpperCase() === 'MULTI';
                badgesHtml += `<span class="parsed-badge ${isMulti ? 'lang-multi' : ''}">${l}</span>`;
            });
        }

        // Construct beautiful clean display title
        let displayTitle = item.title || item.filename;
        if (item.category === 'series') {
            let seasonEp = '';
            if (item.season && item.episode) {
                const s = String(item.season).padStart(2, '0');
                const e = String(item.episode).padStart(2, '0');
                seasonEp = `S${s}E${e}`;
            } else if (item.season) {
                seasonEp = `Saison ${item.season}`;
            } else if (item.episode) {
                seasonEp = `Épisode ${item.episode}`;
            }
            displayTitle = `${displayTitle}${seasonEp ? ' - ' + seasonEp : ''}`;
            if (item.episode_name) {
                displayTitle += ` (${item.episode_name})`;
            }
        } else {
            if (item.year) {
                displayTitle = `${displayTitle} (${item.year})`;
            }
        }

        rowWrapper.innerHTML = `
            <div class="table-row">
                <div class="col-date" title="${item.date_added || ''}">${formatAge(item.date_added)}</div>
                <div class="col-title" title="${item.filename}">${item.filename}</div>
                <div class="col-cat">${catBadgeHtml}</div>
                <div class="col-badges">${badgesHtml}</div>
                <div class="col-actions">
                    <button class="expand-btn"><i class="fas fa-chevron-down"></i></button>
                </div>
            </div>
            <div class="row-details">
                <div class="details-layout">
                    <div class="details-poster-container">
                        ${item.imdb_id ? `
                            <a href="${item.imdb_id.startsWith('tt') ? 'https://www.imdb.com/title/' + item.imdb_id : 'https://www.themoviedb.org/' + (item.category === 'series' ? 'tv' : 'movie') + '/' + item.imdb_id}" target="_blank" title="Voir sur ${item.imdb_id.startsWith('tt') ? 'IMDb' : 'TMDb'}">
                                <img src="posters/${item.imdb_id}.jpg" class="details-poster" onerror="this.onerror=null; if (this.src.indexOf('metahub') === -1 && '${item.imdb_id}'.startsWith('tt')) { this.src='https://images.metahub.space/poster/medium/' + '${item.imdb_id}' + '/img'; } else { this.src='no-poster.svg'; }">
                            </a>
                        ` : `
                            <img src="no-poster.svg" class="details-poster" title="Aucun identifiant disponible">
                        `}
                    </div>
                    <div class="details-grid">
                        <div class="detail-item" style="grid-column: span 2;">
                            <span class="detail-label">Nom brut du fichier</span>
                            <span class="detail-value" style="font-family: var(--font-mono); font-size: 12px; word-break: break-all; margin-top: 4px; display: block;">${item.filename}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Titre Parsé</span>
                            <span class="detail-value" style="font-weight: 700;">${item.title || 'N/A'}</span>
                        </div>
                        ${item.official_title ? `
                        <div class="detail-item">
                            <span class="detail-label">Titre Officiel</span>
                            <span class="detail-value" style="font-weight: 700; color: var(--accent-orange);">${item.official_title}</span>
                        </div>` : ''}
                        ${item.official_year ? `
                        <div class="detail-item">
                            <span class="detail-label">Année Officielle</span>
                            <span class="detail-value" style="font-weight: 700; color: var(--accent-orange);">${item.official_year}</span>
                        </div>` : ''}
                        ${item.group ? `
                        <div class="detail-item">
                            <span class="detail-label">Groupe</span>
                            <span class="detail-value" style="font-weight: 700; color: var(--accent-purple);">${item.group}</span>
                        </div>` : ''}
                        ${item.size ? `
                        <div class="detail-item">
                            <span class="detail-label">Taille</span>
                            <span class="detail-value" style="font-weight: 700; color: var(--accent-blue);">${item.size}</span>
                        </div>` : ''}
                        ${item.year ? `
                        <div class="detail-item">
                            <span class="detail-label">Année</span>
                            <span class="detail-value">${item.year}</span>
                        </div>` : ''}
                        ${item.season ? `
                        <div class="detail-item">
                            <span class="detail-label">Saison</span>
                            <span class="detail-value">${item.season}</span>
                        </div>` : ''}
                        ${item.episode ? `
                        <div class="detail-item">
                            <span class="detail-label">Épisode</span>
                            <span class="detail-value">${item.episode} ${item.episode_name ? `(${item.episode_name})` : ''}</span>
                        </div>` : ''}
                        ${item.network ? `
                        <div class="detail-item">
                            <span class="detail-label">Réseau / Source</span>
                            <span class="detail-value">${item.network}</span>
                        </div>` : ''}
                        ${item.audio ? `
                        <div class="detail-item">
                            <span class="detail-label">Format Audio</span>
                            <span class="detail-value">${item.audio} ${item.channels ? `(${item.channels})` : ''}</span>
                        </div>` : ''}
                        ${item.extra ? `
                        <div class="detail-item">
                            <span class="detail-label">Extra</span>
                            <span class="detail-value">${item.extra}</span>
                        </div>` : ''}

                        ${item.imdb_id ? `
                        <div class="detail-item">
                            <span class="detail-label">ID TMDB / IMDb</span>
                            <span class="detail-value">
                                <a href="${item.imdb_id.startsWith('tt') ? 'https://www.imdb.com/title/' + item.imdb_id : 'https://www.themoviedb.org/' + (item.category === 'series' ? 'tv' : 'movie') + '/' + item.imdb_id}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-weight: 700;">
                                    <i class="fas fa-external-link-alt" style="font-size: 10px; margin-right: 4px;"></i>${item.imdb_id}
                                </a>
                            </span>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Toggle Expand
        const mainRow = rowWrapper.querySelector('.table-row');
        mainRow.addEventListener('click', () => {
            rowWrapper.classList.toggle('expanded');
        });

        container.appendChild(rowWrapper);
    });
}

// Update Summary Cards
function updateStatsDashboard() {
    const todayEl = document.getElementById('stat-today-additions');
    const totalEl = document.getElementById('stat-total-releases');
    const sizeEl = document.getElementById('stat-total-size');
    const moviesEl = document.getElementById('stat-total-movies');
    const seriesEl = document.getElementById('stat-total-series');
    const groupsEl = document.getElementById('stat-unique-groups');

    const total = appState.rawStats.length;
    
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const todayAdditions = appState.rawStats.filter(r => r.date_added && r.date_added.startsWith(todayStr)).length;

    const movies = appState.rawStats.filter(r => r.category === 'movie').length;
    const series = appState.rawStats.filter(r => r.category === 'series').length;

    const uniqueMovies = new Set();
    const uniqueSeries = new Set();
    let totalBytes = 0;

    appState.rawStats.forEach(r => {
        if (r.title) {
            if (r.category === 'movie') {
                const key = r.imdb_id ? String(r.imdb_id) : `${r.title.toLowerCase()}||${r.year || ''}`;
                uniqueMovies.add(key);
            } else if (r.category === 'series') {
                const key = r.imdb_id ? String(r.imdb_id) : r.title.toLowerCase();
                uniqueSeries.add(key);
            }
        }
        if (r.size) {
            const match = r.size.match(/^([\d.]+)\s*([a-zA-Z]+)/);
            if (match) {
                const val = parseFloat(match[1]);
                const unit = match[2].toUpperCase();
                if (unit === 'GB' || unit === 'GO' || unit === 'G') {
                    totalBytes += val * 1024 * 1024 * 1024;
                } else if (unit === 'MB' || unit === 'MO' || unit === 'M') {
                    totalBytes += val * 1024 * 1024;
                } else if (unit === 'KB' || unit === 'KO' || unit === 'K') {
                    totalBytes += val * 1024;
                } else if (unit === 'TB' || unit === 'TO' || unit === 'T') {
                    totalBytes += val * 1024 * 1024 * 1024 * 1024;
                } else {
                    totalBytes += val;
                }
            }
        }
    });

    const uniqueGroups = new Set();
    appState.rawStats.forEach(r => { if (r.group) uniqueGroups.add(r.group.toUpperCase()); });

    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    let formattedSize = "0 Mo";
    if (totalBytes > 0) {
        const units = ['Octets', 'Ko', 'Mo', 'Go', 'To', 'Po'];
        let i = 0;
        let b = totalBytes;
        while (b >= 1024 && i < units.length - 1) {
            b /= 1024;
            i++;
        }
        const decimals = i >= 3 ? 2 : 0;
        formattedSize = `${b.toFixed(decimals)} ${units[i]}`;
    }

    if (todayEl) todayEl.textContent = formatNumber(todayAdditions);
    totalEl.textContent = formatNumber(total);
    if (sizeEl) sizeEl.textContent = formattedSize;
    moviesEl.textContent = formatNumber(movies);
    seriesEl.textContent = formatNumber(series);
    groupsEl.textContent = formatNumber(uniqueGroups.size);

    const uniqueMoviesEl = document.getElementById('stat-unique-movies');
    if (uniqueMoviesEl) uniqueMoviesEl.textContent = `${formatNumber(uniqueMovies.size)} uniques`;

    const uniqueSeriesEl = document.getElementById('stat-unique-series');
    if (uniqueSeriesEl) uniqueSeriesEl.textContent = `${formatNumber(uniqueSeries.size)} uniques`;
}

// Generate/Render Chart.js charts
function renderStatsCharts() {
    // Helper to destroy existing charts before recreating
    const cleanChart = (id) => {
        if (appState.charts[id]) {
            appState.charts[id].destroy();
        }
    };

    const data = appState.rawStats;


    // Chart 2: Qualities Trend Over Time (Line Chart)
    cleanChart('quality-trend');

    // 1. Group qualities counts per day
    const dailyQualCounts = {};
    const allQualCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailyQualCounts[dateOnly]) {
                dailyQualCounts[dateOnly] = {};
            }
            const qual = r.quality ? r.quality.toUpperCase() : 'AUTRE';
            dailyQualCounts[dateOnly][qual] = (dailyQualCounts[dateOnly][qual] || 0) + 1;
            allQualCounts[qual] = (allQualCounts[qual] || 0) + 1;
        }
    });

    // 2. Identify top 4 qualities
    const topQualities = Object.entries(allQualCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);

    // 3. Get sorted dates
    const qualTrendDates = Object.keys(dailyQualCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    // 4. Filter by period dropdown
    const qualTrendPeriodSelect = document.getElementById('select-quality-trend-period');
    const qualTrendPeriodVal = qualTrendPeriodSelect ? qualTrendPeriodSelect.value : '7';
    let targetQualTrendDates;
    if (qualTrendPeriodVal === 'all') {
        targetQualTrendDates = qualTrendDates;
    } else {
        const limit = parseInt(qualTrendPeriodVal, 10) || 7;
        targetQualTrendDates = qualTrendDates.slice(-limit);
    }

    // Event listener setup
    if (qualTrendPeriodSelect && !qualTrendPeriodSelect.dataset.listenerAdded) {
        qualTrendPeriodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        qualTrendPeriodSelect.dataset.listenerAdded = 'true';
    }

    // 5. Build line datasets
    const qualColors = [
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' },  // Blue
        { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' },   // Cyan
        { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.05)' },  // Purple
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },  // Green
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' }   // Orange
    ];

    const qualDatasets = topQualities.map((qual, idx) => {
        const color = qualColors[idx] || qualColors[qualColors.length - 1];
        const qualData = targetQualTrendDates.map(d => {
            return (dailyQualCounts[d] && dailyQualCounts[d][qual]) || 0;
        });

        return {
            label: qual,
            data: qualData,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: color.border,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    const ctxQualTrend = document.getElementById('chart-quality-trend').getContext('2d');
    appState.charts['quality-trend'] = new Chart(ctxQualTrend, {
        type: 'line',
        data: {
            labels: targetQualTrendDates,
            datasets: qualDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' }
                }
            }
        }
    });


    // Chart 3b: Audio Codecs Trend Over Time (Line Chart)
    cleanChart('audio-trend');

    // 1. Group audio codecs counts per day
    const dailyAudioCounts = {};
    const allAudioCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailyAudioCounts[dateOnly]) {
                dailyAudioCounts[dateOnly] = {};
            }
            const ac = r.audio ? r.audio.toUpperCase() : 'NON SPÉCIFIÉ';
            dailyAudioCounts[dateOnly][ac] = (dailyAudioCounts[dateOnly][ac] || 0) + 1;
            allAudioCounts[ac] = (allAudioCounts[ac] || 0) + 1;
        }
    });

    // 2. Identify top 4 audio codecs
    const topAudio = Object.entries(allAudioCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);

    // 3. Get sorted dates
    const audioTrendDates = Object.keys(dailyAudioCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    // 4. Filter by period dropdown
    const audioTrendPeriodSelect = document.getElementById('select-audio-trend-period');
    const audioTrendPeriodVal = audioTrendPeriodSelect ? audioTrendPeriodSelect.value : '7';
    let targetAudioTrendDates;
    if (audioTrendPeriodVal === 'all') {
        targetAudioTrendDates = audioTrendDates;
    } else {
        const limit = parseInt(audioTrendPeriodVal, 10) || 7;
        targetAudioTrendDates = audioTrendDates.slice(-limit);
    }

    // Event listener setup
    if (audioTrendPeriodSelect && !audioTrendPeriodSelect.dataset.listenerAdded) {
        audioTrendPeriodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        audioTrendPeriodSelect.dataset.listenerAdded = 'true';
    }

    // 5. Build line datasets
    const audioColors = [
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)' },  // Pink
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },   // Orange
        { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' },   // Cyan
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' },   // Blue
        { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.05)' }    // Purple
    ];

    const audioDatasets = topAudio.map((ac, idx) => {
        const color = audioColors[idx] || audioColors[audioColors.length - 1];
        const acData = targetAudioTrendDates.map(d => {
            return (dailyAudioCounts[d] && dailyAudioCounts[d][ac]) || 0;
        });

        return {
            label: ac,
            data: acData,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: color.border,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    const ctxAudioTrend = document.getElementById('chart-audio-trend').getContext('2d');
    appState.charts['audio-trend'] = new Chart(ctxAudioTrend, {
        type: 'line',
        data: {
            labels: targetAudioTrendDates,
            datasets: audioDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' }
                }
            }
        }
    });

    // Chart 5: Daily additions (stacked bar chart of Movie vs Series)
    cleanChart('daily-additions');
    const dailyMovieCounts = {};
    const dailySeriesCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailyMovieCounts[dateOnly]) dailyMovieCounts[dateOnly] = 0;
            if (!dailySeriesCounts[dateOnly]) dailySeriesCounts[dateOnly] = 0;

            if (r.category === 'series') {
                dailySeriesCounts[dateOnly]++;
            } else {
                dailyMovieCounts[dateOnly]++;
            }
        }
    });

    const sortedDates = Object.keys(dailyMovieCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    // Get period from selector (default to 7)
    const periodSelect = document.getElementById('select-daily-period');
    const periodVal = periodSelect ? periodSelect.value : '7';
    let recentDates;
    if (periodVal === 'all') {
        recentDates = sortedDates;
    } else {
        const limit = parseInt(periodVal, 10) || 7;
        recentDates = sortedDates.slice(-limit);
    }

    // Setup listener once
    if (periodSelect && !periodSelect.dataset.listenerAdded) {
        periodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        periodSelect.dataset.listenerAdded = 'true';
    }

    const movieData = recentDates.map(d => dailyMovieCounts[d]);
    const seriesData = recentDates.map(d => dailySeriesCounts[d]);

    const ctxDaily = document.getElementById('chart-daily-additions').getContext('2d');

    appState.charts['daily-additions'] = new Chart(ctxDaily, {
        type: 'bar',
        data: {
            labels: recentDates,
            datasets: [
                {
                    label: 'Films',
                    data: movieData,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Séries',
                    data: seriesData,
                    backgroundColor: 'rgba(168, 85, 247, 0.75)',
                    borderColor: '#a855f7',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' }
                }
            }
        }
    });

    // Chart 5: Video Codecs Trend Over Time (Line Chart)
    cleanChart('codec-trend');

    // 1. Group video codecs counts per day
    const dailyCodecCounts = {};
    const allCodecCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailyCodecCounts[dateOnly]) {
                dailyCodecCounts[dateOnly] = {};
            }
            const c = r.codec ? r.codec.toUpperCase() : 'NON SPÉCIFIÉ';
            dailyCodecCounts[dateOnly][c] = (dailyCodecCounts[dateOnly][c] || 0) + 1;
            allCodecCounts[c] = (allCodecCounts[c] || 0) + 1;
        }
    });

    // 2. Identify top 4 video codecs
    const topCodecs = Object.entries(allCodecCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);

    // 3. Get sorted dates
    const codecTrendDates = Object.keys(dailyCodecCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    // 4. Filter by period dropdown
    const codecTrendPeriodSelect = document.getElementById('select-codec-trend-period');
    const codecTrendPeriodVal = codecTrendPeriodSelect ? codecTrendPeriodSelect.value : '7';
    let targetTrendDates;
    if (codecTrendPeriodVal === 'all') {
        targetTrendDates = codecTrendDates;
    } else {
        const limit = parseInt(codecTrendPeriodVal, 10) || 7;
        targetTrendDates = codecTrendDates.slice(-limit);
    }

    // Event listener setup
    if (codecTrendPeriodSelect && !codecTrendPeriodSelect.dataset.listenerAdded) {
        codecTrendPeriodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        codecTrendPeriodSelect.dataset.listenerAdded = 'true';
    }

    // 5. Build line datasets
    const lineColors = [
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' }, // Blue
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' }, // Green
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },  // Yellow
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)' },  // Pink
        { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.05)' }   // Indigo
    ];

    const codecDatasets = topCodecs.map((codec, idx) => {
        const color = lineColors[idx] || lineColors[lineColors.length - 1];
        const codecData = targetTrendDates.map(d => {
            return (dailyCodecCounts[d] && dailyCodecCounts[d][codec]) || 0;
        });

        return {
            label: codec,
            data: codecData,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: color.border,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    const ctxCodecTrend = document.getElementById('chart-codec-trend').getContext('2d');
    appState.charts['codec-trend'] = new Chart(ctxCodecTrend, {
        type: 'line',
        data: {
            labels: targetTrendDates,
            datasets: codecDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' }
                }
            }
        }
    });

    // Chart 5a: Resolutions Trend Over Time (Line Chart)
    cleanChart('resolution-trend');

    // 1. Group resolutions counts per day
    const dailyResCounts = {};
    const allResCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailyResCounts[dateOnly]) {
                dailyResCounts[dateOnly] = {};
            }
            const res = r.resolution ? r.resolution.toUpperCase() : 'NON SPÉCIFIÉ';
            dailyResCounts[dateOnly][res] = (dailyResCounts[dateOnly][res] || 0) + 1;
            allResCounts[res] = (allResCounts[res] || 0) + 1;
        }
    });

    // 2. Identify top 5 resolutions
    const topResolutions = Object.entries(allResCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

    // 3. Get sorted dates
    const resTrendDates = Object.keys(dailyResCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    // 4. Filter by period dropdown
    const resTrendPeriodSelect = document.getElementById('select-resolution-trend-period');
    const resTrendPeriodVal = resTrendPeriodSelect ? resTrendPeriodSelect.value : '7';
    let targetResTrendDates;
    if (resTrendPeriodVal === 'all') {
        targetResTrendDates = resTrendDates;
    } else {
        const limit = parseInt(resTrendPeriodVal, 10) || 7;
        targetResTrendDates = resTrendDates.slice(-limit);
    }

    // Event listener setup
    if (resTrendPeriodSelect && !resTrendPeriodSelect.dataset.listenerAdded) {
        resTrendPeriodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        resTrendPeriodSelect.dataset.listenerAdded = 'true';
    }

    // 5. Build line datasets
    const resColors = [
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' },  // Yellow/Orange
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' },  // Blue
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' },  // Green
        { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.05)' },  // Purple
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)' }   // Pink
    ];

    const resDatasets = topResolutions.map((res, idx) => {
        const color = resColors[idx] || resColors[resColors.length - 1];
        const resData = targetResTrendDates.map(d => {
            return (dailyResCounts[d] && dailyResCounts[d][res]) || 0;
        });

        return {
            label: res,
            data: resData,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: color.border,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    const ctxResTrend = document.getElementById('chart-resolution-trend').getContext('2d');
    appState.charts['resolution-trend'] = new Chart(ctxResTrend, {
        type: 'line',
        data: {
            labels: targetResTrendDates,
            datasets: resDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' }
                }
            }
        }
    });

    // Chart 5b: Daily size additions
    cleanChart('daily-size');
    const dailySizeCounts = {};

    data.forEach(r => {
        if (r.date_added) {
            const dateOnly = r.date_added.split(' ')[0]; // DD/MM/YYYY
            if (!dailySizeCounts[dateOnly]) dailySizeCounts[dateOnly] = 0;

            if (r.size) {
                const match = r.size.match(/^([\d.]+)\s*([a-zA-Z]+)/);
                if (match) {
                    const val = parseFloat(match[1]);
                    const unit = match[2].toUpperCase();
                    if (unit === 'GB' || unit === 'GO' || unit === 'G') {
                        dailySizeCounts[dateOnly] += val;
                    } else if (unit === 'MB' || unit === 'MO' || unit === 'M') {
                        dailySizeCounts[dateOnly] += val / 1024;
                    } else if (unit === 'KB' || unit === 'KO' || unit === 'K') {
                        dailySizeCounts[dateOnly] += val / (1024 * 1024);
                    } else if (unit === 'TB' || unit === 'TO' || unit === 'T') {
                        dailySizeCounts[dateOnly] += val * 1024;
                    } else {
                        dailySizeCounts[dateOnly] += val / (1024 * 1024 * 1024);
                    }
                }
            }
        }
    });

    const sortedSizeDates = Object.keys(dailySizeCounts).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
    });

    const sizePeriodSelect = document.getElementById('select-daily-size-period');
    const sizePeriodVal = sizePeriodSelect ? sizePeriodSelect.value : '7';
    let recentSizeDates;
    if (sizePeriodVal === 'all') {
        recentSizeDates = sortedSizeDates;
    } else {
        const limit = parseInt(sizePeriodVal, 10) || 7;
        recentSizeDates = sortedSizeDates.slice(-limit);
    }

    if (sizePeriodSelect && !sizePeriodSelect.dataset.listenerAdded) {
        sizePeriodSelect.addEventListener('change', () => {
            renderStatsCharts();
        });
        sizePeriodSelect.dataset.listenerAdded = 'true';
    }

    const sizeData = recentSizeDates.map(d => dailySizeCounts[d]);
    const ctxDailySize = document.getElementById('chart-daily-size').getContext('2d');

    appState.charts['daily-size'] = new Chart(ctxDailySize, {
        type: 'bar',
        data: {
            labels: recentSizeDates,
            datasets: [
                {
                    label: 'Volume (Go)',
                    data: sizeData,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.75)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Outfit' },
                        callback: function (value) {
                            return value + ' Go';
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'Outfit' },
                    callbacks: {
                        label: function (context) {
                            let val = context.parsed.y;
                            if (val >= 1024) {
                                return `Volume : ${(val / 1024).toFixed(2)} To`;
                            }
                            return `Volume : ${val.toFixed(2)} Go`;
                        }
                    }
                }
            }
        }
    });

    // Helper to parse release dates
    const parseReleaseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length < 3) return null;
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Movies Scoreboard Dropdown Setup
    const moviesPeriodSelect = document.getElementById('select-movies-period');
    const moviesPeriodVal = moviesPeriodSelect ? moviesPeriodSelect.value : '1';
    if (moviesPeriodSelect && !moviesPeriodSelect.dataset.listenerAdded) {
        moviesPeriodSelect.addEventListener('change', () => renderStatsCharts());
        moviesPeriodSelect.dataset.listenerAdded = 'true';
    }

    let moviesPeriodStart = null;
    let moviesPeriodEnd = null;
    if (moviesPeriodVal === 'yesterday') {
        const oneDay = 24 * 60 * 60 * 1000;
        moviesPeriodStart = new Date(today.getTime() - oneDay);
        moviesPeriodEnd = today;
    } else if (moviesPeriodVal !== 'all') {
        const limitDays = parseInt(moviesPeriodVal, 10) || 7;
        const oneDay = 24 * 60 * 60 * 1000;
        moviesPeriodStart = new Date(today.getTime() - (limitDays - 1) * oneDay);
    }

    // 2. Series Scoreboard Dropdown Setup
    const seriesPeriodSelect = document.getElementById('select-series-period');
    const seriesPeriodVal = seriesPeriodSelect ? seriesPeriodSelect.value : '1';
    if (seriesPeriodSelect && !seriesPeriodSelect.dataset.listenerAdded) {
        seriesPeriodSelect.addEventListener('change', () => renderStatsCharts());
        seriesPeriodSelect.dataset.listenerAdded = 'true';
    }

    let seriesPeriodStart = null;
    let seriesPeriodEnd = null;
    if (seriesPeriodVal === 'yesterday') {
        const oneDay = 24 * 60 * 60 * 1000;
        seriesPeriodStart = new Date(today.getTime() - oneDay);
        seriesPeriodEnd = today;
    } else if (seriesPeriodVal !== 'all') {
        const limitDays = parseInt(seriesPeriodVal, 10) || 7;
        const oneDay = 24 * 60 * 60 * 1000;
        seriesPeriodStart = new Date(today.getTime() - (limitDays - 1) * oneDay);
    }

    // 3. Groups Scoreboard Dropdown Setup
    const groupsPeriodSelect = document.getElementById('select-groups-week-period');
    const groupsPeriodVal = groupsPeriodSelect ? groupsPeriodSelect.value : '1';
    if (groupsPeriodSelect && !groupsPeriodSelect.dataset.listenerAdded) {
        groupsPeriodSelect.addEventListener('change', () => renderStatsCharts());
        groupsPeriodSelect.dataset.listenerAdded = 'true';
    }

    let groupsPeriodStart = null;
    let groupsPeriodEnd = null;
    if (groupsPeriodVal === 'yesterday') {
        const oneDay = 24 * 60 * 60 * 1000;
        groupsPeriodStart = new Date(today.getTime() - oneDay);
        groupsPeriodEnd = today;
    } else if (groupsPeriodVal !== 'all') {
        const limitDays = parseInt(groupsPeriodVal, 10) || 7;
        const oneDay = 24 * 60 * 60 * 1000;
        groupsPeriodStart = new Date(today.getTime() - (limitDays - 1) * oneDay);
    }

    // 4. Biggest Files Scoreboard Dropdown Setup
    const biggestPeriodSelect = document.getElementById('select-biggest-files-period');
    const biggestPeriodVal = biggestPeriodSelect ? biggestPeriodSelect.value : '1';
    if (biggestPeriodSelect && !biggestPeriodSelect.dataset.listenerAdded) {
        biggestPeriodSelect.addEventListener('change', () => renderStatsCharts());
        biggestPeriodSelect.dataset.listenerAdded = 'true';
    }

    let biggestPeriodStart = null;
    let biggestPeriodEnd = null;
    if (biggestPeriodVal === 'yesterday') {
        const oneDay = 24 * 60 * 60 * 1000;
        biggestPeriodStart = new Date(today.getTime() - oneDay);
        biggestPeriodEnd = today;
    } else if (biggestPeriodVal !== 'all') {
        const limitDays = parseInt(biggestPeriodVal, 10) || 7;
        const oneDay = 24 * 60 * 60 * 1000;
        biggestPeriodStart = new Date(today.getTime() - (limitDays - 1) * oneDay);
    }

    // Calculate Counts
    const movieReleaseCounts = {};
    const movieDisplayNames = {};
    const movieImdbIds = {};
    const seriesReleaseCounts = {};
    const seriesDisplayNames = {};
    const seriesImdbIds = {};
    const groupWeekCounts = {};
    const biggestFilesMap = {};

    data.forEach(r => {
        const d = parseReleaseDate(r.date_added);

        // Movies
        if (r.title && r.category === 'movie') {
            let inRange = true;
            if (moviesPeriodStart && (!d || d < moviesPeriodStart)) inRange = false;
            if (moviesPeriodEnd && (!d || d >= moviesPeriodEnd)) inRange = false;
            if (inRange) {
                const y = r.official_year || r.year;
                const titleStr = y ? `${r.title} (${y})` : r.title;
                const key = r.imdb_id ? r.imdb_id : titleStr.toLowerCase();
                movieReleaseCounts[key] = (movieReleaseCounts[key] || 0) + 1;
                if (!movieDisplayNames[key] || titleStr.length > movieDisplayNames[key].length) {
                    movieDisplayNames[key] = titleStr; // Prefer the longest/most complete title
                }
                if (!movieImdbIds[key] && r.imdb_id) {
                    movieImdbIds[key] = r.imdb_id;
                }
            }
        }

        // Series
        if (r.title && r.category === 'series') {
            let inRange = true;
            if (seriesPeriodStart && (!d || d < seriesPeriodStart)) inRange = false;
            if (seriesPeriodEnd && (!d || d >= seriesPeriodEnd)) inRange = false;
            if (inRange) {
                const y = r.official_year || r.year;
                const titleStr = y ? `${r.title} (${y})` : r.title;
                const key = r.imdb_id ? r.imdb_id : titleStr.toLowerCase();
                seriesReleaseCounts[key] = (seriesReleaseCounts[key] || 0) + 1;
                if (!seriesDisplayNames[key] || titleStr.length > seriesDisplayNames[key].length) {
                    seriesDisplayNames[key] = titleStr; // Prefer the longest/most complete title
                }
                if (!seriesImdbIds[key] && r.imdb_id) {
                    seriesImdbIds[key] = r.imdb_id;
                }
            }
        }

        // Groups
        let groupInRange = true;
        if (groupsPeriodStart && (!d || d < groupsPeriodStart)) groupInRange = false;
        if (groupsPeriodEnd && (!d || d >= groupsPeriodEnd)) groupInRange = false;
        if (groupInRange) {
            const grp = r.group ? r.group.toUpperCase() : null;
            if (grp && grp !== 'NON SPÉCIFIÉ' && grp !== 'INCONNU') {
                groupWeekCounts[grp] = (groupWeekCounts[grp] || 0) + 1;
            }
        }
        // Biggest files
        let fileInRange = true;
        if (biggestPeriodStart && (!d || d < biggestPeriodStart)) fileInRange = false;
        if (biggestPeriodEnd && (!d || d >= biggestPeriodEnd)) fileInRange = false;
        if (fileInRange && r.size) {
            let bytes = 0;
            const match = String(r.size).match(/^([\d.]+)\s*([a-zA-Z]+)/);
            if (match) {
                const val = parseFloat(match[1]);
                const unit = match[2].toUpperCase();
                if (unit === 'GB' || unit === 'GO' || unit === 'G') bytes = val * 1024 * 1024 * 1024;
                else if (unit === 'MB' || unit === 'MO' || unit === 'M') bytes = val * 1024 * 1024;
                else if (unit === 'KB' || unit === 'KO' || unit === 'K') bytes = val * 1024;
                else if (unit === 'TB' || unit === 'TO' || unit === 'T') bytes = val * 1024 * 1024 * 1024 * 1024;
                else bytes = val;
            }
            if (bytes > 0) {
                let name = r.title || r.filename || 'Inconnu';
                if (r.year) name = `${name} (${r.year})`;
                if (!biggestFilesMap[name] || bytes > biggestFilesMap[name].size) {
                    biggestFilesMap[name] = { name: name, size: bytes, sizeStr: r.size };
                }
            }
        }
    });

    // Sort and get Top 10
    const topMovies = Object.entries(movieReleaseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topSeries = Object.entries(seriesReleaseCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topGroupsWeek = Object.entries(groupWeekCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topBiggestFiles = Object.values(biggestFilesMap)
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);



    // Render Top Movies List
    const moviesListEl = document.getElementById('top-movies-list');
    if (moviesListEl) {
        moviesListEl.innerHTML = '';
        if (topMovies.length === 0) {
            moviesListEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Aucun film trouvé sur cette période</div>';
        } else {
            topMovies.forEach(([key, count], index) => {
                const name = movieDisplayNames[key] || key;
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const imdbId = movieImdbIds[key] || null;
                const imdbUrl = imdbId
                    ? (imdbId.startsWith('tt')
                        ? `https://www.imdb.com/title/${imdbId}`
                        : `https://www.themoviedb.org/movie/${imdbId}`)
                    : null;
                const posterSrc = imdbId && imdbId.startsWith('tt')
                    ? `https://images.metahub.space/poster/medium/${imdbId}/img`
                    : 'no-poster.svg';
                const titleEl = imdbUrl
                    ? `<a class="top-list-name" href="${imdbUrl}" target="_blank" rel="noopener" title="${name} — Voir sur ${imdbId && imdbId.startsWith('tt') ? 'IMDb' : 'TMDb'}">${name}</a>`
                    : `<span class="top-list-name" title="${name}">${name}</span>`;
                const itemHtml = `
                    <div class="top-list-item top-list-item--with-poster">
                        <span class="top-list-rank ${rankClass}">${rank}</span>
                        <div class="top-list-poster-wrap">
                            ${imdbUrl
                                ? `<a href="${imdbUrl}" target="_blank" rel="noopener" tabindex="-1">
                                       <img class="top-list-poster" src="${posterSrc}" alt="" loading="lazy" onerror="this.src='no-poster.svg'">
                                   </a>`
                                : `<img class="top-list-poster" src="no-poster.svg" alt="" loading="lazy">`
                            }
                        </div>
                        ${titleEl}
                        <span class="top-list-count">${count} entrées</span>
                    </div>
                `;
                moviesListEl.insertAdjacentHTML('beforeend', itemHtml);
            });
        }
    }

    // Render Top Series List
    const seriesListEl = document.getElementById('top-series-list');
    if (seriesListEl) {
        seriesListEl.innerHTML = '';
        if (topSeries.length === 0) {
            seriesListEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Aucune série trouvée sur cette période</div>';
        } else {
            topSeries.forEach(([key, count], index) => {
                const name = seriesDisplayNames[key] || key;
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const imdbId = seriesImdbIds[key] || null;
                const imdbUrl = imdbId
                    ? (imdbId.startsWith('tt')
                        ? `https://www.imdb.com/title/${imdbId}`
                        : `https://www.themoviedb.org/tv/${imdbId}`)
                    : null;
                const posterSrc = imdbId && imdbId.startsWith('tt')
                    ? `https://images.metahub.space/poster/medium/${imdbId}/img`
                    : 'no-poster.svg';
                const titleEl = imdbUrl
                    ? `<a class="top-list-name" href="${imdbUrl}" target="_blank" rel="noopener" title="${name} — Voir sur ${imdbId && imdbId.startsWith('tt') ? 'IMDb' : 'TMDb'}">${name}</a>`
                    : `<span class="top-list-name" title="${name}">${name}</span>`;
                const itemHtml = `
                    <div class="top-list-item top-list-item--with-poster">
                        <span class="top-list-rank ${rankClass}">${rank}</span>
                        <div class="top-list-poster-wrap">
                            ${imdbUrl
                                ? `<a href="${imdbUrl}" target="_blank" rel="noopener" tabindex="-1">
                                       <img class="top-list-poster" src="${posterSrc}" alt="" loading="lazy" onerror="this.src='no-poster.svg'">
                                   </a>`
                                : `<img class="top-list-poster" src="no-poster.svg" alt="" loading="lazy">`
                            }
                        </div>
                        ${titleEl}
                        <span class="top-list-count">${count} entrées</span>
                    </div>
                `;
                seriesListEl.insertAdjacentHTML('beforeend', itemHtml);
            });
        }
    }

    // Render Top Groups Week List
    const groupsWeekListEl = document.getElementById('top-groups-week-list');
    if (groupsWeekListEl) {
        groupsWeekListEl.innerHTML = '';
        if (topGroupsWeek.length === 0) {
            groupsWeekListEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Aucune team active sur cette période</div>';
        } else {
            topGroupsWeek.forEach(([name, count], index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const itemHtml = `
                    <div class="top-list-item">
                        <span class="top-list-rank ${rankClass}">${rank}</span>
                        <span class="top-list-name" title="${name}">${name}</span>
                        <span class="top-list-count">${count} entrées</span>
                    </div>
                `;
                groupsWeekListEl.insertAdjacentHTML('beforeend', itemHtml);
            });
        }
    }
    // Render Top Biggest Files
    const biggestFilesListEl = document.getElementById('top-biggest-files-list');
    if (biggestFilesListEl) {
        biggestFilesListEl.innerHTML = '';
        if (topBiggestFiles.length === 0) {
            biggestFilesListEl.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Aucun fichier sur cette période</div>';
        } else {
            topBiggestFiles.forEach((f, index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : '';
                const itemHtml = `
                    <div class="top-list-item">
                        <span class="top-list-rank ${rankClass}">${rank}</span>
                        <span class="top-list-name" title="${f.name}" style="font-family: var(--font-mono); font-size: 11px; white-space: normal; word-break: break-all;">${f.name}</span>
                        <span class="top-list-count" style="color: var(--accent-pink); white-space: nowrap; margin-left: 10px;">${f.sizeStr}</span>
                    </div>
                `;
                biggestFilesListEl.insertAdjacentHTML('beforeend', itemHtml);
            });
        }
    }
}

// Copy feedback helper
function showCopyFeedback(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('i');
        icon.className = 'fas fa-check';
        btn.classList.add('copied');
        setTimeout(() => {
            icon.className = 'far fa-copy';
            btn.classList.remove('copied');
        }, 2000);
    });
}

// Helper to format Date object to "DD/MM/YYYY HH:MM"
function formatLastUpdateDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Helper to convert UTC date string "DD/MM/YYYY HH:MM:SS" to Local Date Time string "DD/MM/YYYY HH:MM:SS"
function convertUTCToLocalDateTimeString(dateStr) {
    if (!dateStr) return dateStr;
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return dateStr;
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    if (dateParts.length !== 3 || timeParts.length !== 3) return dateStr;

    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const min = parseInt(timeParts[1], 10);
    const sec = parseInt(timeParts[2], 10);

    const utcDate = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (isNaN(utcDate.getTime())) return dateStr;

    const localDay = String(utcDate.getDate()).padStart(2, '0');
    const localMonth = String(utcDate.getMonth() + 1).padStart(2, '0');
    const localYear = utcDate.getFullYear();
    const localHour = String(utcDate.getHours()).padStart(2, '0');
    const localMin = String(utcDate.getMinutes()).padStart(2, '0');
    const localSec = String(utcDate.getSeconds()).padStart(2, '0');

    return `${localDay}/${localMonth}/${localYear} ${localHour}:${localMin}:${localSec}`;
}
