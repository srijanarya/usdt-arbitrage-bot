// COPY ALL OF THIS AND PASTE IN CHROME CONSOLE
// To open console: Right-click → Inspect → Console tab

// First type: allow pasting
// Then paste this code:

(async function fillP2PForm() {
    console.log('🚀 Starting P2P form fill...\n');
    
    // Get market price
    const marketPrice = 94.73; // Update this based on current market
    
    // Find all visible inputs
    const inputs = Array.from(document.querySelectorAll('input'))
        .filter(input => {
            const rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    
    console.log(`Found ${inputs.length} input fields\n`);
    
    // Helper function to set value
    function setValue(input, value, name) {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        console.log(`✓ Set ${name}: ${value}`);
    }
    
    // Fill form with delays
    console.log('Filling form...\n');
    
    // Price (first input)
    if (inputs[0]) {
        setValue(inputs[0], marketPrice.toString(), 'Price');
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Amount (second input)
    if (inputs[1]) {
        setValue(inputs[1], '11.54', 'Amount');
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Min order (third input)
    if (inputs[2]) {
        setValue(inputs[2], '500', 'Min Order');
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Max order (fourth input)
    if (inputs[3]) {
        setValue(inputs[3], '11000', 'Max Order');
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Find and click UPI
    console.log('\nLooking for UPI option...');
    const labels = document.querySelectorAll('label');
    let upiFound = false;
    
    for (const label of labels) {
        if (label.textContent && label.textContent.includes('UPI')) {
            label.click();
            console.log('✓ UPI selected');
            upiFound = true;
            break;
        }
    }
    
    if (\!upiFound) {
        // Try checkbox method
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
            const parent = cb.parentElement;
            if (parent && parent.textContent && parent.textContent.includes('UPI')) {
                cb.click();
                console.log('✓ UPI checkbox clicked');
                break;
            }
        }
    }
    
    // Calculate summary
    const total = (marketPrice * 11.54).toFixed(2);
    const profit = ((marketPrice - 89) * 11.54).toFixed(2);
    const profitPercent = ((marketPrice - 89) / 89 * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 ORDER SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Price: ₹${marketPrice}`);
    console.log(`Amount: 11.54 USDT`);
    console.log(`Total: ₹${total}`);
    console.log(`Profit: ₹${profit} (${profitPercent}%)`);
    console.log(`Min Order: ₹500`);
    console.log(`Max Order: ₹11,000`);
    console.log(`Payment: UPI`);
    console.log('='.repeat(50));
    console.log('\n✅ Form filled\! Please review and click Post button.');
    
    // Return summary for verification
    return {
        price: marketPrice,
        amount: 11.54,
        total: parseFloat(total),
        profit: parseFloat(profit),
        profitPercent: parseFloat(profitPercent)
    };
})();
EOF < /dev/null