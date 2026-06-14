// Une clases condicionalmente (filtra falsy). Sin dependencias.
export function cn(...args) {
  return args.flat(Infinity).filter(Boolean).join(' ')
}
