FROM registry.access.redhat.com/ubi9/nginx-124:latest

USER 0
COPY nginx.conf /opt/app-root/etc/nginx.default.d/default.conf
COPY index.html /opt/app-root/src/index.html
COPY src /opt/app-root/src/src

RUN sed -i 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx /var/log/nginx /opt/app-root/etc/nginx.default.d \
    && chgrp -R 0 /opt/app-root/etc/nginx.default.d /opt/app-root/src /var/cache/nginx /var/log/nginx \
    && chmod -R g=u /opt/app-root/etc/nginx.default.d /opt/app-root/src /var/cache/nginx /var/log/nginx

USER 1001
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
