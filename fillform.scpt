tell application "Google Chrome"
    activate
    
    -- Step 1: Select "I want to sell"
    execute front window's active tab javascript "document.querySelectorAll('label').forEach(el => { if(el.textContent.includes('I want to sell')) el.click(); }); 'Sell selected'"
    delay 1
    
    -- Step 2: Fill price
    execute front window's active tab javascript "var p = document.querySelector('input[name=\"price\"]'); if(p) { p.focus(); p.value = '94.75'; p.dispatchEvent(new Event('input', {bubbles: true})); } 'Price filled'"
    delay 0.5
    
    -- Step 3: Fill amount
    execute front window's active tab javascript "var a = document.querySelector('input[name=\"amount\"]'); if(a) { a.focus(); a.value = '11.54'; a.dispatchEvent(new Event('input', {bubbles: true})); } 'Amount filled'"
    delay 0.5
    
    -- Step 4: Fill min order
    execute front window's active tab javascript "var inputs = document.querySelectorAll('input'); var minInput = Array.from(inputs).find(i => i.placeholder && i.placeholder.toLowerCase().includes('min')); if(minInput) { minInput.focus(); minInput.value = '500'; minInput.dispatchEvent(new Event('input', {bubbles: true})); } 'Min filled'"
    delay 0.5
    
    -- Step 5: Fill max order
    execute front window's active tab javascript "var inputs = document.querySelectorAll('input'); var maxInput = Array.from(inputs).find(i => i.placeholder && i.placeholder.toLowerCase().includes('max')); if(maxInput) { maxInput.focus(); maxInput.value = '11000'; maxInput.dispatchEvent(new Event('input', {bubbles: true})); } 'Max filled'"
    delay 0.5
    
    -- Step 6: Select UPI
    execute front window's active tab javascript "document.querySelectorAll('label').forEach(el => { if(el.textContent === 'UPI') el.click(); }); 'UPI selected'"
    
    display notification "Form filled! Review and click Post" with title "P2P Order Ready"
end tell