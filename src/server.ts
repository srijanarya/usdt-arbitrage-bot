// Simple server to test if express is working
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date() });
});

// API endpoints
app.get('/api/system-status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date()
    }
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/test`);
});