# ⚡ Quick Credential Rotation Guide (10 Minutes)

## Priority Order (Do These NOW)

### 1. Telegram Bot Token (2 minutes) ⚡ HIGHEST PRIORITY
Someone could spam your users or access chat history.

**Steps:**
1. Open Telegram → Message @BotFather
2. Send: `/mybots`
3. Select your bot
4. Click "API Token" → "Revoke current token"
5. Copy new token
6. Update `.env` file: `TELEGRAM_BOT_TOKEN=new_token_here`

---

### 2. ZebPay API (3 minutes) ⚡ HIGH PRIORITY
Real trading account - someone could drain funds.

**Steps:**
1. Go to: https://zebpay.com/in/api
2. Login → API Management
3. Find the exposed key → Click "Delete"
4. Click "Generate New API Key"
5. Save Key & Secret to `.env` file

**Check:** Verify no unauthorized transactions in last 24h

---

### 3. CoinSwitch API (3 minutes) ⚡ HIGH PRIORITY
Another real trading account.

**Steps:**
1. Go to: https://coinswitch.co/api
2. Login → API Settings
3. Revoke old credentials
4. Generate new API key/secret
5. Save to `.env` file

**Check:** Review recent transactions

---

### 4. IP Address (Optional, 2 minutes) 🔶 MEDIUM PRIORITY
Could be used for targeted attacks, but low risk.

**Action:**
- Restart your router (new IP assigned)
- Or use VPN going forward
- Not critical if you have firewall

---

## After Rotation Checklist

- [ ] All 3 APIs rotated (Telegram, ZebPay, CoinSwitch)
- [ ] `.env` file updated with new credentials
- [ ] Tested that bot still works: `npm run test:telegram`
- [ ] No unauthorized transactions on exchanges
- [ ] Old credentials verified as revoked

---

## Damage Assessment

**What to check:**

```bash
# ZebPay - Check recent trades
# Login → Transaction History → Filter last 7 days

# CoinSwitch - Check recent trades
# Login → Orders → Recent Activity

# Telegram - Check message history
# Open bot → Scroll to see if any suspicious messages sent
```

**If you see suspicious activity:**
1. Change your exchange account passwords immediately
2. Enable 2FA if not already enabled
3. Contact exchange support
4. File a security report

---

## Time Estimate

- **Minimum:** 8 minutes (just the 3 critical rotations)
- **Recommended:** 15 minutes (including verification)
- **Complete:** 20 minutes (including damage check)

---

## Questions?

**"What if I can't access ZebPay/CoinSwitch right now?"**
→ Delete the API key from their website FIRST (just revoke, don't generate new)
→ Come back later to generate new credentials

**"Do I need to update code anywhere?"**
→ No! All code now reads from `.env` file

**"What about the git history?"**
→ Handle that separately with fresh repo (doesn't stop attackers, just prevents future exposure)

---

**Priority:** Do this BEFORE creating fresh repo!
**Time Required:** 10-15 minutes
**Difficulty:** Easy - just web UI clicks
