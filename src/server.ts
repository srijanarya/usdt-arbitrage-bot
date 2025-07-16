// Simple server to test if express is working
import express from 'express';
import path from 'path';
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Simple test endpoint
app.get('/test', (_req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date() });
});

// API endpoints
app.get('/api/system-status', (_req, res) => {
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