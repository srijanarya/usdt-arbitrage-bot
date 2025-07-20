// COPY AND PASTE THIS IN CHROME CONSOLE
// Press Cmd+Option+J to open Console, then paste this code

// Fill Binance P2P form by finding inputs in order
const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')).filter(i => i.offsetHeight > 0);

console.log(`Found ${inputs.length} input fields`);

if (inputs.length >= 4) {
    // First input - Price
    inputs[0].focus();
    inputs[0].value = '94.75';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    console.log('✓ Price set to 94.75');
    
    // Second input - Amount
    setTimeout(() => {
        inputs[1].focus();
        inputs[1].value = '11.54';
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✓ Amount set to 11.54');
    }, 200);
    
    // Third input - Min order
    setTimeout(() => {
        inputs[2].focus();
        inputs[2].value = '500';
        inputs[2].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[2].dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✓ Min order set to 500');
    }, 400);
    
    // Fourth input - Max order
    setTimeout(() => {
        inputs[3].focus();
        inputs[3].value = '11000';
        inputs[3].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[3].dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✓ Max order set to 11000');
    }, 600);
    
    // Find and click UPI
    setTimeout(() => {
        const labels = document.querySelectorAll('label');
        for (let label of labels) {
            if (label.textContent.includes('UPI')) {
                label.click();
                console.log('✓ UPI selected');
                break;
            }
        }
        
        console.log('\n✅ Form filled! Review and click Post button.');
        console.log('Total: ₹1,093.41 | Profit: ₹66.35 (6.5%)');
    }, 800);
} else {
    console.log('❌ Could not find enough input fields. Please fill manually:');
    console.log('Price: 94.75');
    console.log('Amount: 11.54');
    console.log('Min: 500');
    console.log('Max: 11000');
}