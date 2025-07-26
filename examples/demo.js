#!/usr/bin/env node

import { SSHKeyManager } from '../cli/ssh-key-manager.js';
import chalk from 'chalk';

async function demo() {
  console.log(chalk.bold.blue('SSH Key Manager CLI Demo\n'));
  
  const manager = new SSHKeyManager();
  
  try {
    // 1. Show current configuration
    console.log(chalk.yellow('1. Current Configuration:'));
    await manager.manageConfig({ show: true });
    console.log('');
    
    // 2. Scan for existing keys
    console.log(chalk.yellow('2. Scanning for SSH keys:'));
    await manager.scanKeys();
    console.log('');
    
    // 3. List current keys (should be empty initially)
    console.log(chalk.yellow('3. Current stored keys:'));
    await manager.listKeys();
    console.log('');
    
    // 4. Import a key from the scanned location
    console.log(chalk.yellow('4. Importing a key from ~/.ssh/id_rsa.pub:'));
    try {
      await manager.importFromFile('/Users/macmichael01/.ssh/id_rsa.pub');
      console.log('');
    } catch (error) {
      console.log(chalk.red('Could not import key (file might not exist):'), error.message);
      console.log('');
    }
    
    // 5. List keys again (should show imported key)
    console.log(chalk.yellow('5. Keys after import:'));
    await manager.listKeys();
    console.log('');
    
    // 6. Show detailed information about the key
    console.log(chalk.yellow('6. Key details:'));
    const keys = await manager.loadKeys();
    if (keys.length > 0) {
      await manager.showKey(keys[0].id);
      console.log('');
    }
    
    // 7. Export keys
    console.log(chalk.yellow('7. Exporting keys:'));
    await manager.exportKeys({ all: true, file: 'demo_export.json' });
    console.log('');
    
    console.log(chalk.green('Demo completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('Demo failed:'), error.message);
  }
}

// Run the demo
demo(); 