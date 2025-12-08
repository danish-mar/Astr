import { hostname } from 'os';
import app from './app';
import connectDB from './config/database';

const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
