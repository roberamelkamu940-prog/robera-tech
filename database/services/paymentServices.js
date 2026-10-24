const db = require('../../config/db');

const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';

function getSecretKey() {
    if (!process.env.CHAPA_SECRET_KEY) {
        throw new Error('CHAPA_SECRET_KEY is not configured.');
    }
    return process.env.CHAPA_SECRET_KEY;
}

async function initializeChapaPayment({ email, first_name, last_name, amount, currency, tx_ref, callback_url, return_url, title, description }) {
    try {
        const response = await fetch(CHAPA_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getSecretKey()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount,
                currency: currency || 'ETB',
                email,
                first_name,
                last_name,
                tx_ref,
                callback_url,
                return_url,
                customization: {
                    title: title || 'Robera Tech Course Enrollment',
                    description: description || 'Payment for online e-learning course access'
                }
            })
        });

        const data = await response.json();
        if (!response.ok || data.status !== 'success' || !data.data?.checkout_url) {
            throw new Error('Chapa could not initialize this payment.');
        }
        return data;
    } catch (error) {
        console.error('Chapa initialization failed:', error.message);
        throw error;
    }
}

async function verifyChapaPayment(tx_ref) {
    try {
        const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(tx_ref)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getSecretKey()}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error('Chapa could not verify this payment.');
        }
        return data;
    } catch (error) {
        console.error('Chapa verification failed:', error.message);
        throw error;
    }
}

async function settleVerifiedPayment(txRef) {
    const verification = await verifyChapaPayment(txRef);
    const verifiedPayment = verification?.data;
    if (verification?.status !== 'success' || verifiedPayment?.status !== 'success' || verifiedPayment?.tx_ref !== txRef) {
        return { success: false };
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [payments] = await connection.query(
            'SELECT id, user_id, course_id, amount, status FROM payments WHERE tx_ref = ? FOR UPDATE',
            [txRef]
        );
        if (!payments.length) {
            await connection.rollback();
            return { success: false };
        }

        const payment = payments[0];
        if (payment.status === 'success') {
            await connection.commit();
            return { success: true, courseId: payment.course_id };
        }

        if (Number(verifiedPayment.amount) !== Number(payment.amount) || verifiedPayment.currency !== 'ETB') {
            await connection.rollback();
            return { success: false };
        }

        await connection.query('UPDATE payments SET status = ? WHERE id = ?', ['success', payment.id]);
        await connection.query(
            'INSERT IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)',
            [payment.user_id, payment.course_id]
        );
        await connection.commit();
        return { success: true, courseId: payment.course_id };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    initializeChapaPayment,
    verifyChapaPayment,
    settleVerifiedPayment
};