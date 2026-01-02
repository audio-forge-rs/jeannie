/**
 * Jeannie Controller SPA - Vanilla JavaScript (2025)
 * Version: 0.3.0
 *
 * Modern vanilla JS following 2025 best practices:
 * - No build step required
 * - ES6+ modules
 * - Reactive updates
 * - Clean, functional approach
 * - Connection status tracking for Bitwig and Roger
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
            // Only update if changed (prevents selection clearing)
            if (messageEl.textContent !== data.data.message) {
                messageEl.textContent = data.data.message;
            }
            messageEl.className = 'message';
        } else {
            const errorMsg = 'Unable to load hello message';
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

            // Only update if changed (prevents selection clearing)
            const jeannieVer = data.data.jeannie || 'unknown';
            const rogerVer = data.data.roger || 'unknown';
            const configVer = data.data.config || 'unknown';

            if (jeannieEl.textContent !== jeannieVer) jeannieEl.textContent = jeannieVer;
            if (rogerEl.textContent !== rogerVer) rogerEl.textContent = rogerVer;
            if (configEl.textContent !== configVer) configEl.textContent = configVer;
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

            // Roger status
            const rogerEl = document.getElementById('roger-status');
            rogerEl.textContent = status.roger.connected ? '🟢 Connected' : '⚫ Disconnected';
            rogerEl.className = `value status-badge status-${status.roger.connected ? 'ok' : 'error'}`;

            const rogerCommand = document.getElementById('roger-command');
            rogerCommand.textContent = status.roger.lastCommand || 'None';
        }
    }

    async refresh() {
        this.lastUpdate = new Date();

        // Fetch all data in parallel
        await Promise.all([
            this.updateHello(),
            this.updateVersion(),
            this.updateConfig(),
            this.updateHealth(),
            this.updateConnectionStatus()
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
