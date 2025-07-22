const axios = require('axios');

async function testOracleAPIs() {
    console.log('\n🚀 Testing APIs through Oracle Cloud (150.230.235.0)\n');
    console.log('Using SSH tunnel on port 3001...\n');
    
    try {
        // Test dashboard API
        console.log('1. Testing Dashboard API...');
        const status = await axios.get('http://localhost:3001/api/status');
        console.log('✅ Dashboard API working!');
        console.log('   Monitoring:', status.data.monitoring);
        console.log('   Timestamp:', new Date(status.data.timestamp).toLocaleString());
        
        // Test prices
        console.log('\n2. Testing Price API...');
        const prices = await axios.get('http://localhost:3001/api/prices');
        console.log('✅ Price API working!');
        prices.data.forEach(price => {
            console.log(`   ${price.exchange}: ₹${price.bid} / ₹${price.ask}`);
        });
        
        // Test balances (this will use Oracle's whitelisted IP)
        console.log('\n3. Testing Balance API...');
        try {
            const balances = await axios.get('http://localhost:3001/api/balances');
            console.log('✅ Balance API working!');
            console.log(balances.data);
        } catch (e) {
            console.log('⚠️  Balance API:', e.response?.data?.error || e.message);
        }
        
        // Test opportunities
        console.log('\n4. Testing Opportunities API...');
        const opps = await axios.get('http://localhost:3001/api/opportunities');
        console.log('✅ Found', opps.data.length, 'opportunities');
        
        console.log('\n✅ Oracle Cloud APIs are accessible!');
        console.log('   All API calls use IP: 150.230.235.0');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nMake sure:');
        console.log('1. SSH tunnel is active: ssh -L 3001:localhost:3001 opc@150.230.235.0');
        console.log('2. Dashboard is running on Oracle Cloud');
        console.log('3. IP 150.230.235.0 is whitelisted in exchanges');
    }
}

testOracleAPIs();