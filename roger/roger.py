#!/usr/bin/env python3
"""
Roger - Jeannie Bitwig Controller CLI
Version: 0.1.0

Command-line interface for interacting with Jeannie controller via REST API
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import urllib.request
import urllib.error

__version__ = '0.1.0'
__name__ = 'roger'

# Configuration
JEANNIE_API_URL = 'http://localhost:3000'
CONFIG_FILE = '/tmp/jeannie-config.yaml'


class RogerCLI:
    """Roger CLI for Jeannie controller interaction"""

    def __init__(self, api_url: str = JEANNIE_API_URL):
        self.api_url = api_url
        self.name = __name__
        self.version = __version__

    def _make_request(self, endpoint: str, method: str = 'GET', data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to Jeannie API"""
        url = f"{self.api_url}{endpoint}"

        try:
            headers = {'Content-Type': 'application/json'}
            request_data = json.dumps(data).encode('utf-8') if data else None

            req = urllib.request.Request(url, data=request_data, headers=headers, method=method)

            with urllib.request.urlopen(req, timeout=5) as response:
                return json.loads(response.read().decode('utf-8'))

        except urllib.error.URLError as e:
            return {
                'success': False,
                'error': f'Failed to connect to Jeannie API: {e.reason}',
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Request failed: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }

    def hello(self) -> Dict[str, Any]:
        """Get hello world message from Jeannie"""
        return self._make_request('/api/hello')

    def health(self) -> Dict[str, Any]:
        """Check Jeannie API health"""
        return self._make_request('/health')

    def version(self) -> Dict[str, Any]:
        """Get version info from Jeannie"""
        result = self._make_request('/api/version')
        # Include Roger's own version
        if result.get('success') and 'data' in result:
            result['data']['roger'] = self.version
        return result

    def get_config(self) -> Dict[str, Any]:
        """Get current configuration"""
        return self._make_request('/api/config')

    def update_config(self) -> bool:
        """Update config file with Roger's info"""
        try:
            import yaml

            config = {
                'version': '0.1.0',
                'roger': {
                    'name': self.name,
                    'version': self.version,
                    'timestamp': datetime.now().isoformat()
                },
                'controller': {
                    'name': 'jeannie',
                    'enabled': True
                },
                'lastUpdated': datetime.now().isoformat()
            }

            with open(CONFIG_FILE, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)

            print(f"✓ Config updated: {CONFIG_FILE}")
            return True

        except ImportError:
            print("✗ PyYAML not installed. Install with: pip install pyyaml", file=sys.stderr)
            return False
        except Exception as e:
            print(f"✗ Failed to update config: {e}", file=sys.stderr)
            return False

    def print_response(self, response: Dict[str, Any], raw: bool = False) -> None:
        """Print API response in a formatted way"""
        if raw:
            print(json.dumps(response, indent=2))
            return

        if response.get('success'):
            print("✓ Success")
            if 'data' in response:
                print(json.dumps(response['data'], indent=2))
        else:
            print(f"✗ Error: {response.get('error', 'Unknown error')}", file=sys.stderr)
            sys.exit(1)


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description=f'{__name__} v{__version__} - CLI for Jeannie Bitwig Controller',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument('--version', action='version', version=f'{__name__} v{__version__}')
    parser.add_argument('--api-url', default=JEANNIE_API_URL, help='Jeannie API URL')
    parser.add_argument('--raw', action='store_true', help='Output raw JSON response')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Commands
    subparsers.add_parser('hello', help='Get hello world message from Jeannie')
    subparsers.add_parser('health', help='Check Jeannie API health')
    subparsers.add_parser('version', help='Get version information')
    subparsers.add_parser('config', help='Get current configuration')
    subparsers.add_parser('update-config', help='Update config file with Roger info')

    args = parser.parse_args()

    # Show help if no command
    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Initialize CLI
    cli = RogerCLI(api_url=args.api_url)

    # Execute command
    if args.command == 'hello':
        response = cli.hello()
        cli.print_response(response, args.raw)

    elif args.command == 'health':
        response = cli.health()
        cli.print_response(response, args.raw)

    elif args.command == 'version':
        response = cli.version()
        cli.print_response(response, args.raw)

    elif args.command == 'config':
        response = cli.get_config()
        cli.print_response(response, args.raw)

    elif args.command == 'update-config':
        if cli.update_config():
            print(f"\n{cli.name} v{cli.version} config written to {CONFIG_FILE}")
            print("Jeannie API will automatically detect the change.")
        else:
            sys.exit(1)


if __name__ == '__main__':
    main()
