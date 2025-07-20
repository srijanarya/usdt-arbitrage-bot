// Binance P2P Form Filler
(function() {
    console.log('Starting Binance P2P form automation...');
    
    // Configuration
    const config = {
        price: '94.75',
        amount: '11.54',
        minLimit: '500',
        maxLimit: '11000',
        paymentMethod: 'UPI',
        timeLimit: '15'
    };
    
    // Helper function to wait for element
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(checkInterval);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`Element ${selector} not found`));
                }
            }, 100);
        });
    }
    
    // Helper to set input value
    function setInputValue(input, value) {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
    }
    
    async function fillForm() {
        try {
            // Step 1: Click "I want to sell" if needed
            const sellOption = await waitForElement('[data-type="Sell"], input[value="SELL"], label:contains("Sell")').catch(() => null);
            if (sellOption) {
                sellOption.click();
                await new Promise(r => setTimeout(r, 500));
            }
            
            // Step 2: Set price
            const priceInput = await waitForElement('input[name="price"], input[placeholder*="price" i], input[id*="price" i]');
            setInputValue(priceInput, config.price);
            console.log('✓ Price set to:', config.price);
            
            // Step 3: Set amount
            const amountInput = await waitForElement('input[name="amount"], input[placeholder*="amount" i], input[id*="amount" i]');
            setInputValue(amountInput, config.amount);
            console.log('✓ Amount set to:', config.amount);
            
            // Step 4: Set order limits
            const minInput = await waitForElement('input[name*="min" i], input[placeholder*="min" i]');
            setInputValue(minInput, config.minLimit);
            console.log('✓ Min limit set to:', config.minLimit);
            
            const maxInput = await waitForElement('input[name*="max" i], input[placeholder*="max" i]');
            setInputValue(maxInput, config.maxLimit);
            console.log('✓ Max limit set to:', config.maxLimit);
            
            // Step 5: Select payment method (UPI)
            const upiCheckbox = await waitForElement('input[type="checkbox"][value="UPI"], label:contains("UPI")').catch(() => null);
            if (upiCheckbox && !upiCheckbox.checked) {
                upiCheckbox.click();
                console.log('✓ UPI payment selected');
            }
            
            // Step 6: Set time limit
            const timeSelect = await waitForElement('select[name*="time"], input[name*="time"]').catch(() => null);
            if (timeSelect) {
                if (timeSelect.tagName === 'SELECT') {
                    timeSelect.value = config.timeLimit;
                } else {
                    setInputValue(timeSelect, config.timeLimit);
                }
                console.log('✓ Time limit set to:', config.timeLimit);
            }
            
            console.log('\n✅ Form filled successfully!');
            console.log('📋 Summary:');
            console.log(`   Price: ₹${config.price}`);
            console.log(`   Amount: ${config.amount} USDT`);
            console.log(`   Total: ₹${(parseFloat(config.price) * parseFloat(config.amount)).toFixed(2)}`);
            console.log(`   Limits: ₹${config.minLimit} - ₹${config.maxLimit}`);
            console.log('\n⚠️  Please review and click "Post" to create your ad.');
            
        } catch (error) {
            console.error('Error filling form:', error.message);
            console.log('\n💡 Manual steps needed:');
            console.log(`1. Set price to: ₹${config.price}`);
            console.log(`2. Set amount to: ${config.amount} USDT`);
            console.log(`3. Set limits: ₹${config.minLimit} - ₹${config.maxLimit}`);
            console.log('4. Select UPI payment method');
            console.log('5. Set time limit to 15 minutes');
        }
    }
    
    // Run the automation
    fillForm();
    
    // Return config for verification
    return config;
})();