export function apiUrl(path) {
  return path.startsWith("/") ? path : `/${path}`;
}
