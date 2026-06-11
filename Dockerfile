FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src

RUN chgrp -R 0 /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html \
    && chmod -R g=u /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html

EXPOSE 8080
