#!/usr/bin/env node

/**
 * Gmail App Password Verification Test
 *
 * This script tests if the exposed Gmail app password is still active.
 *
 * Expected Results:
 * - If password is REVOKED (good): Will fail with authentication error
 * - If password is ACTIVE (bad): Will connect successfully
 */

const Imap = require('imap');

console.log('🔍 Testing if Gmail app password is still active...\n');

const testPassword = 'dxot kzcf szve mipy';
const testEmail = 'srijanaryay@gmail.com';

console.log(`Email: ${testEmail}`);
console.log(`Password: ${testPassword.substring(0, 4)} ${testPassword.substring(5, 9)} (hidden)\n`);

const imap = new Imap({
  user: testEmail,
  password: testPassword,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 10000,
  authTimeout: 10000
});

let testComplete = false;

// Set timeout to prevent hanging
const timeout = setTimeout(() => {
  if (!testComplete) {
    console.log('❌ Connection timeout - Unable to determine password status');
    console.log('This could mean network issues or Gmail is blocking the connection.');
    process.exit(1);
  }
}, 15000);

imap.once('ready', () => {
  testComplete = true;
  clearTimeout(timeout);
  console.log('🚨 WARNING: PASSWORD IS STILL ACTIVE! 🚨\n');
  console.log('❌ The Gmail app password has NOT been revoked!');
  console.log('❌ Your Gmail account is still accessible with this password!\n');
  console.log('IMMEDIATE ACTION REQUIRED:');
  console.log('1. Go to: https://myaccount.google.com/apppasswords');
  console.log('2. Delete ALL app passwords');
  console.log('3. Check device activity: https://myaccount.google.com/device-activity\n');

  imap.end();
  process.exit(1);
});

imap.once('error', (err) => {
  testComplete = true;
  clearTimeout(timeout);

  const errorMsg = err.toString().toLowerCase();

  if (errorMsg.includes('auth') || errorMsg.includes('invalid credentials') || errorMsg.includes('authentication failed')) {
    console.log('✅ GOOD NEWS: Password has been revoked!\n');
    console.log('✅ Authentication failed - the app password is no longer active');
    console.log('✅ Your Gmail account is secure from this exposure\n');
    console.log('You can safely proceed with creating the fresh repository.');
    process.exit(0);
  } else if (errorMsg.includes('enotfound') || errorMsg.includes('getaddrinfo') || errorMsg.includes('network')) {
    console.log('⚠️  Network/DNS error - Cannot reach Gmail servers\n');
    console.log('Error:', err.message);
    console.log('\nThis doesn\'t confirm if password is active or not.');
    console.log('Please check manually at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  } else {
    console.log('⚠️  Unexpected error:\n');
    console.log(err.message);
    console.log('\nCannot confirm password status.');
    console.log('Please check manually at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }
});

imap.once('end', () => {
  if (!testComplete) {
    testComplete = true;
    clearTimeout(timeout);
    console.log('Connection ended');
  }
});

console.log('Attempting to connect to Gmail IMAP...\n');

try {
  imap.connect();
} catch (err) {
  testComplete = true;
  clearTimeout(timeout);
  console.log('❌ Failed to initiate connection:', err.message);
  process.exit(1);
}
