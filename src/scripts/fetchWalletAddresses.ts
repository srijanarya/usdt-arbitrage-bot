import { config } from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

config();

interface WalletAddress {
    exchange: string;
    currency: string;
    address: string;
    tag?: string;
    network?: string;
}

async function fetchBinanceUSDTAddress(): Promise<WalletAddress | null> {
    try {
        const timestamp = Date.now();
        const queryString = `coin=USDT&timestamp=${timestamp}`;
        const signature = crypto
            .createHmac('sha256', process.env.BINANCE_API_SECRET || '')
            .update(queryString)
            .digest('hex');

        const response = await axios.get(`https://api.binance.com/sapi/v1/capital/deposit/address?${queryString}&signature=${signature}`, {
            headers: {
                'X-MBX-APIKEY': process.env.BINANCE_API_KEY
            }
        });

        return {
            exchange: 'Binance',
            currency: 'USDT',
            address: response.data.address,
            tag: response.data.tag,
            network: response.data.network
        };
    } catch (error) {
        logger.error('Failed to fetch Binance USDT address:', error.message);
        return null;
    }
}

async function fetchKuCoinUSDTAddress(): Promise<WalletAddress | null> {
    try {
        const timestamp = Date.now();
        const endpoint = '/api/v1/deposit-addresses';
        const queryString = `currency=USDT`;
        
        const signStr = timestamp + 'GET' + endpoint + '?' + queryString;
        const signature = crypto
            .createHmac('sha256', process.env.KUCOIN_API_SECRET || '')
            .update(signStr)
            .digest('base64');

        const response = await axios.get(`https://api.kucoin.com${endpoint}?${queryString}`, {
            headers: {
                'KC-API-KEY': process.env.KUCOIN_API_KEY,
                'KC-API-SIGN': signature,
                'KC-API-TIMESTAMP': timestamp,
                'KC-API-PASSPHRASE': process.env.KUCOIN_PASSPHRASE
            }
        });

        if (response.data.code === '200000' && response.data.data) {
            return {
                exchange: 'KuCoin',
                currency: 'USDT',
                address: response.data.data.address,
                tag: response.data.data.memo
            };
        }
        return null;
    } catch (error) {
        logger.error('Failed to fetch KuCoin USDT address:', error.message);
        return null;
    }
}

async function fetchAllWalletAddresses(): Promise<WalletAddress[]> {
    logger.info('🔍 Fetching USDT wallet addresses from exchanges...');
    
    const addresses: WalletAddress[] = [];
    
    // Fetch Binance address
    const binanceAddress = await fetchBinanceUSDTAddress();
    if (binanceAddress) {
        addresses.push(binanceAddress);
        logger.info(`✅ Binance USDT: ${binanceAddress.address}`);
    }

    // Fetch KuCoin address  
    const kucoinAddress = await fetchKuCoinUSDTAddress();
    if (kucoinAddress) {
        addresses.push(kucoinAddress);
        logger.info(`✅ KuCoin USDT: ${kucoinAddress.address}`);
    }

    // ZebPay and CoinSwitch don't have public APIs for wallet addresses
    logger.warn('⚠️ ZebPay and CoinSwitch addresses need to be fetched manually');
    logger.info('📋 Please check these manually:');
    logger.info('   ZebPay: https://www.zebpay.com/wallet');
    logger.info('   CoinSwitch: https://coinswitch.co/wallet');

    return addresses;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    fetchAllWalletAddresses()
        .then(addresses => {
            logger.info(`\n📊 Found ${addresses.length} wallet addresses:`);
            addresses.forEach(addr => {
                logger.info(`${addr.exchange}: ${addr.address} ${addr.tag ? `(Tag: ${addr.tag})` : ''}`);
            });
        })
        .catch(error => {
            logger.error('Failed to fetch wallet addresses:', error);
        });
}

export { fetchAllWalletAddresses };