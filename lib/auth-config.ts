export const defaultRootPassword = "root";

export function resolveBootstrapRootPassword(configuredPassword = process.env.TERMINAL_ROOT_PASSWORD) {
  return configuredPassword?.trim() || defaultRootPassword;
}
