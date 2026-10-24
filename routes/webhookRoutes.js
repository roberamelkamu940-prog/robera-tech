const express = require('express');
const router = express.Router();
const { settleVerifiedPayment } = require('../database/services/paymentServices');

router.post('/chapa', async (req, res) => {
    try {
        const txRef = String(req.body?.tx_ref || '').trim();
        const isPaymentEvent = req.body?.status === 'success' || req.body?.event === 'charge.success';
        if (!txRef || !isPaymentEvent) {
            return res.status(400).send('Invalid payment notification');
        }

        await settleVerifiedPayment(txRef);
        return res.status(200).send('Payment notification processed');
    } catch (error) {
        console.error('Payment webhook processing failed:', error.message);
        return res.status(500).send('Server Processing Error');
    }
});

module.exports = router;