import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { logger } from '../utils/logger';

interface UPIPayment {
  date: string;
  amount: string;
  from: string;
  reference: string;
  subject: string;
  rawBody?: string;
}

async function fetchLastUPIPayments(): Promise<void> {
  const imap = new Imap({
    user: 'srijanaryay@gmail.com',
    password: 'dxot kzcf szve mipy',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  return new Promise((resolve, reject) => {
    const upiPayments: UPIPayment[] = [];

    imap.once('ready', () => {
      logger.info('✅ Connected to Gmail');
      
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          logger.error('Error opening inbox:', err);
          return reject(err);
        }

        // Search for UPI notifications from Axis Bank (your primary bank)
        // IMAP search expects array format differently
        imap.search([['FROM', 'axisbank']], (err, results) => {
          if (err) {
            logger.error('Search error:', err);
            return reject(err);
          }

          if (!results || results.length === 0) {
            logger.info('No UPI payment emails found');
            imap.end();
            return resolve();
          }

          // Get last 10 messages
          const fetchCount = Math.min(results.length, 10);
          const lastMessages = results.slice(-fetchCount);
          
          logger.info(`📧 Fetching ${fetchCount} recent bank emails...`);

          const fetch = imap.fetch(lastMessages, { bodies: '' });
          let processedCount = 0;

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) return;

                const body = parsed.text || '';
                const subject = parsed.subject || '';
                
                // Check if it's a UPI credit notification
                if (body.match(/credited|received|UPI|payment/i) && 
                    body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/)) {
                  
                  // Extract payment details
                  const amountMatch = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/);
                  const upiMatch = body.match(/UPI.*?(?:from|by|ID:?)\s*([^\s]+)/i) ||
                                   body.match(/From\s+([^\s]+@[\w]+)/i);
                  const refMatch = body.match(/(?:Reference|Ref|Transaction ID|UTR|Txn ID)[:\s]*([\w\d]+)/i);

                  if (amountMatch) {
                    upiPayments.push({
                      date: parsed.date ? new Date(parsed.date).toLocaleString('en-IN') : 'Unknown',
                      amount: amountMatch[1].replace(/,/g, ''),
                      from: upiMatch ? upiMatch[1] : 'Unknown',
                      reference: refMatch ? refMatch[1] : 'N/A',
                      subject: subject.substring(0, 60),
                      rawBody: body.substring(0, 200)
                    });
                  }
                }

                processedCount++;
                if (processedCount === fetchCount) {
                  displayUPIPayments(upiPayments);
                  imap.end();
                }
              });
            });
          });

          fetch.once('error', (err) => {
            logger.error('Fetch error:', err);
            reject(err);
          });

          fetch.once('end', () => {
            logger.info('✅ Finished fetching messages');
          });
        });
      });
    });

    imap.once('error', (err) => {
      logger.error('IMAP error:', err);
      reject(err);
    });

    imap.once('end', () => {
      logger.info('📧 IMAP connection closed');
      resolve();
    });

    imap.connect();
  });
}

function displayUPIPayments(payments: UPIPayment[]): void {
  console.log('\n🏦 YOUR LAST 10 UPI PAYMENTS (from Gmail)\n');
  console.log('━'.repeat(90));
  
  if (payments.length === 0) {
    console.log('No UPI credit notifications found in recent emails');
    return;
  }

  // Sort by date (newest first)
  payments.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  payments.forEach((payment, index) => {
    console.log(`\n${index + 1}. 📅 Date: ${payment.date}`);
    console.log(`   💰 Amount: ₹${payment.amount}`);
    console.log(`   👤 From: ${payment.from}`);
    console.log(`   🔖 Reference: ${payment.reference}`);
    console.log(`   📧 Subject: ${payment.subject}`);
    if (payment.rawBody) {
      console.log(`   📝 Preview: ${payment.rawBody.substring(0, 100)}...`);
    }
    console.log('─'.repeat(90));
  });

  // Summary
  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount.replace(/,/g, '') || '0'), 0);
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total payments shown: ${payments.length}`);
  console.log(`   Total amount: ₹${total.toLocaleString('en-IN')}`);
  console.log('━'.repeat(90));
}

// Run immediately
if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('🔍 Fetching your UPI payment history from Gmail...');
  fetchLastUPIPayments()
    .then(() => {
      logger.info('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Failed:', error);
      process.exit(1);
    });
}

export { fetchLastUPIPayments };