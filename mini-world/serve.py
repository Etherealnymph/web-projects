import http.server, socketserver, os, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
    print('serving at', PORT)
    httpd.serve_forever()
