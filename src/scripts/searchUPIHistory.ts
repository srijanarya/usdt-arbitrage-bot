import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { logger } from '../utils/logger';

interface UPITransaction {
  date: string;
  amount: string;
  type: 'credit' | 'debit';
  from?: string;
  to?: string;
  reference?: string;
  bank: string;
  subject: string;
}

async function searchUPIPayments(): Promise<void> {
  const imap = new Imap({
    user: 'srijanaryay@gmail.com',
    password: 'dxot kzcf szve mipy',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  return new Promise((resolve, reject) => {
    const transactions: UPITransaction[] = [];

    imap.once('ready', () => {
      console.log('✅ Connected to Gmail');
      
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          return reject(err);
        }

        console.log('🔍 Searching for UPI transactions...\n');

        // Search for emails containing UPI in the last 30 days
        const searchDate = new Date();
        searchDate.setDate(searchDate.getDate() - 30);
        
        imap.search([
          ['SINCE', searchDate],
          ['TEXT', 'UPI']
        ], (err, results) => {
          if (err) {
            console.error('Search error:', err);
            return reject(err);
          }

          if (!results || results.length === 0) {
            console.log('No bank emails found');
            imap.end();
            return resolve();
          }

          // Get last 50 messages
          const fetchCount = Math.min(results.length, 50);
          const lastMessages = results.slice(-fetchCount);
          
          console.log(`📧 Checking ${fetchCount} recent bank emails...\n`);

          const fetch = imap.fetch(lastMessages, { bodies: '' });
          let processedCount = 0;

          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) return;

                const body = parsed.text || '';
                const subject = parsed.subject || '';
                const from = parsed.from?.text || '';
                
                // Check if it's a UPI transaction
                if (body.match(/UPI|upi|Unified Payment/i) || subject.match(/UPI|upi/i)) {
                  // Extract transaction details
                  const transaction = extractUPIDetails(body, subject, from, parsed.date);
                  
                  if (transaction) {
                    transactions.push(transaction);
                  }
                }

                processedCount++;
                if (processedCount === fetchCount) {
                  displayUPITransactions(transactions);
                  imap.end();
                }
              });
            });
          });

          fetch.once('error', (err) => {
            console.error('Fetch error:', err);
            reject(err);
          });
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err);
      reject(err);
    });

    imap.once('end', () => {
      resolve();
    });

    imap.connect();
  });
}

function extractUPIDetails(body: string, subject: string, from: string, date?: Date): UPITransaction | null {
  try {
    let transaction: UPITransaction = {
      date: date ? date.toLocaleString('en-IN') : 'Unknown',
      amount: '0',
      type: 'credit',
      bank: detectBank(from),
      subject: subject.substring(0, 80)
    };

    // Detect if it's credit or debit
    if (body.match(/credited|received|deposit|added/i) || subject.match(/credit|received/i)) {
      transaction.type = 'credit';
    } else if (body.match(/debited|sent|withdrawn|paid/i) || subject.match(/debit|payment/i)) {
      transaction.type = 'debit';
    }

    // Extract amount
    const amountMatch = body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i);
    if (amountMatch) {
      transaction.amount = amountMatch[1].replace(/,/g, '');
    }

    // Extract UPI ID for credits
    if (transaction.type === 'credit') {
      const upiMatch = body.match(/UPI.*?(?:from|by|ID:?)\s*([^\s,]+@[\w]+)/i) ||
                       body.match(/From\s+([^\s]+@[\w]+)/i) ||
                       body.match(/Sender.*?([^\s]+@[\w]+)/i);
      if (upiMatch) {
        transaction.from = upiMatch[1];
      }
    }

    // Extract UPI ID for debits
    if (transaction.type === 'debit') {
      const upiMatch = body.match(/UPI.*?(?:to|paid to)\s*([^\s,]+@[\w]+)/i) ||
                       body.match(/To\s+([^\s]+@[\w]+)/i) ||
                       body.match(/Beneficiary.*?([^\s]+@[\w]+)/i);
      if (upiMatch) {
        transaction.to = upiMatch[1];
      }
    }

    // Extract reference number
    const refMatch = body.match(/(?:Reference|Ref|Transaction ID|UTR|Txn ID|RRN)[:\s]*([\w\d]+)/i);
    if (refMatch) {
      transaction.reference = refMatch[1];
    }

    // Only return if amount is found
    return parseFloat(transaction.amount) > 0 ? transaction : null;

  } catch (error) {
    return null;
  }
}

function detectBank(from: string): string {
  if (from.includes('axisbank')) return 'Axis Bank';
  if (from.includes('hdfcbank')) return 'HDFC Bank';
  if (from.includes('icicibank')) return 'ICICI Bank';
  if (from.includes('sbi')) return 'SBI';
  if (from.includes('paytm')) return 'Paytm';
  return 'Unknown Bank';
}

function displayUPITransactions(transactions: UPITransaction[]): void {
  console.log('\n💳 YOUR UPI TRANSACTION HISTORY\n');
  console.log('━'.repeat(100));
  
  if (transactions.length === 0) {
    console.log('No UPI transactions found in recent emails');
    return;
  }

  // Sort by date (newest first)
  transactions.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  // Separate credits and debits
  const credits = transactions.filter(t => t.type === 'credit');
  const debits = transactions.filter(t => t.type === 'debit');

  console.log('\n💰 MONEY RECEIVED (Credits)\n');
  if (credits.length === 0) {
    console.log('No UPI credits found');
  } else {
    credits.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.date}`);
      console.log(`   💵 Amount: ₹${txn.amount}`);
      if (txn.from) console.log(`   👤 From: ${txn.from}`);
      if (txn.reference) console.log(`   🔖 Ref: ${txn.reference}`);
      console.log(`   🏦 Bank: ${txn.bank}`);
      console.log(`   📧 ${txn.subject}`);
      console.log('─'.repeat(100));
    });
  }

  console.log('\n💸 MONEY SENT (Debits)\n');
  if (debits.length === 0) {
    console.log('No UPI debits found');
  } else {
    debits.forEach((txn, index) => {
      console.log(`${index + 1}. ${txn.date}`);
      console.log(`   💵 Amount: ₹${txn.amount}`);
      if (txn.to) console.log(`   👤 To: ${txn.to}`);
      if (txn.reference) console.log(`   🔖 Ref: ${txn.reference}`);
      console.log(`   🏦 Bank: ${txn.bank}`);
      console.log(`   📧 ${txn.subject}`);
      console.log('─'.repeat(100));
    });
  }

  // Summary
  const totalCredits = credits.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalDebits = debits.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  console.log('\n📊 SUMMARY');
  console.log('━'.repeat(100));
  console.log(`💰 Total Received: ₹${totalCredits.toLocaleString('en-IN')} (${credits.length} transactions)`);
  console.log(`💸 Total Sent: ₹${totalDebits.toLocaleString('en-IN')} (${debits.length} transactions)`);
  console.log(`📈 Net: ₹${(totalCredits - totalDebits).toLocaleString('en-IN')}`);
  console.log('━'.repeat(100));
}

// Run the search
console.log('🔍 Searching your Gmail for UPI payment history...\n');
searchUPIPayments()
  .then(() => {
    console.log('\n✅ Search completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Search failed:', error);
    process.exit(1);
  });