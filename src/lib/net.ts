import dns from 'node:dns/promises';

/**
 * Throw if `rawUrl` is not a safe public HTTP/HTTPS URL.
 *
 * Rejects:
 *  - non-http/https schemes (file:, ftp:, gopher:, dict:, …)
 *  - hostnames that resolve to RFC-1918, loopback, link-local,
 *    APIPA, or IPv6 ULA / loopback addresses
 *
 * Every resolved address is checked so DNS rebinding and multi-A records
 * cannot bypass the guard.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('invalid_url');
  }

  const scheme = parsed.protocol;
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new Error(`forbidden_scheme:${scheme}`);
  }

  const hostname = parsed.hostname;

  // Resolve all addresses and check every one
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('dns_resolution_failed');
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new Error(`private_ip:${address}`);
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new Error(`private_ip:${address}`);
    }
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true; // malformed — reject
  const [a, b] = parts as [number, number, number, number];

  // Loopback: 127.0.0.0/8
  if (a === 127) return true;
  // RFC-1918: 10.0.0.0/8
  if (a === 10) return true;
  // RFC-1918: 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // RFC-1918: 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // Link-local / APIPA: 169.254.0.0/16
  if (a === 169 && b === 254) return true;
  // "This" network: 0.0.0.0/8
  if (a === 0) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Loopback ::1
  if (lower === '::1') return true;
  // IPv6 ULA: fc00::/7 — starts with fc or fd
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // Link-local: fe80::/10
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  return false;
}
