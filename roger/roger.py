#!/usr/bin/env python3
"""
Roger - Jeannie Bitwig Controller CLI
Vendor: Audio Forge RS

Command-line interface for interacting with Jeannie controller via REST API
Version is read from /versions.json (single source of truth)
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

# Load version from single source of truth
def _load_version() -> str:
    """Load Roger version from versions.json"""
    try:
        versions_file = Path(__file__).parent.parent / 'versions.json'
        with open(versions_file, 'r') as f:
            versions = json.load(f)
            return versions.get('roger', '0.9.0')
    except Exception:
        return '0.9.0'  # Fallback

__version__ = _load_version()
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

    # Track management methods

    def track_list(self) -> Dict[str, Any]:
        """List all tracks in the current project"""
        return self._make_request('/api/bitwig/tracks')

    def track_current(self) -> Dict[str, Any]:
        """Get info about current/selected track"""
        return self._make_request('/api/bitwig/tracks/current')

    def track_create(self, track_type: str = 'instrument', name: Optional[str] = None,
                     position: int = -1) -> Dict[str, Any]:
        """Create a new track"""
        data = {'type': track_type, 'position': position}
        if name:
            data['name'] = name
        return self._make_request('/api/bitwig/tracks', method='POST', data=data)

    def track_select(self, index: int) -> Dict[str, Any]:
        """Select track by index"""
        return self._make_request('/api/bitwig/tracks/select', method='POST', data={'index': index})

    def track_navigate(self, direction: str) -> Dict[str, Any]:
        """Navigate to next, previous, first, or last track"""
        return self._make_request('/api/bitwig/tracks/navigate', method='POST', data={'direction': direction})

    def track_rename(self, name: str) -> Dict[str, Any]:
        """Rename current track"""
        return self._make_request('/api/bitwig/tracks/rename', method='POST', data={'name': name})

    def track_mute(self, mute: bool) -> Dict[str, Any]:
        """Set track mute state"""
        return self._make_request('/api/bitwig/tracks/mute', method='POST', data={'mute': mute})

    def track_solo(self, solo: bool) -> Dict[str, Any]:
        """Set track solo state"""
        return self._make_request('/api/bitwig/tracks/solo', method='POST', data={'solo': solo})

    def track_volume(self, volume: float) -> Dict[str, Any]:
        """Set track volume (0.0 to 1.0)"""
        return self._make_request('/api/bitwig/tracks/volume', method='POST', data={'volume': volume})

    def track_pan(self, pan: float) -> Dict[str, Any]:
        """Set track pan (-1.0 to 1.0)"""
        return self._make_request('/api/bitwig/tracks/pan', method='POST', data={'pan': pan})

    def track_device(self, device_id: str, device_type: str = 'vst3') -> Dict[str, Any]:
        """Insert device into current track"""
        return self._make_request('/api/bitwig/tracks/device', method='POST',
                                  data={'deviceId': device_id, 'deviceType': device_type})

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

    # Track commands
    track_parser = subparsers.add_parser('track', help='Track management commands')
    track_subparsers = track_parser.add_subparsers(dest='track_command', help='Track commands')

    # track list
    track_subparsers.add_parser('list', help='List all tracks')

    # track current
    track_subparsers.add_parser('current', help='Get current track info')

    # track create
    create_parser = track_subparsers.add_parser('create', help='Create a new track')
    create_parser.add_argument('--type', choices=['instrument', 'audio', 'effect'],
                               default='instrument', help='Track type (default: instrument)')
    create_parser.add_argument('--name', help='Track name')
    create_parser.add_argument('--position', type=int, default=-1,
                               help='Position to insert (-1 for end)')

    # track select
    select_parser = track_subparsers.add_parser('select', help='Select track by index')
    select_parser.add_argument('index', type=int, help='Track index (0-based)')

    # track next/prev/first/last
    track_subparsers.add_parser('next', help='Select next track')
    track_subparsers.add_parser('prev', help='Select previous track')
    track_subparsers.add_parser('first', help='Select first track')
    track_subparsers.add_parser('last', help='Select last track')

    # track rename
    rename_parser = track_subparsers.add_parser('rename', help='Rename current track')
    rename_parser.add_argument('name', help='New track name')

    # track mute
    mute_parser = track_subparsers.add_parser('mute', help='Mute current track')
    mute_parser.add_argument('--off', action='store_true', help='Unmute instead of mute')

    # track solo
    solo_parser = track_subparsers.add_parser('solo', help='Solo current track')
    solo_parser.add_argument('--off', action='store_true', help='Unsolo instead of solo')

    # track volume
    volume_parser = track_subparsers.add_parser('volume', help='Set track volume')
    volume_parser.add_argument('value', type=float, help='Volume (0.0 to 1.0, or percentage like 75)')

    # track pan
    pan_parser = track_subparsers.add_parser('pan', help='Set track pan')
    pan_parser.add_argument('value', type=float, help='Pan (-1.0 left to 1.0 right, 0 = center)')

    # track device
    device_parser = track_subparsers.add_parser('device', help='Insert device into current track')
    device_parser.add_argument('device_id', help='Device ID (e.g., VST3 ID)')
    device_parser.add_argument('--type', choices=['vst3', 'vst2', 'bitwig'],
                               default='vst3', help='Device type (default: vst3)')

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

    elif args.command == 'track':
        if not hasattr(args, 'track_command') or not args.track_command:
            track_parser.print_help()
            sys.exit(0)

        if args.track_command == 'list':
            response = cli.track_list()
            if response.get('success') and 'data' in response:
                data = response['data']
                tracks = data.get('tracks', [])
                print(f"✓ {len(tracks)} track(s) in project:\n")
                for track in tracks:
                    idx = track.get('index', '?')
                    name = track.get('name', 'Unnamed')
                    muted = '[M]' if track.get('muted') else '   '
                    soloed = '[S]' if track.get('soloed') else '   '
                    print(f"  {idx}: {muted}{soloed} {name}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'current':
            response = cli.track_current()
            if response.get('success') and 'data' in response:
                data = response['data']
                print("✓ Current track:")
                print(f"  Name: {data.get('name', 'Unknown')}")
                print(f"  Position: {data.get('position', '?')}")
                print(f"  Muted: {data.get('muted', False)}")
                print(f"  Soloed: {data.get('soloed', False)}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'create':
            response = cli.track_create(
                track_type=args.type,
                name=args.name,
                position=args.position
            )
            if response.get('success'):
                track_name = args.name or f'New {args.type} track'
                print(f"✓ Created {args.type} track: {track_name}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'select':
            response = cli.track_select(args.index)
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Selected track {args.index}: {data.get('name', 'Unknown')}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'next':
            response = cli.track_navigate('next')
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Moved to track: {data.get('name', 'Unknown')}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'prev':
            response = cli.track_navigate('previous')
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Moved to track: {data.get('name', 'Unknown')}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'first':
            response = cli.track_navigate('first')
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Moved to first track: {data.get('name', 'Unknown')}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'last':
            response = cli.track_navigate('last')
            if response.get('success') and 'data' in response:
                data = response['data']
                print(f"✓ Moved to last track: {data.get('name', 'Unknown')}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'rename':
            response = cli.track_rename(args.name)
            if response.get('success'):
                print(f"✓ Track renamed to: {args.name}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'mute':
            mute_state = not args.off
            response = cli.track_mute(mute_state)
            if response.get('success'):
                print(f"✓ Track {'muted' if mute_state else 'unmuted'}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'solo':
            solo_state = not args.off
            response = cli.track_solo(solo_state)
            if response.get('success'):
                print(f"✓ Track solo {'enabled' if solo_state else 'disabled'}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'volume':
            # Support both 0.0-1.0 and percentage (1-100)
            volume = args.value
            if volume > 1.0:
                volume = volume / 100.0  # Assume percentage
            volume = max(0.0, min(1.0, volume))
            response = cli.track_volume(volume)
            if response.get('success'):
                print(f"✓ Track volume set to {int(volume * 100)}%")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'pan':
            pan = max(-1.0, min(1.0, args.value))
            response = cli.track_pan(pan)
            if response.get('success'):
                if pan == 0:
                    label = "center"
                elif pan < 0:
                    label = f"{int(abs(pan) * 100)}% left"
                else:
                    label = f"{int(pan * 100)}% right"
                print(f"✓ Track pan set to {label}")
            else:
                cli.print_response(response, args.raw)

        elif args.track_command == 'device':
            response = cli.track_device(args.device_id, args.type)
            if response.get('success'):
                print(f"✓ Device inserted: {args.device_id} ({args.type})")
            else:
                cli.print_response(response, args.raw)


if __name__ == '__main__':
    main()
