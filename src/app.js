import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import walletRoutes from './routes/wallet.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Load Swagger document
const swaggerDocument = YAML.load('./swagger.yaml');

app.use(express.json());

// Main API Routes
app.use('/wallet', walletRoutes);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Root redirect to Swagger documentation
app.get('/', (req, res) => {
    res.redirect('/api-docs');
});

app.listen(PORT, () => {
    console.log(`Financial Engine API running on port ${PORT}`);
});

export default app;
