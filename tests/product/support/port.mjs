export const DEFAULT_PRODUCT_PORT = 4321;

/** The preview port for the product tests: VELCRO_PRODUCT_PORT (an unprivileged integer) or the default. Anything else throws. */
export function productPort(env = process.env) {
  const raw = env.VELCRO_PRODUCT_PORT;
  if (raw === undefined || raw === '') return DEFAULT_PRODUCT_PORT;
  if (!/^[0-9]{1,5}$/.test(raw)) throw new Error('VELCRO_PRODUCT_PORT must be an integer from 1024 to 65535');
  const port = Number(raw);
  if (port < 1024 || port > 65535) throw new Error('VELCRO_PRODUCT_PORT must be an integer from 1024 to 65535');
  return port;
}
