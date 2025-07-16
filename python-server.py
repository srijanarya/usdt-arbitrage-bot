#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
from datetime import datetime

PORT = 58321

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)
    
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
            return super().do_GET()
        elif self.path == '/api/system-status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'success': True,
                'data': {
                    'status': 'operational',
                    'timestamp': datetime.now().isoformat()
                }
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            return super().do_GET()

print(f"Starting server on http://localhost:{PORT}")
print(f"Open your browser to: http://localhost:{PORT}")
print("\nPress Ctrl+C to stop\n")

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")