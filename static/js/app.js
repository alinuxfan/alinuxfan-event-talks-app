// Global state
let releaseNotes = [];
let filteredNotes = [];
let currentFilter = 'all';
let searchQuery = '';
let activeTweetData = null;

// DOM Elements
const releasesFeed = document.getElementById('releases-feed');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const typeFilterSelect = document.getElementById('type-filter');
const typePillsContainer = document.getElementById('type-pills');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');
const statCount = document.getElementById('stat-count');
const statTime = document.getElementById('stat-time');
const statSource = document.getElementById('stat-source');
const indicatorDot = document.getElementById('indicator-dot');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountText = document.getElementById('char-count');
const charProgressCircle = document.getElementById('char-progress');
const submitTweetBtn = document.getElementById('submit-tweet-btn');
const closeModalBtn = document.getElementById('close-modal');

// Color mapping for types
const TYPE_COLORS = {
    'feature': '#10b981',
    'issue': '#f43f5e',
    'deprecation': '#f59e0b',
    'changed': '#8b5cf6',
    'general': '#64748b'
};

// Circle progress constants
const CIRCLE_CIRCUMFERENCE = 62.8; // 2 * PI * r (r=10)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
        filterAndRender();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        filterAndRender();
    });

    // Filter dropdown
    typeFilterSelect.addEventListener('change', (e) => {
        setFilter(e.target.value);
    });

    // Tweet text area character count listener
    tweetTextarea.addEventListener('input', updateTweetCharacterCount);

    // Close Modal events
    closeModalBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Submit Tweet
    submitTweetBtn.addEventListener('click', submitTweet);

    // Keyboard ESC to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.style.display === 'flex') {
            closeTweetModal();
        }
    });

    // Theme toggle button
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Export to CSV button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
}

// Fetch data from API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoadingState();
    
    // Add spinning animation
    const spinner = refreshBtn.querySelector('.refresh-spinner');
    spinner.classList.add('spinning');
    refreshBtn.disabled = true;

    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            releaseNotes = data.releases;
            filteredNotes = [...releaseNotes];
            
            // Update Stats
            statCount.textContent = data.count;
            updateLastFetchedTime(data.last_fetched);
            updateSourceIndicator(data.source);

            // Populate filters
            populateFilters(releaseNotes);
            
            // Render
            filterAndRender();
        } else {
            showErrorState(data.error || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showErrorState('Network error. Make sure the server is running.');
    } finally {
        spinner.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

// Update Last Fetched Time String
function updateLastFetchedTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    statTime.textContent = date.toLocaleTimeString(undefined, options);
}

// Update Source Indicator
function updateSourceIndicator(source) {
    indicatorDot.className = 'indicator-dot';
    
    if (source === 'network') {
        statSource.textContent = 'Sync Live';
        indicatorDot.classList.add('online');
    } else if (source === 'cache') {
        statSource.textContent = 'Cached';
        indicatorDot.classList.add('online');
    } else {
        statSource.textContent = 'Offline (Stale)';
        indicatorDot.classList.add('stale');
    }
}

// Show skeleton loader
function showLoadingState() {
    releasesFeed.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        skeleton.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <div class="skeleton-line skeleton-badge"></div>
                <div class="skeleton-line skeleton-date"></div>
            </div>
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-body-1" style="margin-top: 10px;"></div>
            <div class="skeleton-line skeleton-body-2"></div>
            <div class="skeleton-line skeleton-body-3"></div>
        `;
        releasesFeed.appendChild(skeleton);
    }
}

// Show error state
function showErrorState(message) {
    releasesFeed.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>${message}</p>
            <button class="btn btn-primary" style="margin-top: 16px;" onclick="fetchReleaseNotes(true)">Try Again</button>
        </div>
    `;
    statCount.textContent = 'Error';
    statTime.textContent = '--';
    statSource.textContent = 'Offline';
    indicatorDot.className = 'indicator-dot stale';
}

// Populate type select and pills
function populateFilters(notes) {
    // Get unique types
    const types = new Set();
    notes.forEach(note => {
        if (note.type) {
            types.add(note.type);
        }
    });

    const sortedTypes = Array.from(types).sort();

    // Rebuild select options
    const prevSelectVal = typeFilterSelect.value;
    typeFilterSelect.innerHTML = '<option value="all">All Types</option>';
    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase();
        option.textContent = type;
        typeFilterSelect.appendChild(option);
    });
    
    // Restore select value if still exists
    if (Array.from(types).map(t => t.toLowerCase()).includes(prevSelectVal)) {
        typeFilterSelect.value = prevSelectVal;
    }

    // Rebuild Pills
    typePillsContainer.innerHTML = '';
    
    // Add 'All' Pill
    const allPill = document.createElement('button');
    allPill.className = `pill ${currentFilter === 'all' ? 'active' : ''}`;
    allPill.textContent = `All (${notes.length})`;
    allPill.addEventListener('click', () => setFilter('all'));
    typePillsContainer.appendChild(allPill);

    // Add specific pills
    sortedTypes.forEach(type => {
        const count = notes.filter(n => n.type.toLowerCase() === type.toLowerCase()).length;
        const pill = document.createElement('button');
        const typeKey = type.toLowerCase();
        pill.className = `pill ${currentFilter === typeKey ? 'active' : ''}`;
        pill.textContent = `${type} (${count})`;
        
        // Custom color variable for active state
        const color = TYPE_COLORS[typeKey] || TYPE_COLORS['general'];
        pill.style.setProperty('--accent-color', color);
        
        pill.addEventListener('click', () => setFilter(typeKey));
        typePillsContainer.appendChild(pill);
    });
}

// Change active filter
function setFilter(filterVal) {
    currentFilter = filterVal.toLowerCase();
    
    // Update select element
    typeFilterSelect.value = currentFilter;
    
    // Update pills active state
    const pills = typePillsContainer.querySelectorAll('.pill');
    pills.forEach(pill => {
        const pillText = pill.textContent.split(' (')[0].toLowerCase();
        if ((currentFilter === 'all' && pillText.startsWith('all')) || pillText === currentFilter) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    filterAndRender();
}

// Safe HTML Highlight Helper
function highlightHTML(html, query) {
    if (!query) return html;
    
    // Escapes regex special characters
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    // Split HTML by tags to avoid editing attribute values or tag names
    const parts = html.split(/(<[^>]+>)/);
    
    for (let i = 0; i < parts.length; i++) {
        // Only modify string parts that are NOT tags
        if (parts[i] && !parts[i].startsWith('<')) {
            parts[i] = parts[i].replace(regex, '<mark class="highlight">$1</mark>');
        }
    }
    
    return parts.join('');
}

// Filter and Render Loop
function filterAndRender() {
    releasesFeed.innerHTML = '';
    
    // 1. Filter notes by type and search query
    filteredNotes = releaseNotes.filter(note => {
        // Type matching
        const typeMatch = currentFilter === 'all' || note.type.toLowerCase() === currentFilter;
        
        // Search query matching
        let searchMatch = true;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const textToSearch = `${note.type} ${note.date} ${note.text_content}`.toLowerCase();
            searchMatch = textToSearch.includes(query);
        }
        
        return typeMatch && searchMatch;
    });

    // 2. Render Empty State if no results
    if (filteredNotes.length === 0) {
        releasesFeed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>No release notes found</h3>
                <p>Try refining your search keyword or switching filters.</p>
            </div>
        `;
        return;
    }

    // 3. Render Cards (injecting date headers dynamically)
    let lastDate = '';
    
    filteredNotes.forEach(note => {
        // Date group header
        if (note.date !== lastDate) {
            lastDate = note.date;
            const groupTitle = document.createElement('h2');
            groupTitle.className = 'release-group-title';
            groupTitle.textContent = note.date;
            releasesFeed.appendChild(groupTitle);
        }

        // Create Card
        const card = document.createElement('div');
        card.className = 'release-card';
        
        // Set type color variable for CSS border & badge
        const typeKey = note.type.toLowerCase();
        const typeColor = TYPE_COLORS[typeKey] || TYPE_COLORS['general'];
        card.style.setProperty('--type-color', typeColor);

        // Highlight matching query text
        const highlightedType = highlightHTML(note.type, searchQuery);
        const highlightedBody = highlightHTML(note.content_html, searchQuery);

        card.innerHTML = `
            <div class="release-card-header">
                <div class="release-meta">
                    <span class="badge">${highlightedType}</span>
                    <span class="release-date">${note.date}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-card-action copy-btn" data-id="${note.id}">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-card-action tweet-btn" data-id="${note.id}">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            </div>
            <div class="release-card-body">
                ${highlightedBody}
            </div>
        `;

        // Add event listener to the buttons inside card
        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => copyToClipboard(note, copyBtn));

        const tweetBtn = card.querySelector('.tweet-btn');
        tweetBtn.addEventListener('click', () => openTweetModal(note));

        releasesFeed.appendChild(card);
    });
}

// Tweet Composer Modal Management
function openTweetModal(note) {
    activeTweetData = note;
    
    // Generate pre-populated tweet draft
    // Structure: Emoji + Type + Date + Summary snippet + Link
    const maxTextLength = 180; // Limit body text snippet to preserve space for links & tags
    let bodyText = note.text_content;
    
    if (bodyText.length > maxTextLength) {
        bodyText = bodyText.substring(0, maxTextLength).trim() + '...';
    }
    
    let emoji = '📢';
    if (note.type.toLowerCase() === 'feature') emoji = '🚀';
    if (note.type.toLowerCase() === 'issue') emoji = '⚠️';
    if (note.type.toLowerCase() === 'deprecation') emoji = '🛑';
    if (note.type.toLowerCase() === 'changed') emoji = '⚙️';
    
    // Assemble draft tweet text
    const tweetText = `${emoji} BigQuery ${note.type} (${note.date}):\n\n${bodyText}\n\nRead more details here:\n${note.link || 'https://cloud.google.com/bigquery'}`;
    
    // Update textarea and open modal
    tweetTextarea.value = tweetText;
    updateTweetCharacterCount();
    
    tweetModal.style.display = 'flex';
    // Small delay to allow display flex to apply before opacity transition
    setTimeout(() => {
        tweetModal.classList.add('active');
        tweetTextarea.focus();
    }, 10);
}

function closeTweetModal() {
    tweetModal.classList.remove('active');
    setTimeout(() => {
        tweetModal.style.display = 'none';
        activeTweetData = null;
    }, 200); // Match CSS transition duration
}

function updateTweetCharacterCount() {
    const text = tweetTextarea.value;
    const length = text.length;
    const remaining = 280 - length;
    
    // Update count display
    charCountText.textContent = remaining;
    
    // Update circle progress
    const progress = Math.min(length / 280, 1.0);
    const offset = CIRCLE_CIRCUMFERENCE - (progress * CIRCLE_CIRCUMFERENCE);
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Update styles based on limits
    charCountText.className = 'char-count-text';
    submitTweetBtn.disabled = length === 0 || remaining < 0;
    
    if (remaining < 0) {
        charCountText.classList.add('danger');
        charProgressCircle.style.stroke = '#f4212e'; // Red
    } else if (remaining <= 20) {
        charCountText.classList.add('warning');
        charProgressCircle.style.stroke = '#ffd400'; // Yellow
    } else {
        charProgressCircle.style.stroke = '#1d9bf0'; // Twitter Blue
    }
}

// Redirect to Twitter sharing intent
function submitTweet() {
    const text = tweetTextarea.value.trim();
    if (!text || text.length > 280) return;
    
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // Open Twitter intent in new tab
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    // Close modal
    closeTweetModal();
}

// Theme handling functions
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggleBtn) {
            const darkIcon = themeToggleBtn.querySelector('.theme-icon-dark');
            const lightIcon = themeToggleBtn.querySelector('.theme-icon-light');
            if (darkIcon) darkIcon.style.display = 'none';
            if (lightIcon) lightIcon.style.display = 'block';
        }
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        const darkIcon = themeToggleBtn.querySelector('.theme-icon-dark');
        const lightIcon = themeToggleBtn.querySelector('.theme-icon-light');
        
        if (isLight) {
            if (darkIcon) darkIcon.style.display = 'none';
            if (lightIcon) lightIcon.style.display = 'block';
        } else {
            if (darkIcon) darkIcon.style.display = 'block';
            if (lightIcon) lightIcon.style.display = 'none';
        }
    }
}

// Utility Functions: Copy to Clipboard and Export to CSV
function copyToClipboard(note, button) {
    navigator.clipboard.writeText(note.text_content).then(() => {
        const span = button.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Copied!';
        button.style.pointerEvents = 'none';
        
        // Restore button state after 2 seconds
        setTimeout(() => {
            span.textContent = originalText;
            button.style.pointerEvents = 'auto';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function exportToCSV() {
    if (filteredNotes.length === 0) {
        alert('No data to export.');
        return;
    }
    
    // CSV Headers
    const headers = ['Date', 'Type', 'Description', 'Link'];
    
    // Map entries to CSV format
    const rows = filteredNotes.map(note => {
        return [
            note.date,
            note.type,
            note.text_content,
            note.link || ''
        ].map(val => {
            // Escape double quotes by doubling them and wrap field in double quotes
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const activeFilterName = currentFilter === 'all' ? 'all' : currentFilter;
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${activeFilterName}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

