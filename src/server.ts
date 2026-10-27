import { hostname } from 'os';
import app from './app';
import connectDB from './config/database';
import aiService from './services/aiService';

const PORT = process.env.PORT || 3000;

// Connect to database & initialize AI review buffer queue
connectDB().then(() => {
  aiService.initReviewQueue();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
