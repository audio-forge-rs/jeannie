#!/usr/bin/env python3
"""
Roger - Jeannie Bitwig Controller CLI
Version: 0.3.0

Command-line interface for interacting with Jeannie controller via REST API
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import urllib.request
import urllib.error
import urllib.parse

__version__ = '0.3.0'
__name__ = 'roger'

# Configuration - Cross-platform config path (macOS + Linux)
JEANNIE_API_URL = 'http://localhost:3000'
CONFIG_FILE = os.path.join(os.path.expanduser('~'), '.config', 'jeannie', 'config.yaml')


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

    # Content search methods

    def content_search(self, query: str, fuzzy: bool = False, content_type: Optional[str] = None,
                      creator: Optional[str] = None, category: Optional[str] = None,
                      limit: int = 100) -> Dict[str, Any]:
        """Search content by query"""
        params = {'q': query, 'limit': str(limit)}
        if fuzzy:
            params['fuzzy'] = 'true'
        if content_type:
            params['type'] = content_type
        if creator:
            params['creator'] = creator
        if category:
            params['category'] = category

        query_string = urllib.parse.urlencode(params)
        return self._make_request(f'/api/content/search?{query_string}')

    def content_list(self, content_type: Optional[str] = None, creator: Optional[str] = None,
                     category: Optional[str] = None, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """List content with filters"""
        params = {'limit': str(limit), 'offset': str(offset)}
        if content_type:
            params['type'] = content_type
        if creator:
            params['creator'] = creator
        if category:
            params['category'] = category

        query_string = urllib.parse.urlencode(params)
        return self._make_request(f'/api/content?{query_string}')

    def content_stats(self) -> Dict[str, Any]:
        """Get content statistics"""
        return self._make_request('/api/content/stats')

    def content_types(self) -> Dict[str, Any]:
        """Get available content types"""
        return self._make_request('/api/content/types')

    def content_creators(self) -> Dict[str, Any]:
        """Get available creators"""
        return self._make_request('/api/content/creators')

    def content_categories(self) -> Dict[str, Any]:
        """Get available categories"""
        return self._make_request('/api/content/categories')

    def content_status(self) -> Dict[str, Any]:
        """Get content index status"""
        return self._make_request('/api/content/status')

    def content_rescan(self) -> Dict[str, Any]:
        """Trigger content rescan"""
        return self._make_request('/api/content/rescan', method='POST')

    def update_config(self) -> bool:
        """Update config file with Roger's info"""
        try:
            import yaml

            # Ensure config directory exists
            config_dir = os.path.dirname(CONFIG_FILE)
            os.makedirs(config_dir, exist_ok=True)

            config = {
                'version': '0.2.0',
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

    # Content commands
    content_parser = subparsers.add_parser('content', help='Content search and management')
    content_subparsers = content_parser.add_subparsers(dest='content_command', help='Content commands')

    # content search
    search_parser = content_subparsers.add_parser('search', help='Search content')
    search_parser.add_argument('query', help='Search query')
    search_parser.add_argument('--fuzzy', action='store_true', help='Use fuzzy search')
    search_parser.add_argument('--type', help='Filter by content type (Device, Preset, Sample)')
    search_parser.add_argument('--creator', help='Filter by creator')
    search_parser.add_argument('--category', help='Filter by category')
    search_parser.add_argument('--limit', type=int, default=20, help='Maximum results (default: 20)')

    # content list
    list_parser = content_subparsers.add_parser('list', help='List content')
    list_parser.add_argument('--type', help='Filter by content type')
    list_parser.add_argument('--creator', help='Filter by creator')
    list_parser.add_argument('--category', help='Filter by category')
    list_parser.add_argument('--limit', type=int, default=20, help='Maximum results (default: 20)')
    list_parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')

    # content stats
    content_subparsers.add_parser('stats', help='Get content statistics')

    # content types
    content_subparsers.add_parser('types', help='List available content types')

    # content creators
    content_subparsers.add_parser('creators', help='List available creators')

    # content categories
    content_subparsers.add_parser('categories', help='List available categories')

    # content status
    content_subparsers.add_parser('status', help='Get content index status')

    # content rescan
    content_subparsers.add_parser('rescan', help='Trigger content rescan')

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

    elif args.command == 'content':
        if not hasattr(args, 'content_command') or not args.content_command:
            content_parser.print_help()
            sys.exit(0)

        if args.content_command == 'search':
            response = cli.content_search(
                query=args.query,
                fuzzy=args.fuzzy,
                content_type=args.type,
                creator=args.creator,
                category=args.category,
                limit=args.limit
            )
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Found {data.get('total', 0)} results for '{data.get('query')}'\n")
                for result in data.get('results', []):
                    score = result.get('score', 1.0)
                    name = result.get('name', 'Unknown')
                    content_type = result.get('contentType', 'Unknown')
                    creator = result.get('creator', '')
                    print(f"  [{score:.2f}] {name} ({content_type})", end='')
                    if creator:
                        print(f" - {creator}", end='')
                    print()
            else:
                cli.print_response(response, args.raw)

        elif args.content_command == 'list':
            response = cli.content_list(
                content_type=args.type,
                creator=args.creator,
                category=args.category,
                limit=args.limit,
                offset=args.offset
            )
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ {data.get('total', 0)} items (showing {len(data.get('results', []))})\n")
                for item in data.get('results', []):
                    name = item.get('name', 'Unknown')
                    content_type = item.get('contentType', 'Unknown')
                    creator = item.get('creator', '')
                    print(f"  {name} ({content_type})", end='')
                    if creator:
                        print(f" - {creator}", end='')
                    print()
            else:
                cli.print_response(response, args.raw)

        elif args.content_command == 'stats':
            response = cli.content_stats()
            cli.print_response(response, args.raw)

        elif args.content_command == 'types':
            response = cli.content_types()
            if response.get('success') and 'data' in response:
                print("✓ Available content types:\n")
                for content_type in response['data']:
                    print(f"  - {content_type}")
            else:
                cli.print_response(response, args.raw)

        elif args.content_command == 'creators':
            response = cli.content_creators()
            if response.get('success') and 'data' in response:
                print(f"✓ Available creators ({len(response['data'])}):\n")
                for creator in response['data'][:50]:  # Show first 50
                    print(f"  - {creator}")
                if len(response['data']) > 50:
                    print(f"\n  ... and {len(response['data']) - 50} more")
            else:
                cli.print_response(response, args.raw)

        elif args.content_command == 'categories':
            response = cli.content_categories()
            if response.get('success') and 'data' in response:
                print(f"✓ Available categories ({len(response['data'])}):\n")
                for category in response['data'][:50]:  # Show first 50
                    print(f"  - {category}")
                if len(response['data']) > 50:
                    print(f"\n  ... and {len(response['data']) - 50} more")
            else:
                cli.print_response(response, args.raw)

        elif args.content_command == 'status':
            response = cli.content_status()
            cli.print_response(response, args.raw)

        elif args.content_command == 'rescan':
            response = cli.content_rescan()
            cli.print_response(response, args.raw)


if __name__ == '__main__':
    main()
