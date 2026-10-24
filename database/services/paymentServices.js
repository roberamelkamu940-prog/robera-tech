const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in Node 18+

const CHAPA_API_URL = 'https://api.chapa.global/v2/payments/hosted';

async function initializeChapaPayment({ email, first_name, last_name, amount, currency, tx_ref, callback_url, return_url, title, description }) {
    try {
        const response = await fetch(CHAPA_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`,
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
        return data;
    } catch (error) {
        console.error('Chapa Initialization Error:', error);
        throw error;
    }
}

async function verifyChapaPayment(tx_ref) {
    try {
        const response = await fetch(`https://api.chapa.global/v2/payments/${tx_ref}/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CHAPA_SECRET_KEY}`
            }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Chapa Verification Error:', error);
        throw error;
    }
}

module.exports = {
    initializeChapaPayment,
    verifyChapaPayment
};