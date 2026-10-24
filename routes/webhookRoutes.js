const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/chapa', async (req, res) => {
    // Acquire a dedicated connection from the MySQL Pool
    const connection = await db.getConnection();

    try {
        const event = req.body;
        console.log('🔔 Chapa Webhook Received:', event);

        if (event.status === 'success' || event.event === 'charge.success') {
            const tx_ref = event.tx_ref;

            // 1. Begin SQL Transaction
            await connection.beginTransaction();

            // 2. Lock & Fetch Transaction Row
            const [txRows] = await connection.query(
                'SELECT * FROM transactions WHERE tx_ref = ? FOR UPDATE', 
                [tx_ref]
            );

            if (txRows.length > 0) {
                const transaction = txRows[0];

                if (transaction.status !== 'success') {
                    // Update Transaction Status
                    await connection.query(
                        'UPDATE transactions SET status = ? WHERE tx_ref = ?', 
                        ['success', tx_ref]
                    );

                    // Insert Enrollment Record
                    await connection.query(
                        'INSERT IGNORE INTO enrollments (user_id, course_id, enrolled_at) VALUES (?, ?, NOW())',
                        [transaction.user_id, transaction.course_id]
                    );

                    console.log(`✅ Transaction committed: Student ${transaction.user_id} enrolled in ${transaction.course_id}`);
                }
            }

            // 3. Commit Transaction to Permanent Storage
            await connection.commit();
        }

        res.status(200).send('Webhook processed safely');
    } catch (error) {
        // Rollback any partial changes if an error occurs
        await connection.rollback();
        console.error('❌ TRANSACTION ROLLBACK ERROR:', error.message);
        res.status(500).send('Server Processing Error');
    } finally {
        // Release connection back to the pool
        connection.release();
    }
});

module.exports = router;