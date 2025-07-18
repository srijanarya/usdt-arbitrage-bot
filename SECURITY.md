# Security Setup Guide

## Environment Variables

**IMPORTANT**: Never commit real API keys or secrets to git!

### Setting up your environment:

1. **Copy the example file** (already exists):
   ```bash
   cp .env.example .env
   ```

2. **Add your real credentials to `.env`** (never commit this file)

3. **Verify `.env` is in `.gitignore`** (already configured)

### API Key Security Best Practices:

1. **Rotate your API keys regularly**
2. **Use read-only keys where possible**
3. **Restrict API key permissions to minimum required**
4. **Use IP whitelisting on exchanges**
5. **Enable 2FA on all exchange accounts**

### For Production:

Consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Environment variables from your hosting platform

### If Keys Are Exposed:

1. **Immediately rotate all API keys** on each exchange
2. **Check for unauthorized access** in exchange logs
3. **Update local `.env` with new keys**
4. **Never commit the updated `.env` file**

## Additional Security Measures

- Database passwords should be strong and unique
- Use separate API keys for development and production
- Monitor your exchange accounts for suspicious activity
- Set up withdrawal whitelists on exchanges
- Use separate email addresses for exchange accounts