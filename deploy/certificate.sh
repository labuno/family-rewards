#!/bin/sh
set -eu
case "${1:-}" in issue|renew) action="$1";; *) echo 'Usage: sudo sh deploy/certificate.sh issue|renew' >&2; exit 1;; esac
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DOMAIN=ellie-rewards.duckdns.org
IMAGE=ghcr.io/acmesh-official/acme.sh:3.1.6@sha256:9e0652c6bf072cbf40112a1085d1240228044699d0958a89eacc99b4ff4f02fb
umask 077
mkdir -p "$TASK_ROOT/acme" "$TASK_ROOT/tls"
acme_run() {
  docker run --rm --cap-drop ALL --security-opt no-new-privileges:true --entrypoint /bin/sh \
    -v "$TASK_ROOT/secrets/duckdns-token:/run/secrets/duckdns_token:ro" \
    -v "$TASK_ROOT/acme:/acme.sh" -v "$TASK_ROOT/tls:/tls" \
    "$IMAGE" -c 'export DuckDNS_Token="$(cat /run/secrets/duckdns_token)"; exec /entry.sh "$@"' sh "$@"
}
if [ "$action" = issue ]; then
  acme_run --issue --dns dns_duckdns -d "$DOMAIN" --server letsencrypt --dnssleep 60
else
  acme_run --cron
fi
acme_run --install-cert --ecc -d "$DOMAIN" --key-file /tls/key.pem --fullchain-file /tls/cert.pem
chmod -R go-rwx "$TASK_ROOT/acme"
chown root:101 "$TASK_ROOT/tls" "$TASK_ROOT/tls/cert.pem" "$TASK_ROOT/tls/key.pem"
chmod 750 "$TASK_ROOT/tls"
chmod 640 "$TASK_ROOT/tls/cert.pem" "$TASK_ROOT/tls/key.pem"
if [ -n "$(docker compose -f "$TASK_ROOT/deploy/compose.yaml" -f "$TASK_ROOT/deploy/web.compose.yaml" ps --status running -q web)" ]; then
  docker compose -f "$TASK_ROOT/deploy/compose.yaml" -f "$TASK_ROOT/deploy/web.compose.yaml" exec -T web nginx -t -c /etc/nginx/nginx.conf
  docker compose -f "$TASK_ROOT/deploy/compose.yaml" -f "$TASK_ROOT/deploy/web.compose.yaml" exec -T web nginx -s reload -c /etc/nginx/nginx.conf
fi
