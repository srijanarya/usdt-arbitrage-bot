const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('<h1>Server is working!</h1><p>Dashboard would load here</p>');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date() });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Test server is running on http://localhost:${PORT}`);
});