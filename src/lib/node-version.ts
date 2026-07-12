/** Minimum Node.js major version required to run the Qadbak panel. */
export const QADBAK_MIN_NODE_MAJOR = 20;

/** Default LTS major installed by the native installer when Node is missing. */
export const QADBAK_DEFAULT_NODE_MAJOR = 20;

export function parseNodeMajor(version: string): number | null {
  const m = version.trim().match(/^v?(\d+)/);
  if (!m) return null;
  const major = Number.parseInt(m[1], 10);
  return Number.isFinite(major) ? major : null;
}

export function isNodeVersionSupported(version: string): boolean {
  const major = parseNodeMajor(version);
  return major !== null && major >= QADBAK_MIN_NODE_MAJOR;
}

export function nodeVersionError(version: string): string | null {
  const major = parseNodeMajor(version);
  if (major === null) return `Unrecognized Node.js version: ${version}`;
  if (major < QADBAK_MIN_NODE_MAJOR) {
    return `Node.js ${QADBAK_MIN_NODE_MAJOR}+ required (found ${version}).`;
  }
  return null;
}
