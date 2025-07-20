# P2P Auto-Fill Bookmarklet

## Setup (One Time Only):
1. Copy the entire code below
2. In Chrome, press Cmd+D to bookmark any page
3. Click "More" → Name it "P2P Fill"
4. Replace the URL with the code below
5. Click Save

## Code to Copy:
```
javascript:(function(){const v={price:'94.73',amount:'11.54',min:'500',max:'11000'};const i=Array.from(document.querySelectorAll('input')).filter(e=>e.offsetHeight>0);if(i[0]){i[0].value=v.price;i[0].dispatchEvent(new Event('input',{bubbles:true}))}if(i[1]){i[1].value=v.amount;i[1].dispatchEvent(new Event('input',{bubbles:true}))}if(i[2]){i[2].value=v.min;i[2].dispatchEvent(new Event('input',{bubbles:true}))}if(i[3]){i[3].value=v.max;i[3].dispatchEvent(new Event('input',{bubbles:true}))}document.querySelectorAll('label').forEach(l=>{if(l.textContent.includes('UPI'))l.click()});alert('Form filled!\nPrice: '+v.price+'\nAmount: '+v.amount+'\nMin: '+v.min+'\nMax: '+v.max)})();
```

## Usage:
1. Go to Binance P2P Post Ad page
2. Click the "P2P Fill" bookmark
3. Form fills instantly!

## What it does:
- Fills Price: ₹94.73
- Fills Amount: 11.54 USDT
- Fills Min: ₹500
- Fills Max: ₹11,000
- Selects UPI payment
- Shows confirmation