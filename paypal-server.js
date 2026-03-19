/**
 * DroxAI PayPal Payment Server
 * Handles payments, webhooks, and automatic product delivery
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // PayPal credentials (LIVE)
  clientId: 'AbYS_oR6J0qO_epWRgxDJpMGOwBCGbvZ9UaePb8FTgQmx9Dnlakd0ajMZV119iLyEx3gsjYuiTK1uP-N',
  clientSecret: 'ELJhLqZqpnQPKUl_97B1c2RPaE2xyxAiRHZK-taS4WToch1R9wk2O0hOVe7N1ObT5AosOZgygAkkIv15',
  webhookId: '532141196V6420303',
  
  // PayPal API URLs (LIVE)
  baseUrl: 'https://api-m.paypal.com',
  // For sandbox testing, use: 'https://api-m.sandbox.paypal.com'
  
  // Server
  port: 3000,
  
  // Site URL
  siteUrl: 'https://droxaillc.com',
  
  // Email configuration (configure these)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@droxaillc.com'
  }
};

// ============================================
// PRODUCT CATALOG
// ============================================
const PRODUCTS = {
  'review-reply-starter': {
    name: 'Review Reply Sprint - Starter',
    price: '99.00',
    description: 'AI-powered review response system for small businesses',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-starter.zip',
    licensePrefix: 'RRS'
  },
  'review-reply-business': {
    name: 'Review Reply Sprint - Business',
    price: '199.00',
    description: 'AI-powered review response system for agencies',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-business.zip',
    licensePrefix: 'RRB'
  },
  'review-reply-enterprise': {
    name: 'Review Reply Sprint - Enterprise',
    price: '399.00',
    description: 'AI-powered review response system for franchises',
    downloadUrl: 'https://droxaillc.com/downloads/review-reply-enterprise.zip',
    licensePrefix: 'RRE'
  },
  'toad-solo': {
    name: 'TOAD - Solo',
    price: '49.00',
    description: 'AI code generation agent for individual developers',
    downloadUrl: 'https://droxaillc.com/downloads/toad-solo.zip',
    licensePrefix: 'TOA'
  },
  'toad-team': {
    name: 'TOAD - Team',
    price: '129.00',
    description: 'AI code generation agent for teams',
    downloadUrl: 'https://droxaillc.com/downloads/toad-team.zip',
    licensePrefix: 'TOT'
  },
  'toad-enterprise': {
    name: 'TOAD - Enterprise',
    price: '299.00',
    description: 'AI code generation agent for enterprises',
    downloadUrl: 'https://droxaillc.com/downloads/toad-enterprise.zip',
    licensePrefix: 'TOE'
  },
  'droxcli-individual': {
    name: 'DroxCLI - Individual',
    price: '29.00',
    description: 'Natural language coding assistant',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-individual.zip',
    licensePrefix: 'DXI'
  },
  'droxcli-team': {
    name: 'DroxCLI - Team',
    price: '79.00',
    description: 'Natural language coding assistant for teams',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-team.zip',
    licensePrefix: 'DXT'
  },
  'droxcli-enterprise': {
    name: 'DroxCLI - Enterprise',
    price: '149.00',
    description: 'Natural language coding assistant for enterprises',
    downloadUrl: 'https://droxaillc.com/downloads/droxcli-enterprise.zip',
    licensePrefix: 'DXE'
  },
  'proconstruct-trade': {
    name: 'ProConstruct - Trade Pro',
    price: '149.00',
    description: 'AI tools for construction trades',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-trade.zip',
    licensePrefix: 'PCT'
  },
  'proconstruct-crew': {
    name: 'ProConstruct - Crew',
    price: '299.00',
    description: 'AI tools for construction businesses',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-crew.zip',
    licensePrefix: 'PCC'
  },
  'proconstruct-enterprise': {
    name: 'ProConstruct - Enterprise',
    price: '499.00',
    description: 'AI tools for multi-crew operations',
    downloadUrl: 'https://droxaillc.com/downloads/proconstruct-enterprise.zip',
    licensePrefix: 'PCE'
  },
  'autocampaigns-starter': {
    name: 'AutoCampaigns - Starter',
    price: '79.00',
    description: 'AI marketing automation',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-starter.zip',
    licensePrefix: 'ACS'
  },
  'autocampaigns-growth': {
    name: 'AutoCampaigns - Growth',
    price: '149.00',
    description: 'AI marketing automation for growing businesses',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-growth.zip',
    licensePrefix: 'ACG'
  },
  'autocampaigns-agency': {
    name: 'AutoCampaigns - Agency',
    price: '299.00',
    description: 'AI marketing automation for agencies',
    downloadUrl: 'https://droxaillc.com/downloads/autocampaigns-agency.zip',
    licensePrefix: 'ACA'
  }
};

// ============================================
// PAYPAL TOKEN CACHE
// ============================================
let tokenCache = {
  token: null,
  expiresAt: 0
};

// ============================================
// GET PAYPAL ACCESS TOKEN
// ============================================
async function getAccessToken() {
  // Return cached token if still valid
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  
  try {
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
    
    const { access_token, expires_in } = response.data;
    
    // Cache the token (subtract 60 seconds for safety)
    tokenCache = {
      token: access_token,
      expiresAt: Date.now() + (expires_in - 60) * 1000
    };
    
    console.log('✅ PayPal access token obtained');
    return access_token;
  } catch (error) {
    console.error('❌ Failed to get PayPal access token:', error.response?.data || error.message);
    throw error;
  }
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
// SEND DELIVERY EMAIL
// ============================================
async function sendDeliveryEmail(customerEmail, customerName, product, licenseKey) {
  if (!CONFIG.email.user || !CONFIG.email.pass) {
    console.log('⚠️ Email not configured - skipping email delivery');
    console.log(`📧 Would send to: ${customerEmail}`);
    console.log(`📦 Product: ${product.name}`);
    console.log(`🔑 License: ${licenseKey}`);
    console.log(`⬇️ Download: ${product.downloadUrl}`);
    return false;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: CONFIG.email.host,
      port: CONFIG.email.port,
      secure: CONFIG.email.port === 465,
      auth: {
        user: CONFIG.email.user,
        pass: CONFIG.email.pass
      }
    });
    
    const mailOptions = {
      from: CONFIG.email.from,
      to: customerEmail,
      subject: `🎉 Your ${product.name} License is Ready!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
            .license-box { background: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
            .license-key { font-family: monospace; font-size: 18px; color: #667eea; font-weight: bold; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome, ${customerName}!</h1>
              <p>Your ${product.name} license is ready</p>
            </div>
            <div class="content">
              <h2>📦 Your License Key</h2>
              <div class="license-box">
                <p>Your license key:</p>
                <p class="license-key">${licenseKey}</p>
                <p><small>Keep this key safe - you'll need it to activate your software</small></p>
              </div>
              
              <h2>⬇️ Download Your Software</h2>
              <p>Click the button below to download your software:</p>
              <p style="text-align: center;">
                <a href="${product.downloadUrl}" class="button">Download ${product.name}</a>
              </p>
              <p><small>If the button doesn't work, copy this link: ${product.downloadUrl}</small></p>
              
              <h2>🚀 Getting Started</h2>
              <ol>
                <li>Download the software using the link above</li>
                <li>Run the installer on your machine</li>
                <li>Enter your license key when prompted</li>
                <li>Start using ${product.name}!</li>
              </ol>
              
              <h2>📞 Need Help?</h2>
              <p>Our support team is here to help:</p>
              <ul>
                <li>Email: droxai25@outlook.com</li>
                <li>Response time: Usually within 24 hours</li>
              </ul>
            </div>
            <div class="footer">
              <p>&copy; 2025 DroxAI LLC. All rights reserved.</p>
              <p>Self-hosted AI software that pays for itself.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Delivery email sent to ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return false;
  }
}

// ============================================
// LOG ORDER
// ============================================
function logOrder(orderData) {
  const logFile = path.join(__dirname, 'orders.log');
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...orderData
  };
  
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  console.log(`📝 Order logged: ${orderData.orderId}`);
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DroxAI PayPal Server' });
});

// Get client token for frontend
app.get('/api/paypal/client-token', async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ clientToken: token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get client token' });
  }
});

// Create PayPal order
app.post('/api/checkout/create', async (req, res) => {
  try {
    const { productId, customerEmail, customerName } = req.body;
    
    // Validate product
    const product = PRODUCTS[productId];
    if (!product) {
      return res.status(400).json({ error: 'Invalid product' });
    }
    
    // Get access token
    const accessToken = await getAccessToken();
    
    // Create PayPal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: productId,
        description: product.name,
        amount: {
          currency_code: 'USD',
          value: product.price
        },
        custom_id: JSON.stringify({
          productId,
          customerEmail,
          customerName
        })
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
    
    console.log(`✅ Order created: ${response.data.id} for ${product.name}`);
    
    res.json({
      orderId: response.data.id,
      status: response.data.status
    });
  } catch (error) {
    console.error('❌ Order creation failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Capture PayPal order
app.post('/api/checkout/capture/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get access token
    const accessToken = await getAccessToken();
    
    // Capture the payment
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
      // Extract customer info from custom_id
      const purchaseUnit = captureData.purchase_units[0];
      const customData = JSON.parse(purchaseUnit.custom_id || '{}');
      
      const productId = customData.productId || purchaseUnit.reference_id;
      const customerEmail = customData.customerEmail;
      const customerName = customData.customerName;
      const product = PRODUCTS[productId];
      
      if (product && customerEmail) {
        // Generate license key
        const licenseKey = generateLicenseKey(product.licensePrefix);
        
        // Log the order
        logOrder({
          orderId,
          productId,
          productName: product.name,
          customerEmail,
          customerName,
          licenseKey,
          amount: product.price,
          status: 'completed'
        });
        
        // Send delivery email
        await sendDeliveryEmail(customerEmail, customerName, product, licenseKey);
        
        console.log(`🎉 Order completed and delivered: ${orderId}`);
      }
    }
    
    res.json(captureData);
  } catch (error) {
    console.error('❌ Order capture failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});

// PayPal webhook handler
app.post('/api/webhooks/paypal', async (req, res) => {
  try {
    const event = req.body;
    
    console.log(`📨 Webhook received: ${event.event_type}`);
    
    // Verify webhook signature (simplified - in production, verify properly)
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      
      if (orderId) {
        console.log(`💰 Payment captured for order: ${orderId}`);
        
        // The actual delivery is handled in the capture endpoint
        // This webhook is for logging/notifications
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
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
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get order status' });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(CONFIG.port, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║       DroxAI PayPal Payment Server             ║
║────────────────────────────────────────────────║
║  Port: ${CONFIG.port}                                    ║
║  Mode: LIVE                                    ║
║  Products: ${Object.keys(PRODUCTS).length} configured                       ║
╚════════════════════════════════════════════════╝
  `);
});