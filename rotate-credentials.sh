#!/bin/bash

echo "🔄 Rotating Credential Encryption"
echo "================================="
echo ""
echo "This will re-encrypt all credentials with a new master password"
echo ""

npx ts-node -e "
import { credentialManager } from './src/services/security/CredentialManager';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function rotate() {
  try {
    console.log('Enter current master password:');
    const currentPassword = await new Promise(resolve => {
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', char => {
        const charCode = char.toString().charCodeAt(0);
        if (charCode === 13) {
          process.stdin.setRawMode(false);
          console.log();
          resolve(password);
        } else if (charCode === 3) {
          process.exit();
        } else {
          password += char.toString();
          process.stdout.write('*');
        }
      });
    });

    await credentialManager.initialize(currentPassword);
    
    console.log('Enter new master password:');
    const newPassword = await new Promise(resolve => {
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', char => {
        const charCode = char.toString().charCodeAt(0);
        if (charCode === 13) {
          process.stdin.setRawMode(false);
          console.log();
          resolve(password);
        } else if (charCode === 3) {
          process.exit();
        } else {
          password += char.toString();
          process.stdout.write('*');
        }
      });
    });

    await credentialManager.rotateKeys(newPassword);
    console.log('✅ Credentials re-encrypted with new password');
    
  } catch (error) {
    console.error('❌ Rotation failed:', error.message);
  }
  
  rl.close();
}

rotate();
"
