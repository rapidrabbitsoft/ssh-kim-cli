#!/usr/bin/env node

import { SSHKeyManager } from './cli/ssh-key-manager.js';
import chalk from 'chalk';

async function testCLI() {
  console.log(chalk.bold.blue('Testing SSH Key Manager CLI\n'));
  
  const manager = new SSHKeyManager();
  let testPassed = 0;
  let testFailed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(chalk.green(`✓ ${message}`));
      testPassed++;
    } else {
      console.log(chalk.red(`✗ ${message}`));
      testFailed++;
    }
  }
  
  try {
    // Test 1: Configuration
    console.log(chalk.yellow('Test 1: Configuration'));
    const config = manager.config.get('defaultSSHDir');
    assert(config, 'Default SSH directory is set');
    assert(typeof config === 'string', 'Default SSH directory is a string');
    
    // Test 2: Keys file path
    console.log(chalk.yellow('\nTest 2: Keys file path'));
    const keysPath = manager.getKeysFilePath();
    assert(keysPath, 'Keys file path is set');
    assert(keysPath.includes('ssh_keys.enc'), 'Keys file path contains correct filename');
    
    // Test 3: Encryption/Decryption
    console.log(chalk.yellow('\nTest 3: Encryption/Decryption'));
    const testData = 'test-ssh-key-content';
    const encrypted = manager.encryptData(testData);
    const decrypted = manager.decryptData(encrypted);
    assert(encrypted !== testData, 'Data is encrypted');
    assert(decrypted === testData, 'Data is correctly decrypted');
    
    // Test 4: Key type detection
    console.log(chalk.yellow('\nTest 4: Key type detection'));
    const rsaKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...';
    const ed25519Key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...';
    const ecdsaKey = 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB...';
    
    assert(manager.detectKeyType(rsaKey) === 'RSA', 'RSA key type detected correctly');
    assert(manager.detectKeyType(ed25519Key) === 'Ed25519', 'Ed25519 key type detected correctly');
    assert(manager.detectKeyType(ecdsaKey) === 'ECDSA', 'ECDSA key type detected correctly');
    
    // Test 5: ID generation
    console.log(chalk.yellow('\nTest 5: ID generation'));
    const id1 = manager.generateId();
    const id2 = manager.generateId();
    assert(id1 !== id2, 'Generated IDs are unique');
    assert(id1.length > 0, 'Generated ID is not empty');
    
    // Test 6: Load/Save keys
    console.log(chalk.yellow('\nTest 6: Load/Save keys'));
    const testKeys = [
      {
        id: manager.generateId(),
        name: 'Test Key 1',
        tag: 'test',
        key: rsaKey,
        key_type: 'RSA',
        created: new Date().toISOString(),
        last_modified: new Date().toISOString()
      }
    ];
    
    await manager.saveKeys(testKeys);
    const loadedKeys = await manager.loadKeys();
    assert(loadedKeys.length === testKeys.length, 'Keys are saved and loaded correctly');
    assert(loadedKeys[0].name === testKeys[0].name, 'Key name is preserved');
    
    // Test 7: Common SSH locations
    console.log(chalk.yellow('\nTest 7: Common SSH locations'));
    const locations = manager.getCommonSSHLocations();
    assert(locations.length > 0, 'Common SSH locations are defined');
    assert(locations.some(loc => loc.includes('.ssh')), 'Default .ssh location is included');
    
    // Test 8: Filter functionality
    console.log(chalk.yellow('\nTest 8: Filter functionality'));
    const allKeys = [
      { name: 'GitHub Key', tag: 'github', key_type: 'RSA' },
      { name: 'Production Key', tag: 'production', key_type: 'Ed25519' },
      { name: 'Test Key', tag: 'test', key_type: 'RSA' }
    ];
    
    const githubKeys = allKeys.filter(key => key.tag === 'github');
    const rsaKeys = allKeys.filter(key => key.key_type === 'RSA');
    
    assert(githubKeys.length === 1, 'GitHub tag filter works');
    assert(rsaKeys.length === 2, 'RSA type filter works');
    
    console.log(chalk.yellow('\nTest Results:'));
    console.log(chalk.green(`Passed: ${testPassed}`));
    console.log(chalk.red(`Failed: ${testFailed}`));
    
    if (testFailed === 0) {
      console.log(chalk.bold.green('\n🎉 All tests passed!'));
    } else {
      console.log(chalk.bold.red('\n❌ Some tests failed!'));
    }
    
  } catch (error) {
    console.error(chalk.red('Test failed with error:'), error.message);
    testFailed++;
  }
}

// Run tests
testCLI(); 