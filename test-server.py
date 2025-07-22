#!/usr/bin/env python3
import http.server
import socketserver

class BotStatusHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        html_content = '''
<html>
<head>
    <title>USDT Arbitrage Bot Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="background:linear-gradient(45deg,#667eea,#764ba2);color:white;text-align:center;padding:50px;font-family:Arial;">
    <h1>🚀 USDT Arbitrage Bot</h1>
    <h2>✅ SUCCESS!</h2>
    <p style="font-size:20px;">Oracle Cloud: 150.230.235.0:3000</p>
    <p style="font-size:18px;">Your bot is WORKING!</p>
    <hr style="margin:30px auto;width:200px;border:1px solid rgba(255,255,255,0.3);">
    <p style="opacity:0.8;">Server running on port 3000</p>
</body>
</html>
'''
        self.wfile.write(html_content.encode())

if __name__ == "__main__":
    PORT = 3000
    with socketserver.TCPServer(("0.0.0.0", PORT), BotStatusHandler) as httpd:
        print(f"Server running at http://0.0.0.0:{PORT}")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()