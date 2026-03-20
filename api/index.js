/**
 * DroxAI PayPal Payment Server - Vercel Serverless
 * Handles payments, webhooks, and automatic product delivery
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  baseUrl: 'https://api-m.paypal.com',
  siteUrl: process.env.SITE_URL || 'https://droxaillc.com'
};

// ============================================
// PRODUCT CATALOG
// ============================================
const PRODUCTS = {
  'review-reply-starter': {
    name: 'Review Reply Sprint - Starter',
    price: '99.00',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-starter.zip',
    licensePrefix: 'RRS'
  },
  'review-reply-business': {
    name: 'Review Reply Sprint - Business',
    price: '199.00',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-business.zip',
    licensePrefix: 'RRB'
  },
  'review-reply-enterprise': {
    name: 'Review Reply Sprint - Enterprise',
    price: '399.00',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-enterprise.zip',
    licensePrefix: 'RRE'
  },
  'toad-solo': {
    name: 'TOAD - Solo',
    price: '49.00',
    downloadUrl: 'https://droxaillc.com/downloads/toad-solo.zip',
    licensePrefix: 'TOA'
  },
  'toad-team': {
    name: 'TOAD - Team',
    price: '129.00',
    downloadUrl: 'https://droxaillc.com/downloads/toad-team.zip',
    licensePrefix: 'TOT'
  },
  'toad-enterprise': {
    name: 'TOAD - Enterprise',
    price: '299.00',
    downloadUrl: 'https://droxaillc.com/downloads/toad-enterprise.zip',
    licensePrefix: 'TOE'
  },
  'droxcli-individual': {
    name: 'DroxCLI - Individual',
    price: '29.00',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-individual.zip',
    licensePrefix: 'DXI'
  },
  'droxcli-team': {
    name: 'DroxCLI - Team',
    price: '79.00',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-team.zip',
    licensePrefix: 'DXT'
  },
  'droxcli-enterprise': {
    name: 'DroxCLI - Enterprise',
    price: '149.00',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-enterprise.zip',
    licensePrefix: 'DXE'
  },
  'proconstruct-trade': {
    name: 'ProConstruct - Trade Pro',
    price: '149.00',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-trade.zip',
    licensePrefix: 'PCT'
  },
  'proconstruct-crew': {
    name: 'ProConstruct - Crew',
    price: '299.00',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-crew.zip',
    licensePrefix: 'PCC'
  },
  'proconstruct-enterprise': {
    name: 'ProConstruct - Enterprise',
    price: '499.00',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-enterprise.zip',
    licensePrefix: 'PCE'
  },
  'autocampaigns-starter': {
    name: 'AutoCampaigns - Starter',
    price: '79.00',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-starter.zip',
    licensePrefix: 'ACS'
  },
  'autocampaigns-growth': {
    name: 'AutoCampaigns - Growth',
    price: '149.00',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-growth.zip',
    licensePrefix: 'ACG'
  },
  'autocampaigns-agency': {
    name: 'AutoCampaigns - Agency',
    price: '299.00',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-agency.zip',
    licensePrefix: 'ACA'
  }
};

// ============================================
// PAYPAL TOKEN CACHE
// ============================================
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  
  const auth = Buffer.from(`${CONFIG.clientId}:${CONFIG.clientSecret}`).toString('base64');
  const response = await axios.post(
    `${CONFIG.baseUrl}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  tokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in - 60) * 1000
  };
  
  return tokenCache.token;
}

// ============================================
// GENERATE LICENSE KEY
// ============================================
function generateLicenseKey(prefix) {
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${timestamp}`;
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DroxAI PayPal Server', platform: 'Vercel' });
});

// Create PayPal order
app.post('/api/checkout/create', async (req, res) => {
  try {
    const { productId, customerEmail, customerName } = req.body;
    const product = PRODUCTS[productId];
    
    if (!product) {
      return res.status(400).json({ error: 'Invalid product' });
    }
    
    const accessToken = await getAccessToken();
    
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: productId,
        description: product.name,
        amount: { currency_code: 'USD', value: product.price },
        custom_id: JSON.stringify({ productId, customerEmail, customerName })
      }],
      application_context: {
        return_url: `${CONFIG.siteUrl}/success`,
        cancel_url: `${CONFIG.siteUrl}/cancel`,
        brand_name: 'DroxAI',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW'
      }
    };
    
    const response = await axios.post(
      `${CONFIG.baseUrl}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Order created: ${response.data.id} for ${product.name}`);
    
    res.json({
      orderId: response.data.id,
      status: response.data.status
    });
  } catch (error) {
    console.error('Order creation failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Capture PayPal order
app.post('/api/checkout/capture/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      `${CONFIG.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const captureData = response.data;
    
    if (captureData.status === 'COMPLETED') {
      const purchaseUnit = captureData.purchase_units[0];
      const customData = JSON.parse(purchaseUnit.custom_id || '{}');
      
      const productId = customData.productId || purchaseUnit.reference_id;
      const customerEmail = customData.customerEmail;
      const customerName = customData.customerName;
      const product = PRODUCTS[productId];
      
      if (product && customerEmail) {
        const licenseKey = generateLicenseKey(product.licensePrefix);
        
        console.log(`Order completed: ${orderId}`);
        console.log(`Customer: ${customerName} (${customerEmail})`);
        console.log(`Product: ${product.name}`);
        console.log(`License: ${licenseKey}`);
        
        // Add license key to response for client-side handling
        captureData.licenseKey = licenseKey;
        captureData.downloadUrl = product.downloadUrl;
        captureData.productName = product.name;
      }
    }
    
    res.json(captureData);
  } catch (error) {
    console.error('Order capture failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});

// PayPal webhook handler
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    const event = req.body;
    console.log(`Webhook received: ${event.event_type}`);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get order status
app.get('/api/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const response = await axios.get(
      `${CONFIG.baseUrl}/v2/checkout/orders/${orderId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get order status' });
  }
});

// Export for Vercel
module.exports = app;