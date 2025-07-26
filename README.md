# SSH Key Inspection Manager CLI (ssh-kim-cli)

A powerful command-line interface for managing SSH keys with encryption, search, and import/export capabilities. Built with Node.js.

## 🚀 Quick Start

### Install from npm (Recommended)

```bash
# Install globally
npm install -g ssh-kim-cli

# Use the CLI
ssh-kim --help
ssh-kim list
ssh-kim interactive
```

### Install from source

```bash
# Clone and install
git clone git@github.com:rapidrabbitsoft/ssh-kim-cli.git
cd ssh-kim-cli
npm install

# Run the CLI
npm start

# Or run directly
node cli.js

# Interactive mode
node cli.js interactive
```

## ✨ Features

- **🔧 Cross-platform**: Works on Windows, macOS, and Linux
- **🔑 Key Management**: Add, edit, and delete SSH keys
- **🔍 Auto-detection**: Automatically scans common SSH key locations
- **📝 Key Types**: Supports RSA, DSA, ECDSA, and Ed25519 keys
- **🔎 Search & Filter**: Find keys by name, tag, or type
- **🔒 Encryption**: Keys are stored encrypted for security
- **📋 Copy to Clipboard**: Easy key copying functionality
- **🏷️ Tagging System**: Organize keys with custom tags
- **📦 Import/Export**: Import from files/directories, export to JSON
- **⚙️ Configuration**: Custom file paths and settings
- **🖥️ Interactive Mode**: User-friendly interactive interface

## 📋 System Requirements

- **Node.js**: v16 or later
- **npm**: Latest version

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g ssh-kim-cli
```

This installs the CLI globally and makes the `ssh-kim` command available system-wide.

### Development Setup

1. **Clone and Setup**
   ```bash
   git clone git@github.com:rapidrabbitsoft/ssh-kim-cli.git
   cd ssh-kim-cli
   npm install
   ```

2. **Run CLI**
   ```bash
   npm start
   ```

### Verify Installation

```bash
ssh-kim --version
ssh-kim --help
```

## 🎯 Usage

### Basic Commands

```bash
# List all keys
ssh-kim list

# Add a new key
ssh-kim add

# Edit a key
ssh-kim edit <key-id>

# Delete a key
ssh-kim delete <key-id>

# Copy key to clipboard
ssh-kim copy <key-id>

# Show key details
ssh-kim show <key-id>
```

### Advanced Commands

```bash
# Search keys
ssh-kim list --search "github"
ssh-kim list --tag "production"
ssh-kim list --type "RSA"

# Scan for keys
ssh-kim scan
ssh-kim scan --path /custom/path

# Import keys
ssh-kim import --file /path/to/key.pub
ssh-kim import --directory /path/to/keys/

# Export keys
ssh-kim export --all --file keys_backup.json
ssh-kim export --id <key-id> --file single_key.json

# Configuration
ssh-kim config --show
ssh-kim config --path /custom/path/to/keys.enc
ssh-kim config --reset
```

### Interactive Mode

For a user-friendly experience, use interactive mode:

```bash
ssh-kim interactive
```

This provides a menu-driven interface for all operations.

## 📁 Data Storage

SSH keys are stored in an encrypted JSON file:

- **Default Location**: `./data/ssh_keys.enc` (relative to current directory)
- **Custom Location**: Can be set via configuration
- **Encryption**: AES-256-CBC encryption for security

## 🔧 Configuration

### View Current Configuration
```bash
ssh-kim config --show
```

### Set Custom Keys File Path
```bash
ssh-kim config --path /path/to/your/keys.enc
```

### Reset to Defaults
```bash
ssh-kim config --reset
```

## 📊 Key Management

### Adding Keys

You can add keys in several ways:

1. **Manual Entry**: Type or paste key content
2. **File Import**: Read from a `.pub` file
3. **Auto-scan**: Scan common SSH directories

```bash
# Interactive add
ssh-kim add

# Add with options
ssh-kim add --name "GitHub Key" --tag "github" --file ~/.ssh/id_rsa.pub
```

### Editing Keys

```bash
# Interactive edit
ssh-kim edit <key-id>

# Edit with options
ssh-kim edit <key-id> --name "New Name" --tag "new-tag"
```

### Searching and Filtering

```bash
# Search by term (searches name, tag, and type)
ssh-kim list --search "github"

# Filter by tag
ssh-kim list --tag "production"

# Filter by key type
ssh-kim list --type "Ed25519"
```

## 🔍 Scanning and Importing

### Scan Common Locations

The CLI automatically scans these locations:
- `~/.ssh/` (Unix/Linux/macOS)
- `~/.ssh/` (Windows)
- `%APPDATA%/PuTTY/` (Windows)
- `%LOCALAPPDATA%/ssh/` (Windows)

```bash
# Scan all common locations
ssh-kim scan

# Scan custom location
ssh-kim scan --path /custom/ssh/directory
```

### Import Keys

```bash
# Import from file
ssh-kim import --file ~/.ssh/id_rsa.pub

# Import from directory
ssh-kim import --directory ~/.ssh/

# Interactive import
ssh-kim import
```

## 📤 Exporting Keys

```bash
# Export all keys
ssh-kim export --all --file backup.json

# Export specific key
ssh-kim export --id <key-id> --file single_key.json

# Interactive export
ssh-kim export
```

## 🎨 Output Format

### List Output
```
SSH Keys (3 found):

1. GitHub Key [github]
   ID: 12345678-1234-1234-1234-123456789abc
   Type: RSA
   Modified: 12/25/2023
   Key: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...

2. Production Server [production]
   ID: 87654321-4321-4321-4321-cba987654321
   Type: Ed25519
   Modified: 12/24/2023
   Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...
```

### Export Format
```json
{
  "exported_at": "2023-12-25T10:30:00.000Z",
  "total_keys": 2,
  "keys": [
    {
      "id": "12345678-1234-1234-1234-123456789abc",
      "name": "GitHub Key",
      "tag": "github",
      "key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
      "key_type": "RSA",
      "created": "2023-12-25T10:00:00.000Z",
      "last_modified": "2023-12-25T10:30:00.000Z"
    }
  ]
}
```

## 🔒 Security

- **Encryption**: All keys are encrypted using AES-256-CBC
- **Local Storage**: Keys are stored locally, never transmitted
- **File Permissions**: Respects system file permissions
- **No Cloud**: No data is sent to external services

## 🐛 Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   # Check file permissions
   ls -la data/ssh_keys.enc
   chmod 600 data/ssh_keys.enc
   ```

2. **Key Not Found**
   ```bash
   # List all keys to find the correct ID
   ssh-kim list
   ```

3. **Import Fails**
   ```bash
   # Check if file exists and is readable
   cat ~/.ssh/id_rsa.pub
   ```

### Debug Mode

For debugging, you can run with verbose output:
```bash
DEBUG=* node cli.js list
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Related Projects

- [ssh-keygen](https://www.openssh.com/manual.html) - OpenSSH key generation tool

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the interactive help: `ssh-kim --help` 