interface PaymentDetails {
  amount: number;
  sender: string;
  accountNumber: string;
  timestamp: Date;
  bank: string;
  transactionId?: string;
  rawMessage: string;
}

interface BankParser {
  bank: string;
  patterns: RegExp[];
  parse: (text: string) => PaymentDetails | null;
}

const bankParsers: BankParser[] = [
  {
    bank: 'SBI',
    patterns: [
      /Rs\.?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to A\/c \*{3}(\d+) on (\d{2}-\d{2}-\d{2}) from ([A-Za-z\s]+)/,
      /Your SBI A\/c \*{3}(\d+) credited by Rs\.?(\d+(?:,\d{3})*(?:\.\d{2})?) on (\d{2}[A-Za-z]{3}\d{2}) by ([A-Za-z\s]+)/,
      /Rs\.?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to SBI A\/c \*{3}(\d+) via UPI from ([A-Za-z0-9@\s]+)/,
      /SBI: Rs\.?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to Acct \*{2}(\d+) by UPI ([A-Za-z0-9]+)/
    ],
    parse: (text: string) => {
      for (const pattern of bankParsers[0].patterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            amount: parseFloat(match[1].replace(/,/g, '')),
            accountNumber: match[2],
            sender: match[4] || match[3] || 'UPI Transfer',
            timestamp: new Date(),
            bank: 'SBI',
            transactionId: match[3],
            rawMessage: text
          };
        }
      }
      return null;
    }
  },
  {
    bank: 'HDFC',
    patterns: [
      /Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to a\/c \*{2}(\d+) on (\d{2}-\d{2}-\d{2})\. Info: ([A-Za-z\s\/]+)/,
      /UPDATE: Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to a\/c \*{2}(\d+) on (\d{2}-\d{2}-\d{2}) by a\/c linked to mobile ([0-9\*]+)/,
      /Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to a\/c \*{2}(\d+) via UPI\. UPI Ref No (\d+)/,
      /HDFC Bank: Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to Acct \*{2}(\d+) by UPI ([A-Za-z0-9]+)/
    ],
    parse: (text: string) => {
      for (const pattern of bankParsers[1].patterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            amount: parseFloat(match[1].replace(/,/g, '')),
            accountNumber: match[2],
            sender: match[4] || match[3] || 'UPI Transfer',
            timestamp: new Date(),
            bank: 'HDFC',
            transactionId: match[3],
            rawMessage: text
          };
        }
      }
      return null;
    }
  },
  {
    bank: 'ICICI',
    patterns: [
      /ICICI Bank Acct \*{2}(\d+) credited with Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) on (\d{2}-[A-Za-z]{3}-\d{2}) by ([A-Za-z\s]+)/,
      /Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to your Account \*{2}(\d+) on (\d{2}-\d{2}-\d{2,4})/,
      /Your ICICI Bank Account \*{2}(\d+) has been credited by Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) on (\d{2}-[A-Za-z]{3}) UPI:([0-9]+)/,
      /ICICI: Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to Account \*{2}(\d+) via UPI ([A-Za-z0-9]+)/
    ],
    parse: (text: string) => {
      for (const pattern of bankParsers[2].patterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            amount: parseFloat((match[2] || match[1]).replace(/,/g, '')),
            accountNumber: match[1],
            sender: match[4] || 'UPI Transfer',
            timestamp: new Date(),
            bank: 'ICICI',
            transactionId: match[4] || match[3],
            rawMessage: text
          };
        }
      }
      return null;
    }
  },
  {
    bank: 'AXIS',
    patterns: [
      /INR (\d+(?:,\d{3})*(?:\.\d{2})?) credited to A\/c no\. \*{3}(\d+) on (\d{2}-[A-Za-z]{3}-\d{2}) via ([A-Za-z\s]+)/,
      /Axis Bank: Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to A\/c \*{2}(\d+) by UPI ([A-Za-z0-9]+)/,
      /Your Axis Bank Account \*{2}(\d+) credited with INR (\d+(?:,\d{3})*(?:\.\d{2})?) via UPI/
    ],
    parse: (text: string) => {
      for (const pattern of bankParsers[3].patterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            amount: parseFloat((match[1] || match[2]).replace(/,/g, '')),
            accountNumber: match[2] || match[1],
            sender: match[4] || match[3] || 'UPI Transfer',
            timestamp: new Date(),
            bank: 'AXIS',
            transactionId: match[3],
            rawMessage: text
          };
        }
      }
      return null;
    }
  },
  {
    bank: 'KOTAK',
    patterns: [
      /Kotak Bank: Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) credited to A\/c \*{2}(\d+) on (\d{2}\/\d{2}\/\d{2}) via ([A-Za-z\s]+)/,
      /Your Kotak Bank Account \*{2}(\d+) is credited with Rs\.? ?(\d+(?:,\d{3})*(?:\.\d{2})?) by UPI ([A-Za-z0-9]+)/
    ],
    parse: (text: string) => {
      for (const pattern of bankParsers[4].patterns) {
        const match = text.match(pattern);
        if (match) {
          return {
            amount: parseFloat((match[1] || match[2]).replace(/,/g, '')),
            accountNumber: match[2] || match[1],
            sender: match[4] || match[3] || 'UPI Transfer',
            timestamp: new Date(),
            bank: 'KOTAK',
            transactionId: match[3],
            rawMessage: text
          };
        }
      }
      return null;
    }
  }
];

export function parseIndianBankSMS(text: string): PaymentDetails | null {
  for (const parser of bankParsers) {
    const result = parser.parse(text);
    if (result) return result;
  }
  return null;
}

export type { PaymentDetails, BankParser };