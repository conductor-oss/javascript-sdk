# ServiceRegistryClient API Reference

The `ServiceRegistryClient` manages service registrations and circuit breakers.

## Constructor

### `new ServiceRegistryClient(client: Client)`

Creates a new `ServiceRegistryClient`.

**Parameters:**

- `client` (`Client`): An instance of `Client`.

---

## Methods

### `getRegisteredServices(): Promise<ServiceRegistry[]>`

Retrieves all registered services.

**Returns:**

- `Promise<ServiceRegistry[]>`: An array of all registered services.

---

### `removeService(name: string): Promise<void>`

Removes a service by name.

**Parameters:**

- `name` (`string`): The name of the service to remove.

**Returns:**

- `Promise<void>`

---

### `getService(name: string): Promise<ServiceRegistry>`

Gets a service by name.

**Parameters:**

- `name` (`string`): The name of the service to retrieve.

**Returns:**

- `Promise<ServiceRegistry>`: The requested service registry.

---

### `openCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse>`

Opens the circuit breaker for a service.

**Parameters:**

- `name` (`string`): The name of the service.

**Returns:**

- `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `closeCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse>`

Closes the circuit breaker for a service.

**Parameters:**

- `name` (`string`): The name of the service.

**Returns:**

- `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `getCircuitBreakerStatus(name: string): Promise<CircuitBreakerTransitionResponse>`

Gets the circuit breaker status for a service.

**Parameters:**

- `name` (`string`): The name of the service.

**Returns:**

- `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `addOrUpdateService(serviceRegistry: ServiceRegistry): Promise<void>`

Adds or updates a service registry.

**Parameters:**

- `serviceRegistry` (`ServiceRegistry`): The service registry to add or update.

**Returns:**

- `Promise<void>`

---

### `addOrUpdateServiceMethod(registryName: string, method: ServiceMethod): Promise<void>`

Adds or updates a service method.

**Parameters:**

- `registryName` (`string`): The name of the registry.
- `method` (`ServiceMethod`): The service method to add or update.

**Returns:**

- `Promise<void>`

---

### `removeMethod(registryName: string, serviceName: string, method: string, methodType: string): Promise<void>`

Removes a service method.

**Parameters:**

- `registryName` (`string`): The name of the registry.
- `serviceName` (`string`): The name of the service.
- `method` (`string`): The name of the method.
- `methodType` (`string`): The type of the method.

**Returns:**

- `Promise<void>`

---

### `getProtoData(registryName: string, filename: string): Promise<Blob>`

Gets proto data.

**Parameters:**

- `registryName` (`string`): The name of the registry.
- `filename` (`string`): The name of the proto file.

**Returns:**

- `Promise<Blob>`: The proto file data as a `Blob`.

---

### `setProtoData(registryName: string, filename: string, data: Blob): Promise<void>`

Sets proto data.

**Parameters:**

- `registryName` (`string`): The name of the registry.
- `filename` (`string`): The name of the proto file.
- `data` (`Blob`): The proto file data.

**Returns:**

- `Promise<void>`

---

### `deleteProto(registryName: string, filename: string): Promise<void>`

Deletes a proto file.

**Parameters:**

- `registryName` (`string`): The name of the registry.
- `filename` (`string`): The name of the proto file.

**Returns:**

- `Promise<void>`

---

### `getAllProtos(registryName: string): Promise<ProtoRegistryEntry[]>`

Gets all proto files for a registry.

**Parameters:**

- `registryName` (`string`): The name of the registry.

**Returns:**

- `Promise<ProtoRegistryEntry[]>`: A list of proto registry entries.

---

### `discover(name: string, create: boolean = false): Promise<ServiceMethod[]>`

Discovers service methods.

**Parameters:**

- `name` (`string`): The name of the service.
- `create` (`boolean`, optional): Whether to create the discovered methods. Defaults to `false`.

**Returns:**

- `Promise<ServiceMethod[]>`: The discovered service methods.

---

## Type Definitions

### `ServiceType`

```typescript
export enum ServiceType {
  HTTP = "HTTP",
  MCP_REMOTE = "MCP_REMOTE",
  gRPC = "gRPC",
}
```

### `ServiceRegistry`

```typescript
export type ServiceRegistry = {
  circuitBreakerEnabled?: boolean;
  config?: Config;
  methods?: ServiceMethod[];
  name?: string;
  requestParams?: RequestParam[];
  serviceURI?: string;
  type?: "HTTP" | "gRPC" | "MCP_REMOTE";
};
```

### `ServiceMethod`

```typescript
export type ServiceMethod = {
  exampleInput?: {
    [key: string]: unknown;
  };
  id?: number;
  inputType?: string;
  methodName?: string;
  methodType?: string;
  operationName?: string;
  outputType?: string;
  requestParams?: RequestParam[];
};
```

### `CircuitBreakerTransitionResponse`

```typescript
export type CircuitBreakerTransitionResponse = {
  currentState?: string;
  message?: string;
  previousState?: string;
  service?: string;
  transitionTimestamp?: number;
};
```

### `ProtoRegistryEntry`

```typescript
export type ProtoRegistryEntry = {
  data?: string;
  filename?: string;
  serviceName?: string;
};
```

### `Config`

```typescript
export type Config = {
  circuitBreakerConfig?: OrkesCircuitBreakerConfig;
};
```

### `OrkesCircuitBreakerConfig`

```typescript
export type OrkesCircuitBreakerConfig = {
  automaticTransitionFromOpenToHalfOpenEnabled?: boolean;
  failureRateThreshold?: number;
  maxWaitDurationInHalfOpenState?: number;
  minimumNumberOfCalls?: number;
  permittedNumberOfCallsInHalfOpenState?: number;
  slidingWindowSize?: number;
  slowCallDurationThreshold?: number;
  slowCallRateThreshold?: number;
  waitDurationInOpenState?: number;
};
```

### `RequestParam`

```typescript
export type RequestParam = {
  name?: string;
  required?: boolean;
  schema?: Schema;
  type?: string;
};
```

### `Schema`

```typescript
export type Schema = {
  defaultValue?: {
    [key: string]: unknown;
  };
  format?: string;
  type?: string;
};
```
