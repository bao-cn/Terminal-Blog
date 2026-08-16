export const SITE_CONFIG_VIRTUAL_PATH = "config";

export function isSiteConfigVirtualPath(value: string | undefined) {
  if (!value) return false;
  return (
    value.trim().replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase() === SITE_CONFIG_VIRTUAL_PATH
  );
}
