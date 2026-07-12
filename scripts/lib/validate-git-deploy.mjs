/**
 * Git deploy URL and branch validation — prevent shell injection in git deploy.
 */

const BRANCH_RE = /^[a-zA-Z0-9._\/-]+$/;
const SHELL_METACHAR_RE = /[;&|`$<>()\\!\r\n\x00]/;

/**
 * @param {string} url
 */
export function assertGitRepoUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    throw new Error("Git repository URL is required.");
  }
  if (SHELL_METACHAR_RE.test(raw)) {
    throw new Error("Git repository URL contains invalid characters.");
  }
  if (
    !raw.startsWith("https://") &&
    !raw.startsWith("http://") &&
    !raw.startsWith("git@") &&
    !raw.startsWith("ssh://")
  ) {
    throw new Error("Git repository URL must use https, http, git@, or ssh://.");
  }
  return raw;
}

/**
 * @param {string} branch
 */
export function assertGitBranch(branch) {
  const raw = String(branch || "main").trim() || "main";
  if (!BRANCH_RE.test(raw)) {
    throw new Error("Invalid Git branch name.");
  }
  return raw;
}

/**
 * @param {string} step
 */
export function assertCiStep(step) {
  const raw = String(step || "").trim();
  if (!raw) {
    throw new Error("CI step cannot be empty.");
  }
  if (raw.length > 512) {
    throw new Error("CI step is too long.");
  }
  if (SHELL_METACHAR_RE.test(raw)) {
    throw new Error("CI step contains disallowed shell metacharacters.");
  }
  if (raw.startsWith("-")) {
    throw new Error("CI step cannot start with '-'.");
  }
  return raw;
}
