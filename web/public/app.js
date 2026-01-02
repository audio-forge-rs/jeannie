/**
 * Jeannie Controller SPA - Vanilla JavaScript (2025)
 * Version: 0.7.0
 *
 * Modern vanilla JS following 2025 best practices:
 * - No build step required
 * - ES6+ modules
 * - Reactive updates
 * - Clean, functional approach
 * - Multi-view navigation (Search, Status, Stats)
 * - Content search with fuzzy matching
 */

const API_BASE = '';
const REFRESH_INTERVAL = 2000; // 2 seconds

class JeannieApp {
    constructor() {
        this.refreshTimer = null;
        this.lastUpdate = null;
        this.currentView = 'search';
        this.contentTypes = [];
        this.creators = [];
    }

    async fetchAPI(endpoint) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            return null;
        }
    }

    async postAPI(endpoint, data = {}) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error posting to ${endpoint}:`, error);
            return null;
        }
    }

    formatUptime(seconds) {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    formatNumber(num) {
        return num.toLocaleString();
    }

    // View switching
    switchView(viewName) {
        // Update buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });

        this.currentView = viewName;

        // Load view-specific data
        if (viewName === 'stats') {
            this.loadStats();
        } else if (viewName === 'search') {
            this.loadSearchFilters();
        }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });
    }

    // Search functionality
    async loadSearchFilters() {
        // Load content types
        const typesData = await this.fetchAPI('/api/content/types');
        if (typesData?.success && typesData.data) {
            this.contentTypes = typesData.data;
            const select = document.getElementById('content-type-filter');
            select.innerHTML = '<option value="">All Types</option>';
            typesData.data.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                select.appendChild(option);
            });
        }

        // Load creators
        const creatorsData = await this.fetchAPI('/api/content/creators');
        if (creatorsData?.success && creatorsData.data) {
            this.creators = creatorsData.data;
            const select = document.getElementById('creator-filter');
            select.innerHTML = '<option value="">All Creators</option>';
            // Show top 50 creators
            creatorsData.data.slice(0, 50).forEach(creator => {
                const option = document.createElement('option');
                option.value = creator;
                option.textContent = creator;
                select.appendChild(option);
            });
        }
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return;

        const fuzzy = document.getElementById('fuzzy-search').checked;
        const contentType = document.getElementById('content-type-filter').value;
        const creator = document.getElementById('creator-filter').value;

        let url = `/api/content/search?q=${encodeURIComponent(query)}`;
        if (fuzzy) url += '&fuzzy=true';
        if (contentType) url += `&type=${encodeURIComponent(contentType)}`;
        if (creator) url += `&creator=${encodeURIComponent(creator)}`;
        url += '&limit=100';

        const data = await this.fetchAPI(url);
        this.displaySearchResults(data);
    }

    displaySearchResults(data) {
        const resultsEl = document.getElementById('search-results');

        if (!data || !data.success) {
            resultsEl.innerHTML = `
                <div class="search-error">
                    <p>❌ ${data?.error || 'Search failed'}</p>
                    <p><small>Make sure the content index is loaded (check Status tab)</small></p>
                </div>
            `;
            return;
        }

        const results = data.data.results || [];
        const total = data.data.total || 0;

        if (results.length === 0) {
            resultsEl.innerHTML = `
                <div class="search-empty">
                    <p>No results found for "${data.data.query}"</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="search-header">
                <p>Found <strong>${this.formatNumber(total)}</strong> results for "${data.data.query}"</p>
                ${results.length < total ? `<p><small>Showing first ${results.length}</small></p>` : ''}
            </div>
            <div class="results-list">
        `;

        results.forEach(item => {
            const score = item.score !== undefined ? item.score : 1;
            const scorePercent = Math.round(score * 100);
            const scoreClass = scorePercent > 80 ? 'high' : scorePercent > 50 ? 'medium' : 'low';

            html += `
                <div class="result-item">
                    <div class="result-header">
                        <span class="result-name">${this.escapeHtml(item.name)}</span>
                        <span class="result-score score-${scoreClass}">${scorePercent}%</span>
                    </div>
                    <div class="result-meta">
                        <span class="badge">${item.contentType}</span>
                        ${item.creator ? `<span class="creator">${this.escapeHtml(item.creator)}</span>` : ''}
                        ${item.category ? `<span class="category">${this.escapeHtml(item.category)}</span>` : ''}
                        ${item.plugin ? `<span class="plugin">${this.escapeHtml(item.plugin)}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        resultsEl.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupSearch() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');

        searchBtn.addEventListener('click', () => this.performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Load filters on startup
        this.loadSearchFilters();
    }

    // Stats functionality
    async loadStats() {
        const data = await this.fetchAPI('/api/content/stats');
        if (!data || !data.success) return;

        const stats = data.data;

        // Overview stats
        document.getElementById('stat-total').textContent = this.formatNumber(stats.totals.total);
        document.getElementById('stat-devices').textContent = this.formatNumber(stats.totals.Device || 0);
        document.getElementById('stat-presets').textContent = this.formatNumber(stats.totals.Preset || 0);
        document.getElementById('stat-samples').textContent = this.formatNumber(stats.totals.Sample || 0);

        // By content type
        const byTypeEl = document.getElementById('stats-by-type');
        let typeHtml = '<div class="stats-grid">';
        Object.entries(stats.stats.byContentType || {}).forEach(([type, count]) => {
            typeHtml += `
                <div class="stat-row">
                    <span class="stat-name">${type}</span>
                    <span class="stat-count">${this.formatNumber(count)}</span>
                </div>
            `;
        });
        typeHtml += '</div>';
        byTypeEl.innerHTML = typeHtml;

        // Top creators (limit to 20)
        const byCreatorEl = document.getElementById('stats-by-creator');
        let creatorHtml = '<div class="stats-grid">';
        const creators = Object.entries(stats.stats.byCreator || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        creators.forEach(([creator, count]) => {
            creatorHtml += `
                <div class="stat-row">
                    <span class="stat-name">${this.escapeHtml(creator)}</span>
                    <span class="stat-count">${this.formatNumber(count)}</span>
                </div>
            `;
        });
        creatorHtml += '</div>';
        byCreatorEl.innerHTML = creatorHtml;

        // Scan info
        document.getElementById('stats-scan-date').textContent = this.formatTimestamp(stats.scanDate);
        document.getElementById('stats-scan-duration').textContent =
            `${(stats.scanDurationMs / 1000).toFixed(1)}s`;
        document.getElementById('stats-bitwig-version').textContent =
            stats.bitwigVersion || 'Unknown';
    }

    // Status updates
    updateStatus(online) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = online ? '🟢 Online' : '⚫ Offline';
        statusEl.className = online ? 'status status-ok' : 'status status-error';
    }

    async updateHello() {
        const data = await this.fetchAPI('/api/hello');
        const messageEl = document.getElementById('hello-message');

        if (data?.success && data.data) {
            if (messageEl.textContent !== data.data.message) {
                messageEl.textContent = data.data.message;
            }
            messageEl.className = 'message';
        } else {
            const errorMsg = 'Unable to load system status';
            if (messageEl.textContent !== errorMsg) {
                messageEl.textContent = errorMsg;
            }
            messageEl.className = 'message status-error';
        }
    }

    async updateVersion() {
        const data = await this.fetchAPI('/api/version');

        if (data?.success && data.data) {
            const jeannieEl = document.getElementById('version-jeannie');
            const rogerEl = document.getElementById('version-roger');
            const configEl = document.getElementById('version-config');
            const controllerEl = document.getElementById('version-controller');
            const footerEl = document.getElementById('footer-version');

            const jeannieVer = data.data.jeannie || 'unknown';
            const rogerVer = data.data.roger || 'unknown';
            const configVer = data.data.config || 'unknown';
            const controllerVer = data.data.controller || 'unknown';

            if (jeannieEl.textContent !== jeannieVer) jeannieEl.textContent = jeannieVer;
            if (rogerEl.textContent !== rogerVer) rogerEl.textContent = rogerVer;
            if (configEl.textContent !== configVer) configEl.textContent = configVer;
            if (controllerEl && controllerEl.textContent !== controllerVer) {
                controllerEl.textContent = controllerVer;
            }
            // Update footer version
            if (footerEl && footerEl.textContent !== `v${jeannieVer}`) {
                footerEl.textContent = `v${jeannieVer}`;
            }
        }
    }

    async updateConfig() {
        const data = await this.fetchAPI('/api/config');
        const contentEl = document.getElementById('config-content');
        const updatedEl = document.getElementById('last-updated');

        if (data?.success && data.data) {
            contentEl.textContent = JSON.stringify(data.data, null, 2);
            updatedEl.textContent = `Updated: ${this.formatTimestamp(data.data.lastUpdated)}`;
        } else {
            contentEl.textContent = 'No configuration loaded';
            updatedEl.textContent = '';
        }
    }

    async updateHealth() {
        const data = await this.fetchAPI('/health');

        if (data?.success && data.data) {
            const health = data.data;
            document.getElementById('health-status').textContent = health.status;
            document.getElementById('health-status').className =
                `value status-${health.status === 'ok' ? 'ok' : 'error'}`;

            document.getElementById('health-uptime').textContent =
                this.formatUptime(health.uptime);

            document.getElementById('health-config').textContent =
                health.configLoaded ? '✓ Yes' : '✗ No';
            document.getElementById('health-config').className =
                `value status-${health.configLoaded ? 'ok' : 'warning'}`;

            this.updateStatus(true);
        } else {
            this.updateStatus(false);
        }
    }

    async updateConnectionStatus() {
        const data = await this.fetchAPI('/api/status');

        if (data?.success && data.data) {
            const status = data.data;

            // Bitwig status
            const bitwigEl = document.getElementById('bitwig-status');
            bitwigEl.textContent = status.bitwig.connected ? '🟢 Connected' : '⚫ Disconnected';
            bitwigEl.className = `value status-badge status-${status.bitwig.connected ? 'ok' : 'error'}`;

            const bitwigLastSeen = document.getElementById('bitwig-lastseen');
            if (status.bitwig.lastSeen) {
                const timeDiff = Math.floor((Date.now() - new Date(status.bitwig.lastSeen).getTime()) / 1000);
                bitwigLastSeen.textContent = timeDiff < 60 ? `${timeDiff}s ago` : this.formatTimestamp(status.bitwig.lastSeen);
            } else {
                bitwigLastSeen.textContent = 'Never';
            }

            // Controller version
            const controllerVer = document.getElementById('controller-version');
            if (controllerVer) {
                controllerVer.textContent = status.bitwig.controllerVersion || '-';
            }

            // Roger status
            const rogerEl = document.getElementById('roger-status');
            rogerEl.textContent = status.roger.connected ? '🟢 Connected' : '⚫ Disconnected';
            rogerEl.className = `value status-badge status-${status.roger.connected ? 'ok' : 'error'}`;

            const rogerCommand = document.getElementById('roger-command');
            rogerCommand.textContent = status.roger.lastCommand || 'None';
        }
    }

    async updateContentStatus() {
        const data = await this.fetchAPI('/api/content/status');

        if (data?.success && data.data) {
            const status = data.data;

            document.getElementById('index-loaded').textContent = status.loaded ? '✓ Yes' : '✗ No';
            document.getElementById('index-loaded').className =
                `value status-${status.loaded ? 'ok' : 'error'}`;

            document.getElementById('content-count').textContent =
                status.loaded ? this.formatNumber(status.contentCount) : '-';

            document.getElementById('last-scan').textContent =
                status.scanDate ? this.formatTimestamp(status.scanDate) : 'Never';
        }
    }

    async triggerRescan() {
        const btn = document.getElementById('rescan-btn');
        btn.disabled = true;
        btn.textContent = 'Rescanning...';

        const data = await this.postAPI('/api/content/rescan');

        if (data?.success) {
            alert('Rescan requested! Controller will detect within 10 seconds and scan all content (~60-120s).');
        } else {
            alert('Rescan failed: ' + (data?.error || 'Unknown error'));
        }

        btn.disabled = false;
        btn.textContent = 'Rescan';
    }

    async refresh() {
        this.lastUpdate = new Date();

        // Always update status info
        await Promise.all([
            this.updateHello(),
            this.updateVersion(),
            this.updateConfig(),
            this.updateHealth(),
            this.updateConnectionStatus(),
            this.updateContentStatus()
        ]);
    }

    start() {
        console.log('Jeannie Controller SPA v0.7.0 starting...');

        // Setup navigation
        this.setupNavigation();

        // Setup search
        this.setupSearch();

        // Setup rescan button
        const rescanBtn = document.getElementById('rescan-btn');
        if (rescanBtn) {
            rescanBtn.addEventListener('click', () => this.triggerRescan());
        }

        // Initial load
        this.refresh();

        // Set up auto-refresh (only for status view)
        this.refreshTimer = setInterval(() => {
            if (this.currentView === 'status') {
                this.refresh();
            }
        }, REFRESH_INTERVAL);

        // Handle visibility change (pause when hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(this.refreshTimer);
            } else {
                this.refresh();
                this.refreshTimer = setInterval(() => {
                    if (this.currentView === 'status') {
                        this.refresh();
                    }
                }, REFRESH_INTERVAL);
            }
        });
    }

    stop() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.jeannieApp = new JeannieApp();
        window.jeannieApp.start();
    });
} else {
    window.jeannieApp = new JeannieApp();
    window.jeannieApp.start();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.jeannieApp) {
        window.jeannieApp.stop();
    }
});
