# Lokaler Dev-Server ohne Browser-Cache: wie `python -m http.server`, schickt aber `Cache-Control: no-store`.
# Sonst hält der Browser JavaScript-Module eine Weile fest (heuristisches Caching) und zeigt nach einer Änderung
# oder einem Branch-Wechsel noch alten Code.
# Aufruf (im Wurzelordner des Repos): python dev/serve.py [port] [bind], z. B. python dev/serve.py 8000 0.0.0.0
import http.server, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webmanifest': 'application/manifest+json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
bind = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
http.server.ThreadingHTTPServer((bind, port), Handler).serve_forever()
