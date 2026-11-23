#!/usr/bin/env bash
#
# Generates a local development CA and leaf certificates for the MUCGPT TLS stack.
#
# Output (gitignored): stack/tls/certs/
#   ca.crt / ca.key                 - local development CA
#   <service>/tls.crt / tls.key     - leaf certificate per service
#
# The leaf certificates carry the SANs the stack needs for hostname verification:
#   gateway            localhost
#   core-service       core-service, localhost
#   assistant-service  assistant-service, localhost
#   frontend           frontend, localhost
#   keycloak           keycloak
#
# Usage:  bash stack/tls/generate-dev-certs.sh
# Requires openssl >= 1.1.1 (e.g. Git Bash, WSL, or any Linux shell).
#
set -euo pipefail

# Prevent MSYS/Git-Bash from rewriting openssl arguments like /CN=... into Windows paths.
export MSYS2_ARG_CONV_EXCL="/CN"

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${BASE_DIR}/certs"
DAYS=825

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

echo "==> Generating development CA"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout "${OUT_DIR}/ca.key" -out "${OUT_DIR}/ca.crt" \
  -days "${DAYS}" -subj "/CN=MUCGPT Dev CA" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "basicConstraints=critical,CA:TRUE"

issue() {
  local name="$1"
  local sans="$2"
  echo "==> Issuing certificate for ${name} (SANs: ${sans})"
  mkdir -p "${OUT_DIR}/${name}"
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
    -keyout "${OUT_DIR}/${name}/tls.key" -out "${OUT_DIR}/${name}/tls.csr" \
    -subj "/CN=${name}"
  cat > "${OUT_DIR}/${name}/san.ext" <<EOF
subjectAltName=${sans}
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF
  openssl x509 -req -in "${OUT_DIR}/${name}/tls.csr" \
    -CA "${OUT_DIR}/ca.crt" -CAkey "${OUT_DIR}/ca.key" -CAcreateserial \
    -out "${OUT_DIR}/${name}/tls.crt" -days "${DAYS}" \
    -extfile "${OUT_DIR}/${name}/san.ext"
  rm -f "${OUT_DIR}/${name}/tls.csr" "${OUT_DIR}/${name}/san.ext"
}

issue gateway "DNS:localhost"
issue core-service "DNS:core-service,DNS:localhost"
issue assistant-service "DNS:assistant-service,DNS:localhost"
issue frontend "DNS:frontend,DNS:localhost"
issue keycloak "DNS:keycloak"

# 644 instead of 600: under rootless podman the containers run as a mapped
# non-root user (ubi nginx: 1001) and must be able to read the mounted keys.
# Acceptable for local development only.
chmod 644 "${OUT_DIR}/ca.key" "${OUT_DIR}"/*/tls.key
chmod 644 "${OUT_DIR}/ca.crt" "${OUT_DIR}"/*/tls.crt

echo ""
echo "Done. Certificates are in ${OUT_DIR}."
echo "Trust ${OUT_DIR}/ca.crt in your browser/OS to silence certificate warnings"
echo "(the gateway and all services use it to verify each other automatically)."
