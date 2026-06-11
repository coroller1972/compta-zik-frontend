FROM registry.access.redhat.com/ubi9/nginx-124:latest

USER 0
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /opt/app-root/src/index.html
COPY src /opt/app-root/src/src

RUN chgrp -R 0 /etc/nginx/conf.d /opt/app-root/src /var/cache/nginx /var/run /var/log/nginx \
    && chmod -R g=u /etc/nginx/conf.d /opt/app-root/src /var/cache/nginx /var/run /var/log/nginx

USER 1001
EXPOSE 8080
