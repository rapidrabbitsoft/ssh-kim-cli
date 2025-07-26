import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import clipboardy from 'clipboardy';
import Conf from 'conf';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SSHKeyManager {
  constructor() {
    this.config = new Conf({
      projectName: 'ssh-kim-cli',
      defaults: {
        keysFilePath: null,
        defaultSSHDir: this.getDefaultSSHDir(),
        encryptionPassword: null
      }
    });
    
    this.machineKey = this.getMachineKey();
    this.passwordKey = this.config.get('encryptionPassword') ? 
      this.deriveKeyFromPassword(this.config.get('encryptionPassword')) : null;
    this.keysCache = null;
  }

  // Get default SSH directory based on platform
  getDefaultSSHDir() {
    const homeDir = os.homedir();
    return path.join(homeDir, '.ssh');
  }

  // Get machine-specific encryption key
  getMachineKey() {
    const machineId = this.getMachineId();
    const hash = crypto.createHash('sha256');
    hash.update(machineId + 'ssh-kim-machine-key');
    return hash.digest();
  }

  // Get machine identifier
  getMachineId() {
    // Try hostname first
    const hostname = os.hostname();
    if (hostname && hostname !== 'localhost') {
      return hostname;
    }
    
    // Fallback to computer name on macOS
    if (process.platform === 'darwin') {
      try {
        const { execSync } = require('child_process');
        const computerName = execSync('scutil --get ComputerName', { encoding: 'utf8' }).trim();
        if (computerName) return computerName;
      } catch (error) {
        // Fallback to hostname
      }
    }
    
    return 'unknown-machine';
  }

  // Derive encryption key from password
  deriveKeyFromPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password + 'ssh-kim-password-salt');
    return hash.digest();
  }

  // Get encryption key (password-based if set, otherwise machine-specific)
  getEncryptionKey() {
    return this.passwordKey || this.machineKey;
  }

  // Get the path to the encrypted SSH keys file
  getKeysFilePath() {
    const customPath = this.config.get('keysFilePath');
    if (customPath) {
      return customPath;
    }
    
    // Default to app data directory
    const appDataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirpSync(appDataDir);
    }
    return path.join(appDataDir, 'ssh_keys.enc');
  }

  // Encryption/Decryption methods
  encryptData(data) {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptData(encryptedData) {
    const algorithm = 'aes-256-cbc';
    const key = this.getEncryptionKey();
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Load keys from file
  async loadKeys() {
    if (this.keysCache) {
      return this.keysCache;
    }

    const filePath = this.getKeysFilePath();
    
    if (!fs.existsSync(filePath)) {
      this.keysCache = [];
      return this.keysCache;
    }

    try {
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const decryptedData = this.decryptData(encryptedData);
      this.keysCache = JSON.parse(decryptedData);
      return this.keysCache;
    } catch (error) {
      console.error(chalk.red('Error loading keys:'), error.message);
      this.keysCache = [];
      return this.keysCache;
    }
  }

  // Save keys to file
  async saveKeys(keys) {
    const filePath = this.getKeysFilePath();
    const data = JSON.stringify(keys, null, 2);
    const encryptedData = this.encryptData(data);
    
    await fs.writeFile(filePath, encryptedData, 'utf8');
    this.keysCache = keys;
  }

  // Generate unique ID
  generateId() {
    return crypto.randomUUID();
  }

  // Detect key type from content
  detectKeyType(keyContent) {
    if (keyContent.includes('ssh-rsa')) return 'RSA';
    if (keyContent.includes('ssh-dss')) return 'DSA';
    if (keyContent.includes('ecdsa-sha2')) return 'ECDSA';
    if (keyContent.includes('ssh-ed25519')) return 'Ed25519';
    return 'Unknown';
  }

  // List all keys
  async listKeys(options = {}) {
    const spinner = ora('Loading SSH keys...').start();
    
    try {
      const keys = await this.loadKeys();
      spinner.stop();

      if (keys.length === 0) {
        console.log(chalk.yellow('No SSH keys found.'));
        console.log(chalk.blue('Use "ssh-kim add" to add your first key.'));
        return;
      }

      // Apply filters
      let filteredKeys = keys;
      
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        filteredKeys = filteredKeys.filter(key => 
          key.name.toLowerCase().includes(searchTerm) ||
          (key.tag && key.tag.toLowerCase().includes(searchTerm)) ||
          key.key_type.toLowerCase().includes(searchTerm)
        );
      }

      if (options.tag) {
        filteredKeys = filteredKeys.filter(key => 
          key.tag && key.tag.toLowerCase() === options.tag.toLowerCase()
        );
      }

      if (options.type) {
        filteredKeys = filteredKeys.filter(key => 
          key.key_type.toLowerCase() === options.type.toLowerCase()
        );
      }

      if (filteredKeys.length === 0) {
        console.log(chalk.yellow('No keys match the specified criteria.'));
        return;
      }

      // Display keys in table format
      console.log(chalk.bold.blue(`\nSSH Keys (${filteredKeys.length} found):\n`));
      
      filteredKeys.forEach((key, index) => {
        const tagDisplay = key.tag ? chalk.cyan(`[${key.tag}]`) : '';
        const dateDisplay = new Date(key.last_modified).toLocaleDateString();
        
        console.log(chalk.bold(`${index + 1}. ${key.name}`) + ` ${tagDisplay}`);
        console.log(`   ID: ${chalk.gray(key.id)}`);
        console.log(`   Type: ${chalk.green(key.key_type)}`);
        console.log(`   Modified: ${chalk.gray(dateDisplay)}`);
        console.log(`   Key: ${chalk.gray(key.key.substring(0, 50))}...`);
        console.log('');
      });

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error listing keys:'), error.message);
    }
  }

  // Add a new key
  async addKey(options = {}) {
    try {
      let name = options.name;
      let tag = options.tag;
      let keyContent = options.content;
      let sourcePath = '';

      // Interactive mode if not all options provided
      if (!name || !keyContent) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter key name:',
            default: name,
            validate: (input) => input.trim() ? true : 'Name is required'
          },
          {
            type: 'input',
            name: 'tag',
            message: 'Enter key tag (optional):',
            default: tag
          },
          {
            type: 'list',
            name: 'source',
            message: 'How would you like to add the key?',
            choices: [
              { name: 'Enter key content manually', value: 'manual' },
              { name: 'Read from file', value: 'file' },
              { name: 'Scan common locations', value: 'scan' }
            ]
          }
        ]);

        name = answers.name;
        tag = answers.tag || null;

        if (answers.source === 'manual') {
          const contentAnswer = await inquirer.prompt([
            {
              type: 'editor',
              name: 'content',
              message: 'Enter SSH key content:',
              validate: (input) => input.trim() ? true : 'Key content is required'
            }
          ]);
          keyContent = contentAnswer.content.trim();
        } else if (answers.source === 'file') {
          const fileAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'filePath',
              message: 'Enter path to SSH key file:',
              validate: (input) => {
                try {
                  return fs.existsSync(input) ? true : 'File does not exist';
                } catch {
                  return 'Invalid file path';
                }
              }
            }
          ]);
          
          sourcePath = fileAnswer.filePath;
          keyContent = await fs.readFile(fileAnswer.filePath, 'utf8');
        } else if (answers.source === 'scan') {
          const scannedKeys = await this.scanCommonLocations();
          if (scannedKeys.length === 0) {
            console.log(chalk.yellow('No SSH keys found in common locations.'));
            return;
          }

          const keyChoices = scannedKeys.map(key => ({
            name: `${key.name} (${key.path})`,
            value: key
          }));

          const selectedKey = await inquirer.prompt([
            {
              type: 'list',
              name: 'key',
              message: 'Select a key to add:',
              choices: keyChoices
            }
          ]);

          keyContent = selectedKey.key.content;
          sourcePath = selectedKey.key.path;
        }
      }

      // Validate key content
      if (!keyContent || !keyContent.trim()) {
        throw new Error('Key content is required');
      }

      const keyType = this.detectKeyType(keyContent);
      const now = new Date().toISOString();

      const newKey = {
        id: this.generateId(),
        name: name.trim(),
        tag: tag ? tag.trim() : null,
        key: keyContent.trim(),
        key_type: keyType,
        created: now,
        last_modified: now
      };

      const keys = await this.loadKeys();
      keys.push(newKey);
      await this.saveKeys(keys);

      console.log(chalk.green(`✓ SSH key "${name}" added successfully!`));
      console.log(chalk.gray(`ID: ${newKey.id}`));
      console.log(chalk.gray(`Type: ${keyType}`));

    } catch (error) {
      console.error(chalk.red('Error adding key:'), error.message);
    }
  }

  // Edit a key
  async editKey(id, options = {}) {
    try {
      const keys = await this.loadKeys();
      const keyIndex = keys.findIndex(k => k.id === id);
      
      if (keyIndex === -1) {
        console.error(chalk.red(`Key with ID "${id}" not found.`));
        return;
      }

      const key = keys[keyIndex];
      let updates = {};

      // Interactive mode if not all options provided
      if (!options.name && !options.tag && !options.content) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter new key name:',
            default: key.name
          },
          {
            type: 'input',
            name: 'tag',
            message: 'Enter new key tag:',
            default: key.tag || ''
          },
          {
            type: 'confirm',
            name: 'updateContent',
            message: 'Do you want to update the key content?',
            default: false
          }
        ]);

        updates.name = answers.name.trim();
        updates.tag = answers.tag.trim() || null;

        if (answers.updateContent) {
          const contentAnswer = await inquirer.prompt([
            {
              type: 'editor',
              name: 'content',
              message: 'Enter new SSH key content:',
              default: key.key
            }
          ]);
          updates.key = contentAnswer.content.trim();
        }
      } else {
        if (options.name) updates.name = options.name;
        if (options.tag !== undefined) updates.tag = options.tag || null;
        if (options.content) updates.key = options.content;
      }

      // Apply updates
      Object.assign(keys[keyIndex], updates, {
        last_modified: new Date().toISOString()
      });

      await this.saveKeys(keys);
      console.log(chalk.green(`✓ SSH key "${keys[keyIndex].name}" updated successfully!`));

    } catch (error) {
      console.error(chalk.red('Error updating key:'), error.message);
    }
  }

  // Delete a key
  async deleteKey(id, options = {}) {
    try {
      const keys = await this.loadKeys();
      const keyIndex = keys.findIndex(k => k.id === id);
      
      if (keyIndex === -1) {
        console.error(chalk.red(`Key with ID "${id}" not found.`));
        return;
      }

      const key = keys[keyIndex];

      // Confirmation
      if (!options.force) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete "${key.name}"?`,
            default: false
          }
        ]);

        if (!answer.confirm) {
          console.log(chalk.yellow('Deletion cancelled.'));
          return;
        }
      }

      keys.splice(keyIndex, 1);
      await this.saveKeys(keys);
      console.log(chalk.green(`✓ SSH key "${key.name}" deleted successfully!`));

    } catch (error) {
      console.error(chalk.red('Error deleting key:'), error.message);
    }
  }

  // Copy key to clipboard
  async copyKey(id) {
    try {
      const keys = await this.loadKeys();
      const key = keys.find(k => k.id === id);
      
      if (!key) {
        console.error(chalk.red(`Key with ID "${id}" not found.`));
        return;
      }

      await clipboardy.write(key.key);
      console.log(chalk.green(`✓ SSH key "${key.name}" copied to clipboard!`));

    } catch (error) {
      console.error(chalk.red('Error copying key:'), error.message);
    }
  }

  // Scan common SSH locations
  async scanKeys(options = {}) {
    const spinner = ora('Scanning for SSH keys...').start();
    
    try {
      const locations = this.getCommonSSHLocations();
      const foundKeys = [];

      for (const location of locations) {
        if (fs.existsSync(location)) {
          const files = await fs.readdir(location);
          for (const file of files) {
            if (file.endsWith('.pub')) {
              const filePath = path.join(location, file);
              try {
                const content = await fs.readFile(filePath, 'utf8');
                const keyType = this.detectKeyType(content);
                
                foundKeys.push({
                  name: file,
                  path: filePath,
                  content: content.trim(),
                  type: keyType
                });
              } catch (error) {
                // Skip files that can't be read
              }
            }
          }
        }
      }

      spinner.stop();

      if (foundKeys.length === 0) {
        console.log(chalk.yellow('No SSH keys found in common locations.'));
        return;
      }

      console.log(chalk.bold.blue(`\nFound ${foundKeys.length} SSH keys:\n`));
      
      foundKeys.forEach((key, index) => {
        console.log(chalk.bold(`${index + 1}. ${key.name}`));
        console.log(`   Path: ${chalk.gray(key.path)}`);
        console.log(`   Type: ${chalk.green(key.type)}`);
        console.log(`   Key: ${chalk.gray(key.content.substring(0, 50))}...`);
        console.log('');
      });

    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error scanning keys:'), error.message);
    }
  }

  // Get common SSH locations
  getCommonSSHLocations() {
    const homeDir = os.homedir();
    const locations = [
      path.join(homeDir, '.ssh'),
      path.join(homeDir, 'ssh'),
      path.join(homeDir, 'Documents', 'ssh')
    ];

    // Add Windows-specific locations
    if (process.platform === 'win32') {
      locations.push(
        path.join(process.env.APPDATA, 'PuTTY'),
        path.join(process.env.LOCALAPPDATA, 'ssh')
      );
    }

    return locations;
  }

  // Scan common locations and return key objects
  async scanCommonLocations() {
    const locations = this.getCommonSSHLocations();
    const foundKeys = [];

    for (const location of locations) {
      if (fs.existsSync(location)) {
        const files = await fs.readdir(location);
        for (const file of files) {
          if (file.endsWith('.pub')) {
            const filePath = path.join(location, file);
            try {
              const content = await fs.readFile(filePath, 'utf8');
              const keyType = this.detectKeyType(content);
              
              foundKeys.push({
                name: file,
                path: filePath,
                content: content.trim(),
                type: keyType
              });
            } catch (error) {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    return foundKeys;
  }

  // Import keys
  async importKeys(options = {}) {
    try {
      if (options.file) {
        await this.importFromFile(options.file, options.password);
      } else if (options.directory) {
        await this.importFromDirectory(options.directory);
      } else {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'importType',
            message: 'How would you like to import keys?',
            choices: [
              { name: 'Import from file', value: 'file' },
              { name: 'Import from directory', value: 'directory' },
              { name: 'Scan common locations', value: 'scan' }
            ]
          }
        ]);

        if (answer.importType === 'file') {
          const fileAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'filePath',
              message: 'Enter path to SSH key file:',
              validate: (input) => {
                try {
                  return fs.existsSync(input) ? true : 'File does not exist';
                } catch {
                  return 'Invalid file path';
                }
              }
            }
          ]);
          await this.importFromFile(fileAnswer.filePath);
        } else if (answer.importType === 'directory') {
          const dirAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'dirPath',
              message: 'Enter directory path:',
              validate: (input) => {
                try {
                  return fs.existsSync(input) ? true : 'Directory does not exist';
                } catch {
                  return 'Invalid directory path';
                }
              }
            }
          ]);
          await this.importFromDirectory(dirAnswer.dirPath);
        } else {
          await this.importFromScan();
        }
      }
    } catch (error) {
      console.error(chalk.red('Error importing keys:'), error.message);
    }
  }

  // Import from file
  async importFromFile(filePath, password = null) {
    try {
      let content;
      if (password) {
        // Handle encrypted import
        const encryptedData = await fs.readFile(filePath, 'utf8');
        const tempKey = this.deriveKeyFromPassword(password);
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', tempKey, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        content = decrypted;
      } else {
        content = await fs.readFile(filePath, 'utf8');
      }

      const data = JSON.parse(content);
      const keys = data.keys || [data]; // Handle both array and single key
      
      const existingKeys = await this.loadKeys();
      let importedCount = 0;
      let duplicateCount = 0;

      for (const keyData of keys) {
        // Check for duplicates
        const isDuplicate = existingKeys.some(existing => 
          existing.key === keyData.key || existing.name === keyData.name
        );

        if (!isDuplicate) {
          const newKey = {
            id: this.generateId(),
            name: keyData.name,
            tag: keyData.tag || null,
            key: keyData.key,
            key_type: keyData.key_type || this.detectKeyType(keyData.key),
            created: keyData.created || new Date().toISOString(),
            last_modified: new Date().toISOString()
          };
          existingKeys.push(newKey);
          importedCount++;
        } else {
          duplicateCount++;
        }
      }

      await this.saveKeys(existingKeys);
      console.log(chalk.green(`✓ Imported ${importedCount} keys successfully!`));
      if (duplicateCount > 0) {
        console.log(chalk.yellow(`Skipped ${duplicateCount} duplicate keys.`));
      }

    } catch (error) {
      console.error(chalk.red('Error importing from file:'), error.message);
    }
  }

  // Import from directory
  async importFromDirectory(dirPath) {
    const files = await fs.readdir(dirPath);
    const pubFiles = files.filter(file => file.endsWith('.pub'));
    
    if (pubFiles.length === 0) {
      console.log(chalk.yellow('No SSH public key files found in directory.'));
      return;
    }

    const keys = await this.loadKeys();
    let importedCount = 0;

    for (const file of pubFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const keyType = this.detectKeyType(content);
        
        const newKey = {
          id: this.generateId(),
          name: file,
          tag: null,
          key: content.trim(),
          key_type: keyType,
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        };

        keys.push(newKey);
        importedCount++;
      } catch (error) {
        console.log(chalk.yellow(`Skipped ${file}: ${error.message}`));
      }
    }

    await this.saveKeys(keys);
    console.log(chalk.green(`✓ Imported ${importedCount} keys successfully!`));
  }

  // Import from scan
  async importFromScan() {
    const scannedKeys = await this.scanCommonLocations();
    
    if (scannedKeys.length === 0) {
      console.log(chalk.yellow('No SSH keys found in common locations.'));
      return;
    }

    const keyChoices = scannedKeys.map(key => ({
      name: `${key.name} (${key.path})`,
      value: key,
      checked: true
    }));

    const selectedKeys = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'keys',
        message: 'Select keys to import:',
        choices: keyChoices
      }
    ]);

    if (selectedKeys.keys.length === 0) {
      console.log(chalk.yellow('No keys selected for import.'));
      return;
    }

    const keys = await this.loadKeys();
    let importedCount = 0;

    for (const selectedKey of selectedKeys.keys) {
      const newKey = {
        id: this.generateId(),
        name: selectedKey.name,
        tag: null,
        key: selectedKey.content,
        key_type: selectedKey.type,
        created: new Date().toISOString(),
        last_modified: new Date().toISOString()
      };

      keys.push(newKey);
      importedCount++;
    }

    await this.saveKeys(keys);
    console.log(chalk.green(`✓ Imported ${importedCount} keys successfully!`));
  }

  // Export keys
  async exportKeys(options = {}) {
    try {
      const keys = await this.loadKeys();
      
      if (keys.length === 0) {
        console.log(chalk.yellow('No keys to export.'));
        return;
      }

      let keysToExport = keys;

      if (options.id) {
        const key = keys.find(k => k.id === options.id);
        if (!key) {
          console.error(chalk.red(`Key with ID "${options.id}" not found.`));
          return;
        }
        keysToExport = [key];
      }

      let outputPath = options.file;
      
      if (!outputPath) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'filePath',
            message: 'Enter output file path:',
            default: `ssh_keys_export_${new Date().toISOString().split('T')[0]}.json`
          }
        ]);
        outputPath = answer.filePath;
      }

      const exportData = {
        exported_at: new Date().toISOString(),
        total_keys: keysToExport.length,
        keys: keysToExport
      };

      if (options.password) {
        // Encrypted export
        const data = JSON.stringify(exportData, null, 2);
        const tempKey = this.deriveKeyFromPassword(options.password);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', tempKey, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const encryptedData = iv.toString('hex') + ':' + encrypted;
        await fs.writeFile(outputPath, encryptedData);
        console.log(chalk.green(`✓ Exported ${keysToExport.length} keys to "${outputPath}" (encrypted)`));
      } else {
        // Plain export
        await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
        console.log(chalk.green(`✓ Exported ${keysToExport.length} keys to "${outputPath}"`));
      }

    } catch (error) {
      console.error(chalk.red('Error exporting keys:'), error.message);
    }
  }

  // Show key details
  async showKey(id) {
    try {
      const keys = await this.loadKeys();
      const key = keys.find(k => k.id === id);
      
      if (!key) {
        console.error(chalk.red(`Key with ID "${id}" not found.`));
        return;
      }

      console.log(chalk.bold.blue(`\nSSH Key Details:\n`));
      console.log(chalk.bold(`Name: ${key.name}`));
      console.log(chalk.gray(`ID: ${key.id}`));
      if (key.tag) {
        console.log(chalk.cyan(`Tag: ${key.tag}`));
      }
      console.log(chalk.green(`Type: ${key.key_type}`));
      console.log(chalk.gray(`Created: ${new Date(key.created).toLocaleString()}`));
      console.log(chalk.gray(`Modified: ${new Date(key.last_modified).toLocaleString()}`));
      console.log(chalk.bold(`\nKey Content:`));
      console.log(chalk.gray(key.key));

    } catch (error) {
      console.error(chalk.red('Error showing key:'), error.message);
    }
  }

  // Manage configuration
  async manageConfig(options = {}) {
    try {
      if (options.show) {
        console.log(chalk.bold.blue(`\nCurrent Configuration:\n`));
        console.log(`Keys File Path: ${chalk.gray(this.getKeysFilePath())}`);
        console.log(`Default SSH Dir: ${chalk.gray(this.config.get('defaultSSHDir'))}`);
        console.log(`Custom Path Set: ${chalk.gray(this.config.get('keysFilePath') ? 'Yes' : 'No')}`);
        console.log(`Encryption Mode: ${chalk.gray(this.passwordKey ? 'Password-based' : 'Machine-specific')}`);
      } else if (options.path) {
        this.config.set('keysFilePath', options.path);
        console.log(chalk.green(`✓ Custom keys file path set to: ${options.path}`));
      } else if (options.reset) {
        this.config.delete('keysFilePath');
        this.config.delete('encryptionPassword');
        this.passwordKey = null;
        console.log(chalk.green(`✓ Configuration reset to defaults.`));
      } else if (options.setPassword) {
        this.config.set('encryptionPassword', options.setPassword);
        this.passwordKey = this.deriveKeyFromPassword(options.setPassword);
        console.log(chalk.green(`✓ Encryption password set successfully.`));
      } else if (options.clearPassword) {
        this.config.delete('encryptionPassword');
        this.passwordKey = null;
        console.log(chalk.green(`✓ Encryption password cleared. Using machine-specific encryption.`));
      } else {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: 'Show current configuration', value: 'show' },
              { name: 'Set custom keys file path', value: 'path' },
              { name: 'Set encryption password', value: 'setPassword' },
              { name: 'Clear encryption password', value: 'clearPassword' },
              { name: 'Reset to defaults', value: 'reset' }
            ]
          }
        ]);

        if (answer.action === 'show') {
          await this.manageConfig({ show: true });
        } else if (answer.action === 'path') {
          const pathAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'filePath',
              message: 'Enter custom keys file path:',
              default: this.getKeysFilePath()
            }
          ]);
          await this.manageConfig({ path: pathAnswer.filePath });
        } else if (answer.action === 'setPassword') {
          const passwordAnswer = await inquirer.prompt([
            {
              type: 'password',
              name: 'password',
              message: 'Enter encryption password:',
              validate: (input) => input.length >= 6 ? true : 'Password must be at least 6 characters'
            }
          ]);
          await this.manageConfig({ setPassword: passwordAnswer.password });
        } else if (answer.action === 'clearPassword') {
          await this.manageConfig({ clearPassword: true });
        } else if (answer.action === 'reset') {
          await this.manageConfig({ reset: true });
        }
      }
    } catch (error) {
      console.error(chalk.red('Error managing configuration:'), error.message);
    }
  }

  // Interactive mode
  async interactiveMode() {
    console.log(chalk.bold.blue('SSH Key Manager - Interactive Mode\n'));
    
    while (true) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'List all keys', value: 'list' },
            { name: 'Add new key', value: 'add' },
            { name: 'Edit key', value: 'edit' },
            { name: 'Delete key', value: 'delete' },
            { name: 'Copy key to clipboard', value: 'copy' },
            { name: 'Scan for keys', value: 'scan' },
            { name: 'Import keys', value: 'import' },
            { name: 'Export keys', value: 'export' },
            { name: 'Show key details', value: 'show' },
            { name: 'Configuration', value: 'config' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      try {
        switch (answer.action) {
          case 'list':
            await this.listKeys();
            break;
          case 'add':
            await this.addKey();
            break;
          case 'edit':
            const keys = await this.loadKeys();
            if (keys.length === 0) {
              console.log(chalk.yellow('No keys to edit.'));
              break;
            }
            const editChoices = keys.map(key => ({
              name: `${key.name} (${key.id})`,
              value: key.id
            }));
            const editAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'keyId',
                message: 'Select key to edit:',
                choices: editChoices
              }
            ]);
            await this.editKey(editAnswer.keyId);
            break;
          case 'delete':
            const deleteKeys = await this.loadKeys();
            if (deleteKeys.length === 0) {
              console.log(chalk.yellow('No keys to delete.'));
              break;
            }
            const deleteChoices = deleteKeys.map(key => ({
              name: `${key.name} (${key.id})`,
              value: key.id
            }));
            const deleteAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'keyId',
                message: 'Select key to delete:',
                choices: deleteChoices
              }
            ]);
            await this.deleteKey(deleteAnswer.keyId);
            break;
          case 'copy':
            const copyKeys = await this.loadKeys();
            if (copyKeys.length === 0) {
              console.log(chalk.yellow('No keys to copy.'));
              break;
            }
            const copyChoices = copyKeys.map(key => ({
              name: `${key.name} (${key.id})`,
              value: key.id
            }));
            const copyAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'keyId',
                message: 'Select key to copy:',
                choices: copyChoices
              }
            ]);
            await this.copyKey(copyAnswer.keyId);
            break;
          case 'scan':
            await this.scanKeys();
            break;
          case 'import':
            await this.importKeys();
            break;
          case 'export':
            await this.exportKeys();
            break;
          case 'show':
            const showKeys = await this.loadKeys();
            if (showKeys.length === 0) {
              console.log(chalk.yellow('No keys to show.'));
              break;
            }
            const showChoices = showKeys.map(key => ({
              name: `${key.name} (${key.id})`,
              value: key.id
            }));
            const showAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'keyId',
                message: 'Select key to show:',
                choices: showChoices
              }
            ]);
            await this.showKey(showAnswer.keyId);
            break;
          case 'config':
            await this.manageConfig();
            break;
          case 'exit':
            console.log(chalk.blue('Goodbye!'));
            return;
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
      }

      console.log(''); // Add spacing
    }
  }
} 