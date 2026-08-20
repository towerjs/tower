const services = new Map<string, unknown>()

export function registerService(name: string, service: unknown) {
  services.set(name, service)
}

export function getService<T>(name: string): T | undefined {
  return services.get(name) as T | undefined
}
