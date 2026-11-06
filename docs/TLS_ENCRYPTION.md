# TLS Encryption: Hop-by-Hop Encrypted Traffic

MUCGPT encrypts **every network hop** from the user's browser to every pod. There is no
plaintext hop anywhere on the path. TLS termination plus re-encryption after inspection is
fine at every tier — what must not exist is an unencrypted network connection.

See [issue #1419](https://github.com/it-at-m/mucgpt/issues/1419) for the motivation and
acceptance criteria.

> **Local development and demo only:** the Compose TLS stack in this document mirrors the
> production pattern for development purposes. Production deployments additionally need a
> properly secured deployment procedure (see [Production notes](#production-notes)).

## Architecture

```
Browser ──TLS──► Cluster edge (terminates with public cert,
                    re-encrypts with internal cluster certs)
                    └─TLS─► refarch-gateway pod (terminates, routes by path,
                                re-encrypts all upstream hops)
                              ├─TLS─► core-service pod (uvicorn TLS)
                              ├─TLS─► assistant-service pod (uvicorn TLS)
                              ├─TLS─► frontend pod (nginx TLS)
                              └─TLS─► Keycloak (HTTPS)
```

- The cluster edge terminates the browser-facing TLS with the public certificate and
  re-encrypts towards the application using internal cluster certificates (OpenShift Route
  `termination: reencrypt` or the Gateway API equivalent). The edge keeps full L7
  visibility (WAF, rate limiting, logging).
- The gateway pod terminates TLS, routes by path (`/api/backend/**`,
  `/api/assistant/**`, …) and re-encrypts every upstream hop.
- Every application pod terminates TLS itself.

No image changes are required for any component — everything is configuration.

## Local stack quickstart

The Compose stack can run fully TLS-encrypted via the override file
[`stack/docker-compose.tls.yml`](../stack/docker-compose.tls.yml):

```bash
# 1. Generate a local development CA and leaf certificates
bash stack/tls/generate-dev-certs.sh

# 2. Build the gateway JVM truststore (see "JVM default truststore" below)
# 3. Trust the dev CA (stack/tls/certs/ca.crt) in your browser/OS,
#    and make sure your hosts file contains: 127.0.0.1 keycloak

# 4. Start the stack with the TLS override
cd stack
podman compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Access points:

| URL | TLS | Notes |
|-----|-----|-------|
| `https://localhost:9443` | gateway leaf cert | MUCGPT frontend (via gateway) |
| `https://keycloak:8443` | keycloak leaf cert | SSO login (hosts entry required) |

The TLS override replaces the plaintext ports (`8083`, `8081`, `39146`, `39147`) — no
plaintext application port is published on the host.

## How each hop is configured

### refarch-gateway (server side: browser-facing TLS)

Standard Spring Boot properties, injected via environment variables:

```yaml
server:
  ssl:
    certificate: /etc/certs/gateway/tls.crt            # PEM leaf certificate
    certificate-private-key: /etc/certs/gateway/tls.key # PEM private key
    enabled-protocols: TLSv1.2,TLSv1.3
```

Environment variable form (used in `docker-compose.tls.yml`):

```
SERVER_SSL_CERTIFICATE=/etc/certs/gateway/tls.crt
SERVER_SSL_CERTIFICATE_PRIVATE_KEY=/etc/certs/gateway/tls.key
SERVER_SSL_ENABLED_PROTOCOLS=TLSv1.2,TLSv1.3
```

### refarch-gateway (client side: re-encryption to upstreams)

Spring Boot *SSL bundles* provide the trust material, and Spring Cloud Gateway applies the
bundle to all upstream connections:

```yaml
spring:
  ssl:
    bundle:
      pem:
        internalca:
          truststore:
            certificate: file:/etc/certs/ca.crt # internal CA that signed all pod certs
  cloud:
    gateway:
      server:
        webflux:
          httpclient:
            ssl:
              ssl-bundle: internalca
```

Environment variable form (note: the bundle name must not contain dashes so that relaxed
env-var binding keeps the name intact):

```
SPRING_SSL_BUNDLE_PEM_INTERNALCA_TRUSTSTORE_CERTIFICATE=file:/etc/certs/ca.crt
SPRING_CLOUD_GATEWAY_SERVER_WEBFLUX_HTTPCLIENT_SSL_SSLBUNDLE=internalca
```

**JVM default truststore:** the SSL bundle only covers the gateway's route httpclient.
Other JVM-level HTTPS calls — most importantly the OAuth2 OpenID-Connect discovery fetch
against the Keycloak issuer at startup — use the JVM default truststore
(`/etc/pki/java/cacerts` on the UBI image). Mount a truststore copy containing the
internal CA over that path (read-only, works without root — the image runs as uid 185):

```bash
# one-shot generation using the gateway image (keytool included there)
podman run --name cacerts-gen -v "$(pwd)/tls/certs:/work:ro,Z" \
  --entrypoint sh ghcr.io/it-at-m/refarch/refarch-gateway:<version> \
  -c 'cp /etc/pki/java/cacerts /tmp/gc && chmod 644 /tmp/gc \
      && keytool -importcert -noprompt -alias mucgpt-internal-ca \
         -file /work/ca.crt -keystore /tmp/gc -storepass changeit'
podman cp cacerts-gen:/tmp/gc tls/certs/gateway-cacerts && podman rm cacerts-gen

# compose mount (see docker-compose.tls.yml):
#   - ./tls/certs/gateway-cacerts:/etc/pki/java/cacerts:ro,Z
```

For production, the platform-provided CA bundle should be applied the same way (or via
the cluster's trust-anchor injection mechanism).

All routes then point at `https://` upstreams:

```
SPRING_CLOUD_GATEWAY_SERVER_WEBFLUX_ROUTES_1_URI=https://core-service:8000/
SPRING_CLOUD_GATEWAY_SERVER_WEBFLUX_ROUTES_2_URI=https://assistant-service:8084/
SPRING_CLOUD_GATEWAY_SERVER_WEBFLUX_ROUTES_3_URI=https://frontend:8443/
SPRING_CLOUD_GATEWAY_SERVER_WEBFLUX_ROUTES_0_URI=https://keycloak:8443/
```

The SSO issuer URI must use the same TLS endpoint the browser uses, because the issuer is
embedded in the issued tokens:

```
SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUERURI=https://keycloak:8443/auth/realms/local_realm
```

### core-service / assistant-service (uvicorn TLS termination)

Uvicorn terminates TLS directly in the pod. In Compose this is done with a `command`
override — no image change:

```yaml
command: >-
  python -m uvicorn app:backend --host 0.0.0.0 --port 8000
  --ssl-certfile /etc/certs/core-service/tls.crt
  --ssl-keyfile /etc/certs/core-service/tls.key
```

For other deployment forms (Helm, `docker run`, systemd), pass the same flags to uvicorn.
Health checks must use the CA (`curl --cacert /etc/certs/ca.crt https://localhost:8000/api/health`),
not `-k`, so that a broken certificate chain fails the probe.

### frontend (nginx TLS termination)

The frontend image (UBI nginx) gets an additional server block via a mounted config
(`stack/tls/frontend-tls.conf`) that terminates TLS on `:8443` and proxies to the baked-in
HTTP server on the container's **loopback** interface. The loopback hop stays inside the
container — it is not a network hop between pods, so no plaintext traffic leaves the pod.

### Keycloak

```yaml
KC_HTTP_ENABLED=true            # kept only for the one-time bootstrap migration
KC_HTTP_PORT=8100
KC_HTTPS_PORT=8443
KC_HTTPS_CERTIFICATE_FILE=/etc/certs/keycloak/tls.crt
KC_HTTPS_CERTIFICATE_KEY_FILE=/etc/certs/keycloak/tls.key
```

The browser-facing endpoint is `https://keycloak:8443` (hosts entry `keycloak → 127.0.0.1`).
The gateway and the browser must use the **same** issuer URL (see above).

## Certificate requirements

Leaf certificates must carry SANs matching the hostnames their callers use:

| Certificate | Required SANs | Used by |
|-------------|---------------|---------|
| `gateway` | `localhost` (or the public hostname) | browser, edge re-encrypt |
| `core-service` | `core-service`, `localhost` | gateway, in-pod health checks |
| `assistant-service` | `assistant-service`, `localhost` | gateway, in-pod health checks |
| `frontend` | `frontend`, `localhost` | gateway |
| `keycloak` | `keycloak` (or the public SSO hostname) | gateway, browser |

All leaf certificates are signed by one internal CA; every TLS **client** in the stack
(gateway, health checks) trusts that CA.

## Production notes

### Cluster edge (OpenShift re-encrypt route)

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mucgpt
spec:
  host: mucgpt.example.com
  to:
    kind: Service
    name: refarch-gateway
  port:
    targetPort: 8080
  tls:
    termination: reencrypt
    certificate: <public cert PEM>       # managed by your cert issuer
    key: <public key PEM>
    destinationCACertificate: <internal CA PEM>  # edge trusts the pod cert
```

The gateway pod presents its internal-CA-signed certificate to the edge; the edge validates
it via `destinationCACertificate` and re-encrypts. Certificates for pods are issued and
rotated by cert-manager with an internal ClusterIssuer.

### Mutual TLS (optional hardening)

To authenticate callers (gateway → backend), enable client-certificate verification:

- uvicorn: `--ssl-ca-certs /etc/certs/ca.crt --ssl-cert-reqs 2` (requires client cert)
- Spring Boot gateway: `server.ssl.trust-certificate=file:/etc/certs/ca.crt` plus
  `server.ssl.client-auth=need`, and a client-key bundle for outgoing connections
  (`spring.ssl.bundle.pem.<name>.keystore.certificate` / `.key`, referenced by the
  `ssl-bundle` property above).

### Remaining plaintext hops (to eliminate or explicitly accept)

| Hop | Status | How to close |
|-----|--------|--------------|
| `init-keycloak` → Keycloak `:8100` | accepted exception (one-time bootstrap migration at startup) | configure JVM truststore in the migration image |
| PostgreSQL | plaintext | enable `ssl=on` server-side, `sslmode=verify-full` client-side |
| Valkey | plaintext | enable TLS (`--tls-port`, certs), TLS support in the Redis clients |
| xberg (document parsing) | plaintext | TLS termination in front of xberg |
| MCP servers | plaintext | MCP endpoints over `https` |
| Langfuse | external `https` already | — |

These hops are internal-only (no published route), but should be closed for full
east-west encryption. Each is a separate, scoped change.

## Verification

Check every hop presents a valid certificate chain (from inside the cluster/pods):

```bash
# gateway (browser-facing)
openssl s_client -connect localhost:9443 -servername localhost </dev/null 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName

# gateway -> core (from the gateway container)
podman exec mucgpt-stack-refarch-gateway-1 \
  curl --cacert /etc/certs/ca.crt https://core-service:8000/api/health

# gateway -> assistant / frontend / keycloak: same pattern with :8084 / :8443 / :8443
```

All requests must succeed **without** `-k`/`--insecure`. If a hop only works with
`-k`, its trust chain is broken.

> **Windows note:** the Windows curl build uses schannel, which fails revocation checks
> for private dev CAs. Add `--ssl-no-revoke` for local verification:
> `curl --ssl-no-revoke --cacert stack/tls/certs/ca.crt https://localhost:9443/`.
> Git Bash additionally rewrites absolute paths like `/etc/certs/ca.crt` in
> `podman exec` arguments — prefix such commands with `MSYS_NO_PATHCONV=1`.

## Known limitations

- `npm run dev-no-mock` (Vite dev server) proxies `/api` to `http://localhost:8083` and
  does not participate in the TLS stack; use the Compose frontend for TLS testing.
- SSE streaming (chat responses) passes through the gateway's TLS stack unbuffered; if
  response streaming stalls, check proxy buffering settings on the TLS hops.
- The `!override` YAML tag in `docker-compose.tls.yml` requires Compose v2.24+.
