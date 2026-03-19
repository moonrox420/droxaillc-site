/**
 * DroxAI PayPal Client
 * Handles PayPal checkout on the landing page
 */

const PAYPAL_CONFIG = {
  clientId: 'AbYS_oR6J0qO_epWRgxDJpMGOwBCGbvZ9UaePb8FTgQmx9Dnlakd0ajMZV119iLyEx3gsjYuiTK1uP-N',
  serverUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://droxaillc.com',
  currency: 'USD'
};

// Product mapping for checkout
const PRODUCT_MAP = {
  'review-reply-starter': { id: 'review-reply-starter', name: 'Review Reply Sprint - Starter', price: '$99/mo' },
  'review-reply-business': { id: 'review-reply-business', name: 'Review Reply Sprint - Business', price: '$199/mo' },
  'review-reply-enterprise': { id: 'review-reply-enterprise', name: 'Review Reply Sprint - Enterprise', price: '$399/mo' },
  'toad-solo': { id: 'toad-solo', name: 'TOAD - Solo', price: '$49/mo' },
  'toad-team': { id: 'toad-team', name: 'TOAD - Team', price: '$129/mo' },
  'toad-enterprise': { id: 'toad-enterprise', name: 'TOAD - Enterprise', price: '$299/mo' },
  'droxcli-individual': { id: 'droxcli-individual', name: 'DroxCLI - Individual', price: '$29/mo' },
  'droxcli-team': { id: 'droxcli-team', name: 'DroxCLI - Team', price: '$79/mo' },
  'droxcli-enterprise': { id: 'droxcli-enterprise', name: 'DroxCLI - Enterprise', price: '$149/mo' },
  'proconstruct-trade': { id: 'proconstruct-trade', name: 'ProConstruct - Trade Pro', price: '$149/mo' },
  'proconstruct-crew': { id: 'proconstruct-crew', name: 'ProConstruct - Crew', price: '$299/mo' },
  'proconstruct-enterprise': { id: 'proconstruct-enterprise', name: 'ProConstruct - Enterprise', price: '$499/mo' },
  'autocampaigns-starter': { id: 'autocampaigns-starter', name: 'AutoCampaigns - Starter', price: '$79/mo' },
  'autocampaigns-growth': { id: 'autocampaigns-growth', name: 'AutoCampaigns - Growth', price: '$149/mo' },
  'autocampaigns-agency': { id: 'autocampaigns-agency', name: 'AutoCampaigns - Agency', price: '$299/mo' }
};

/**
 * Show checkout modal for a product
 */
function showCheckoutModal(productId) {
  const product = PRODUCT_MAP[productId];
  if (!product) {
    alert('Product not found');
    return;
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'checkout-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <h2 style="margin: 0; color: #2d3748;">Complete Your Purchase</h2>
        <button onclick="closeCheckoutModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #718096;">&times;</button>
      </div>
      
      <div style="background: #f7fafc; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 10px 0; color: #2d3748;">${product.name}</h3>
        <p style="margin: 0; font-size: 2rem; font-weight: 800; color: #667eea;">${product.price}</p>
      </div>
      
      <form id="checkout-form" onsubmit="handleCheckoutSubmit(event, '${productId}')">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2d3748;">Your Name</label>
          <input type="text" id="customer-name" required 
            style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
            placeholder="John Doe">
        </div>
        
        <div style="margin-bottom: 30px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2d3748;">Email Address</label>
          <input type="email" id="customer-email" required 
            style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; box-sizing: border-box;"
            placeholder="john@example.com">
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #718096;">Your license key and download link will be sent here</p>
        </div>
        
        <div id="paypal-button-container" style="margin-bottom: 20px;"></div>
        
        <p style="text-align: center; margin: 0; font-size: 12px; color: #718096;">
          🔒 Secure payment powered by PayPal
        </p>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Initialize PayPal buttons
  initializePayPalButtons(productId);
}

/**
 * Close checkout modal
 */
function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Initialize PayPal buttons
 */
async function initializePayPalButtons(productId) {
  const container = document.getElementById('paypal-button-container');
  if (!container) return;
  
  // Clear existing buttons
  container.innerHTML = '<p style="text-align: center; color: #718096;">Loading PayPal...</p>';
  
  try {
    // Load PayPal SDK dynamically
    if (!window.paypal) {
      await loadPayPalScript();
    }
    
    // Clear loading message
    container.innerHTML = '';
    
    // Create PayPal buttons
    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
      },
      
      createOrder: async function(data, actions) {
        const customerName = document.getElementById('customer-name').value;
        const customerEmail = document.getElementById('customer-email').value;
        
        if (!customerName || !customerEmail) {
          alert('Please fill in your name and email');
          return;
        }
        
        // Create order on server
        const response = await fetch(`${PAYPAL_CONFIG.serverUrl}/api/checkout/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: productId,
            customerName: customerName,
            customerEmail: customerEmail
          })
        });
        
        const order = await response.json();
        return order.orderId;
      },
      
      onApprove: async function(data, actions) {
        // Capture the order
        const response = await fetch(`${PAYPAL_CONFIG.serverUrl}/api/checkout/capture/${data.orderID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.status === 'COMPLETED') {
          // Show success message
          showSuccessMessage(productId);
        } else {
          alert('Payment processing. You will receive an email shortly.');
        }
      },
      
      onError: function(err) {
        console.error('PayPal error:', err);
        alert('Payment failed. Please try again.');
      },
      
      onCancel: function(data) {
        console.log('Payment cancelled:', data);
      }
    }).render('#paypal-button-container');
    
  } catch (error) {
    console.error('Failed to load PayPal:', error);
    container.innerHTML = `
      <p style="text-align: center; color: #e53e3e;">
        Failed to load PayPal. Please refresh the page and try again.
      </p>
    `;
  }
}

/**
 * Load PayPal SDK script
 */
function loadPayPalScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CONFIG.clientId}&currency=${PAYPAL_CONFIG.currency}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Handle checkout form submission
 */
function handleCheckoutSubmit(event, productId) {
  event.preventDefault();
  // PayPal buttons handle the actual payment
  // This is just for form validation
}

/**
 * Show success message after payment
 */
function showSuccessMessage(productId) {
  const product = PRODUCT_MAP[productId];
  const modal = document.getElementById('checkout-modal');
  
  if (modal) {
    modal.innerHTML = `
      <div style="background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; text-align: center;">
        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #48bb78, #38a169); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 30px; font-size: 40px;">✓</div>
        
        <h2 style="color: #2d3748; margin-bottom: 15px;">Payment Successful!</h2>
        <p style="color: #4a5568; font-size: 1.1rem; margin-bottom: 30px;">
          Thank you for purchasing <strong>${product.name}</strong>!
        </p>
        
        <div style="background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 10px; padding: 20px; margin-bottom: 30px; text-align: left;">
          <h3 style="color: #22543d; margin: 0 0 15px 0;">What happens next?</h3>
          <ol style="color: #276749; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Check your email for your license key</li>
            <li style="margin-bottom: 8px;">Download link will be in the email</li>
            <li style="margin-bottom: 8px;">Install and activate with your license</li>
            <li>Start using your new AI tool!</li>
          </ol>
        </div>
        
        <button onclick="closeCheckoutModal()" 
          style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 15px 40px; border-radius: 50px; font-size: 1.1rem; font-weight: 700; cursor: pointer;">
          Got it!
        </button>
      </div>
    `;
  }
}

// Make functions available globally
window.showCheckoutModal = showCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;