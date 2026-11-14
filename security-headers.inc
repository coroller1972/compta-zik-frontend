# En-têtes de sécurité, inclus dans CHAQUE location : un add_header dans une location
# remplace ceux hérités du niveau server, d'où l'include plutôt qu'une déclaration unique.
# HSTS est posé par la route OpenShift (annotation hsts_header), pas ici.
#
# CSP : 'unsafe-eval' est requis tant que Vue compile les gabarits dans le navigateur
# (build esm-browser sans étape de build). 'unsafe-inline' pour les styles couvre les
# attributs style insérés par Vue et le QR code. connect-src 'self' limite les appels
# d'API à la même origine, y compris si la « Base API » est modifiée à la connexion.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
