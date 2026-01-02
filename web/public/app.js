/**
 * Jeannie Controller SPA - Vanilla JavaScript (2025)
 * Version: 0.2.0
 *
 * Modern vanilla JS following 2025 best practices:
 * - No build step required
 * - ES6+ modules
 * - Reactive updates
 * - Clean, functional approach
 */

const API_BASE = '';
const REFRESH_INTERVAL = 2000; // 2 seconds

class JeannieApp {
    constructor() {
        this.refreshTimer = null;
        this.lastUpdate = null;
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

    updateStatus(online) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = online ? 'Online' : 'Offline';
        statusEl.className = online ? 'status status-ok' : 'status status-error';
    }

    async updateHello() {
        const data = await this.fetchAPI('/api/hello');
        const messageEl = document.getElementById('hello-message');

        if (data?.success && data.data) {
            messageEl.textContent = data.data.message;
            messageEl.className = 'message';
        } else {
            messageEl.textContent = 'Unable to load hello message';
            messageEl.className = 'message status-error';
        }
    }

    async updateVersion() {
        const data = await this.fetchAPI('/api/version');

        if (data?.success && data.data) {
            document.getElementById('version-jeannie').textContent = data.data.jeannie || 'unknown';
            document.getElementById('version-roger').textContent = data.data.roger || 'unknown';
            document.getElementById('version-config').textContent = data.data.config || 'unknown';
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

    async refresh() {
        this.lastUpdate = new Date();

        // Fetch all data in parallel
        await Promise.all([
            this.updateHello(),
            this.updateVersion(),
            this.updateConfig(),
            this.updateHealth()
        ]);
    }

    start() {
        console.log('Jeannie Controller SPA v0.2.0 starting...');

        // Initial load
        this.refresh();

        // Set up auto-refresh
        this.refreshTimer = setInterval(() => {
            this.refresh();
        }, REFRESH_INTERVAL);

        // Handle visibility change (pause when hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(this.refreshTimer);
            } else {
                this.refresh();
                this.refreshTimer = setInterval(() => {
                    this.refresh();
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
