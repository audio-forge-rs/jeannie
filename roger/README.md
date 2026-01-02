# Roger CLI

Version: 0.1.0

## Overview
Python command-line interface for interacting with the Jeannie Bitwig controller via REST API.

## Installation
```bash
# Install dependencies (optional, for config updates)
pip install pyyaml
```

## Usage

```bash
# Make executable
chmod +x roger.py

# Show help
./roger.py --help

# Get version
./roger.py --version

# Hello world
./roger.py hello

# Check Jeannie API health
./roger.py health

# Get version info from all components
./roger.py version

# Get current config
./roger.py config

# Update config file with Roger's info
./roger.py update-config

# Get raw JSON output
./roger.py --raw hello
```

## Commands

- `hello` - Get hello world message from Jeannie (includes Roger and Jeannie version info)
- `health` - Check if Jeannie API is running
- `version` - Get version information from all components
- `config` - Display current configuration from /tmp/jeannie-config.yaml
- `update-config` - Write Roger's name and version to config file

## Configuration

Roger interacts with:
- **Jeannie API**: `http://localhost:3000` (configurable with `--api-url`)
- **Config file**: `/tmp/jeannie-config.yaml`

## Example Workflow

```bash
# 1. Start Jeannie web server (in another terminal)
cd ../web && npm run dev

# 2. Update config with Roger's info
./roger.py update-config

# 3. Get hello world message
./roger.py hello
# Output: Hello from Jeannie! Connected to roger v0.1.0
```
