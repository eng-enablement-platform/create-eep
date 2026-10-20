/** The template being downloaded, as the user asked for it. */
export type DownloadTarget = {
  /** Built-in template name, e.g. `web-dev-starter`. */
  templateName: string;
  /** GitHub repository, e.g. `eng-enablement-platform/eep-template-web-dev-starter`. */
  repository: string;
  /** The `--ref` value, when given. */
  ref?: string;
};

// Error codes Node's fetch (undici) reports when GitHub can't be reached at all.
const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
]);

// giget ends HTTP failures with the status, e.g. "Failed to download <url>: 404 Not Found".
const HTTP_STATUS_PATTERN = /: (\d{3})((?: [^:]*)?)$/;

const errorCodes = (error: unknown): string[] => {
  const codes: string[] = [];
  let current: unknown = error;
  // Walk the `cause` chain - giget wraps fetch's TypeError, which wraps the socket error.
  while (current instanceof Error) {
    if ('code' in current && typeof current.code === 'string') {
      codes.push(current.code);
    }
    current = current.cause;
  }
  return codes;
};

const isNetworkError = (error: unknown, message: string): boolean =>
  message.includes('fetch failed') ||
  errorCodes(error).some((code) => NETWORK_ERROR_CODES.has(code));

const explain = (
  status: number | undefined,
  statusText: string,
  target: DownloadTarget,
): string | undefined => {
  if (status === 404) {
    return target.ref === undefined
      ? `The ${target.templateName} template couldn't be found on GitHub. Try the latest create-eep: npx create-eep@latest`
      : `Couldn't find "${target.ref}" in the ${target.templateName} template. Check the branch, tag or commit exists: https://github.com/${target.repository}`;
  }
  if (status === 403 || status === 429) {
    return [
      "GitHub's download limit was reached (60 an hour without a token).",
      'Wait a few minutes, or use a GitHub token (with the GitHub CLI):',
      '  GIGET_AUTH=$(gh auth token) npx create-eep@latest',
    ].join('\n');
  }
  if (status === 401) {
    return 'GitHub rejected the token in GIGET_AUTH. Check it, or unset it to download without one.';
  }
  if (status !== undefined && status >= 500) {
    return `GitHub had a problem (${String(status)}${statusText}). Try again in a minute.`;
  }
  return undefined;
};

/**
 * Turns a failed template download into a message that says what went wrong
 * and how to fix it - giget's own errors are raw URLs and status codes. The
 * original error is kept on a `Details:` line for bug reports.
 *
 * @param error - What the downloader threw.
 * @param target - The template and `--ref` the user asked for.
 * @returns A message safe to show the user as-is.
 * @example
 * ```ts
 * describeDownloadError(new Error('Failed to download <url>: 404 Not Found'), { templateName: 'next-app', repository, ref: 'feat/x' });
 * // 'Couldn't find "feat/x" in the next-app template. ...\n\nDetails: Failed to download <url>: 404 Not Found'
 * ```
 */
export function describeDownloadError(
  error: unknown,
  target: DownloadTarget,
): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = HTTP_STATUS_PATTERN.exec(message);
  const status = match?.[1] === undefined ? undefined : Number(match[1]);

  const explanation = isNetworkError(error, message)
    ? "Couldn't reach GitHub. Check your internet connection (or proxy) and try again."
    : explain(status, match?.[2] ?? '', target);

  return explanation === undefined
    ? `Could not download the ${target.templateName} template: ${message}`
    : `${explanation}\n\nDetails: ${message}`;
}
