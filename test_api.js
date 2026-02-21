import pool from './src/config/db.js';
import app from './src/app.js';
import { v4 as uuidv4 } from 'uuid';

const PORT = 3001;
let server;

async function runTests() {
    try {
        console.log('1. Starting API server for testing...');
        server = app.listen(PORT);

        console.log('2. Fetching Demo User ID from database...');
        const res = await pool.query("SELECT id FROM accounts WHERE name = 'User_Wallet_001'");
        const userId = res.rows[0].id;
        console.log(`Demo User ID: ${userId}`);

        const baseUrl = `http://localhost:${PORT}/wallet`;

        console.log('\n--- Test 1: Idempotent Top-up ---');
        const idempotencyKey1 = uuidv4();

        console.log('Sending first Top-up request...');
        const res1 = await fetch(`${baseUrl}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey1 },
            body: JSON.stringify({ userId, amount: 500 })
        });
        const data1 = await res1.json();
        console.log('Response 1:', res1.status, data1);

        console.log('Sending duplicate Top-up request (simulating network retry)...');
        const res2 = await fetch(`${baseUrl}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey1 },
            body: JSON.stringify({ userId, amount: 500 }) // Should be ignored
        });
        const data2 = await res2.json();
        console.log('Response 2:', res2.status, data2);

        if (res2.status === 200 && data2.message.includes('Idempotent replay')) {
            console.log('✅ Idempotency test passed.');
        } else {
            console.error('❌ Idempotency test failed.');
        }

        console.log('\n--- Test 2: Successful Spend ---');
        const idempotencyKey2 = uuidv4();
        const res3 = await fetch(`${baseUrl}/spend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey2 },
            body: JSON.stringify({ userId, amount: 100 })
        });
        const data3 = await res3.json();
        console.log('Response 3:', res3.status, data3);

        if (res3.status === 201) {
            console.log('✅ Spend test passed.');
        } else {
            console.error('❌ Spend test failed.');
        }

        console.log('\n--- Test 3: Insufficient Funds ---');
        const idempotencyKey3 = uuidv4();
        const res4 = await fetch(`${baseUrl}/spend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey3 },
            body: JSON.stringify({ userId, amount: 99999 })
        });
        const data4 = await res4.json();
        console.log('Response 4:', res4.status, data4);

        if (res4.status === 400 && data4.error.includes('Insufficient funds')) {
            console.log('✅ Insufficient funds test passed.');
        } else {
            console.error('❌ Insufficient funds test failed.');
        }

    } catch (err) {
        console.error('Test execution error:', err);
    } finally {
        if (server) server.close();
        await pool.end();
        console.log('\nTests completed. Exiting.');
        process.exit(0);
    }
}

runTests();
