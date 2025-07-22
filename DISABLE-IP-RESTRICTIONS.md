som# 🔓 How to Disable IP Restrictions (Temporarily)

## ⚠️ Security Note
Disabling IP restrictions makes your API keys accessible from ANY IP address. Only do this temporarily for testing, then re-enable with specific IPs.

---

## 1️⃣ Binance

1. **Login to Binance**
2. Go to **Account → API Management**
3. Find your API key (starts with `TvqQ0zq...`)
4. Click **Edit**
5. Under **IP Access Restrictions**:
   - Select: **"Unrestricted (Less Secure)"**
   - Or leave the IP field completely empty
6. Click **Save**
7. Enter 2FA code

✅ Your API will now work from any IP!

---

## 2️⃣ KuCoin

1. **Login to KuCoin**
2. Go to **API Management**
3. Find your API key
4. Click **Edit**
5. Under **IP Whitelist**:
   - Remove all IPs
   - Leave it blank
   - Or toggle off "IP Restriction"
6. Click **Confirm**
7. Enter trading password

✅ Your API will now work from any IP!

---

## 3️⃣ After Testing

Once everything works, for security:

### Option A: Re-enable with specific IPs
- Your home: `45.127.45.93`
- Oracle Cloud: `150.230.235.0`
- Your IPv6: `2402:e280:3d29:8fc:fd61:fb:3397:5a0b`

### Option B: Use only Oracle Cloud
- Whitelist only: `150.230.235.0`
- Run all bots from Oracle Cloud
- Access via SSH tunnel

---

## 🧪 Test Command

After disabling restrictions, run:

```bash
node quick-balance-check.js
```

You should see:
```
✅ Binance Connected!
   Free USDT: XXX
✅ KuCoin Connected!
   Free USDT: XXX
```
