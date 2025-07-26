#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { SSHKeyManager } from './cli/ssh-key-manager.js';

const program = new Command();

program
  .name('ssh-kim')
  .description('SSH Key Inspection Manager CLI - Manage your SSH keys from the command line')
  .version('1.0.0');

// List all keys
program
  .command('list')
  .alias('ls')
  .description('List all SSH keys')
  .option('-s, --search <term>', 'Search keys by name, tag, or type')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('-y, --type <type>', 'Filter by key type (RSA, DSA, ECDSA, Ed25519)')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.listKeys(options);
  });

// Add a new key
program
  .command('add')
  .alias('a')
  .description('Add a new SSH key')
  .option('-n, --name <name>', 'Key name')
  .option('-t, --tag <tag>', 'Key tag')
  .option('-f, --file <path>', 'Path to SSH key file')
  .option('-c, --content <content>', 'SSH key content')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.addKey(options);
  });

// Edit a key
program
  .command('edit')
  .alias('e')
  .description('Edit an existing SSH key')
  .argument('<id>', 'Key ID')
  .option('-n, --name <name>', 'New key name')
  .option('-t, --tag <tag>', 'New key tag')
  .option('-c, --content <content>', 'New key content')
  .action(async (id, options) => {
    const manager = new SSHKeyManager();
    await manager.editKey(id, options);
  });

// Delete a key
program
  .command('delete')
  .alias('del', 'rm')
  .description('Delete an SSH key')
  .argument('<id>', 'Key ID')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(async (id, options) => {
    const manager = new SSHKeyManager();
    await manager.deleteKey(id, options);
  });

// Copy key to clipboard
program
  .command('copy')
  .alias('cp')
  .description('Copy SSH key content to clipboard')
  .argument('<id>', 'Key ID')
  .action(async (id) => {
    const manager = new SSHKeyManager();
    await manager.copyKey(id);
  });

// Scan for keys
program
  .command('scan')
  .alias('s')
  .description('Scan common SSH key locations')
  .option('-p, --path <path>', 'Custom path to scan')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.scanKeys(options);
  });

// Import keys
program
  .command('import')
  .alias('imp')
  .description('Import SSH keys from file or directory')
  .option('-f, --file <path>', 'Path to SSH key file')
  .option('-d, --directory <path>', 'Directory to scan for keys')
  .option('-p, --password <password>', 'Password for encrypted import')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.importKeys(options);
  });

// Export keys
program
  .command('export')
  .alias('exp')
  .description('Export SSH keys to file')
  .option('-f, --file <path>', 'Output file path')
  .option('-a, --all', 'Export all keys')
  .option('-i, --id <id>', 'Export specific key by ID')
  .option('-p, --password <password>', 'Password for encrypted export')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.exportKeys(options);
  });

// Show key details
program
  .command('show')
  .alias('info')
  .description('Show detailed information about a key')
  .argument('<id>', 'Key ID')
  .action(async (id) => {
    const manager = new SSHKeyManager();
    await manager.showKey(id);
  });

// Settings
program
  .command('config')
  .alias('cfg')
  .description('Manage configuration settings')
  .option('-s, --show', 'Show current configuration')
  .option('-p, --path <path>', 'Set custom keys file path')
  .option('-r, --reset', 'Reset to default configuration')
  .option('--set-password <password>', 'Set encryption password')
  .option('--clear-password', 'Clear encryption password')
  .action(async (options) => {
    const manager = new SSHKeyManager();
    await manager.manageConfig(options);
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    const manager = new SSHKeyManager();
    await manager.interactiveMode();
  });

// Default command (list keys)
program
  .action(async () => {
    const manager = new SSHKeyManager();
    await manager.listKeys({});
  });

program.parse(); 