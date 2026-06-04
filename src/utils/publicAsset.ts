export function resolvePublicAssetPath(
  path: string,
  baseUrl = import.meta.env.BASE_URL,
) {
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, '');

  return `${normalizedBase}${normalizedPath}`;
}
