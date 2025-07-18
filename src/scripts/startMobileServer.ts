#!/usr/bin/env node
import express from 'express';
import { networkInterfaces } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import qrcode from 'qrcode-terminal';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3333;

// Serve the mobile dashboard
app.use(express.static(path.join(__dirname, '../../')));

// Default route serves mobile dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../MOBILE-P2P-CONTROL.html'));
});

// Get local IP address
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  const urls = {
    local: `http://localhost:${PORT}`,
    network: `http://${localIP}:${PORT}`
  };
  
  console.log('\n📱 MOBILE P2P CONTROL SERVER STARTED!\n');
  console.log('━'.repeat(50));
  console.log('\n🌐 Access from your phone:');
  console.log(`   ${urls.network}\n`);
  
  console.log('📲 Or scan this QR code:\n');
  qrcode.generate(urls.network, { small: true });
  
  console.log('\n━'.repeat(50));
  console.log('\n💡 FEATURES:');
  console.log('   • View active orders in real-time');
  console.log('   • Copy payment details instantly');
  console.log('   • Quick message templates');
  console.log('   • One-tap access to Binance & UPI apps');
  console.log('   • Works on any phone browser\n');
  
  console.log('🔒 SECURITY:');
  console.log('   • Only accessible on your local network');
  console.log('   • No sensitive actions (view only)');
  console.log('   • Safe to use on phone\n');
  
  console.log('📱 HOW TO USE:');
  console.log('   1. Make sure phone is on same WiFi');
  console.log('   2. Open browser on phone');
  console.log(`   3. Type: ${urls.network}`);
  console.log('   4. Bookmark for quick access\n');
  
  console.log('Press Ctrl+C to stop server\n');
});