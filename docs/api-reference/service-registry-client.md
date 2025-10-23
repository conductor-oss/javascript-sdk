# ServiceRegistryClient API Reference

The `ServiceRegistryClient` manages service registrations and circuit breakers.

## Constructor

### `new ServiceRegistryClient(client: ConductorClient)`

Creates a new `ServiceRegistryClient`.

**Parameters:**

-   `client` (`ConductorClient`): An instance of `ConductorClient`.

---

## Methods

### `getRegisteredServices(): Promise<ServiceRegistry[]>`

Retrieves all registered services.

**Returns:**

-   `Promise<ServiceRegistry[]>`: An array of all registered services.

---

### `removeService(name: string): Promise<void>`

Removes a service by name.

**Parameters:**

-   `name` (`string`): The name of the service to remove.

**Returns:**

-   `Promise<void>`

---

### `getService(name: string): Promise<ServiceRegistry>`

Gets a service by name.

**Parameters:**

-   `name` (`string`): The name of the service to retrieve.

**Returns:**

-   `Promise<ServiceRegistry>`: The requested service registry.

---

### `openCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse>`

Opens the circuit breaker for a service.

**Parameters:**

-   `name` (`string`): The name of the service.

**Returns:**

-   `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `closeCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse>`

Closes the circuit breaker for a service.

**Parameters:**

-   `name` (`string`): The name of the service.

**Returns:**

-   `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `getCircuitBreakerStatus(name: string): Promise<CircuitBreakerTransitionResponse>`

Gets the circuit breaker status for a service.

**Parameters:**

-   `name` (`string`): The name of the service.

**Returns:**

-   `Promise<CircuitBreakerTransitionResponse>`: A response with the circuit breaker status.

---

### `addOrUpdateService(serviceRegistry: ServiceRegistry): Promise<void>`

Adds or updates a service registry.

**Parameters:**

-   `serviceRegistry` (`ServiceRegistry`): The service registry to add or update.

**Returns:**

-   `Promise<void>`

---

### `addOrUpdateServiceMethod(registryName: string, method: ServiceMethod): Promise<void>`

Adds or updates a service method.

**Parameters:**

-   `registryName` (`string`): The name of the registry.
-   `method` (`ServiceMethod`): The service method to add or update.

**Returns:**

-   `Promise<void>`

---

### `removeMethod(registryName: string, serviceName: string, method: string, methodType: string): Promise<void>`

Removes a service method.

**Parameters:**

-   `registryName` (`string`): The name of the registry.
-   `serviceName` (`string`): The name of the service.
-   `method` (`string`): The name of the method.
-   `methodType` (`string`): The type of the method.

**Returns:**

-   `Promise<void>`

---

### `getProtoData(registryName: string, filename: string): Promise<Blob>`

Gets proto data.

**Parameters:**

-   `registryName` (`string`): The name of the registry.
-   `filename` (`string`): The name of the proto file.

**Returns:**

-   `Promise<Blob>`: The proto file data as a `Blob`.

---

### `setProtoData(registryName: string, filename: string, data: Blob): Promise<void>`

Sets proto data.

**Parameters:**

-   `registryName` (`string`): The name of the registry.
-   `filename` (`string`): The name of the proto file.
-   `data` (`Blob`): The proto file data.

**Returns:**

-   `Promise<void>`

---

### `deleteProto(registryName: string, filename: string): Promise<void>`

Deletes a proto file.

**Parameters:**

-   `registryName` (`string`): The name of the registry.
-   `filename` (`string`): The name of the proto file.

**Returns:**

-   `Promise<void>`

---

### `getAllProtos(registryName: string): Promise<ProtoRegistryEntry[]>`

Gets all proto files for a registry.

**Parameters:**

-   `registryName` (`string`): The name of the registry.

**Returns:**

-   `Promise<ProtoRegistryEntry[]>`: A list of proto registry entries.

---

### `discover(name: string, create: boolean = false): Promise<ServiceMethod[]>`

Discovers service methods.

**Parameters:**

-   `name` (`string`): The name of the service.
-   `create` (`boolean`, optional): Whether to create the discovered methods. Defaults to `false`.

**Returns:**

-   `Promise<ServiceMethod[]>`: The discovered service methods.

---

## Type Definitions

### `ServiceRegistry`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the service. |
| `type` | `ServiceType` | The type of the service. |
| `serviceURI` | `string` | The URI of the service. |
| `methods` | `ServiceMethod[]` | The methods of the service. |
| `requestParams` | `RequestParam[]` | The request parameters of the service. |
| `config` | `ServiceRegistryConfig` | The configuration of the service. |

### `ServiceType`
`ServiceType` is an enum that can be one of the following values: `'HTTP'`, `'MCP_REMOTE'`, `'gRPC'`.

### `ServiceMethod`
| Property | Type | Description |
| --- | --- | --- |
| `id` | `number` | The ID of the method. |
| `operationName` | `string` | The name of the operation. |
| `methodName` | `string` | The name of the method. |
| `methodType` | `string` | The type of the method. |
| `inputType` | `string` | The input type of the method. |
| `outputType` | `string` | The output type of the method. |
| `requestParams` | `RequestParam[]` | The request parameters of the method. |
| `exampleInput` | `Record<string, any>` | An example input for the method. |

### `RequestParam`
| Property | Type | Description |
| --- | --- | --- |
| `name` | `string` | The name of the parameter. |
| `type` | `string` | The type of the parameter. |
| `required` | `boolean` | Whether the parameter is required. |
| `schema` | `RequestParamSchema` | The schema of the parameter. |

### `RequestParamSchema`
| Property | Type | Description |
| --- | --- | --- |
| `type` | `string` | The type of the schema. |
| `format` | `string` | The format of the schema. |
| `defaultValue` | `any` | The default value of the schema. |

### `ServiceRegistryConfig`
| Property | Type | Description |
| --- | --- | --- |
| `circuitBreakerConfig` | `OrkesCircuitBreakerConfig` | The circuit breaker configuration. |

### `OrkesCircuitBreakerConfig`
| Property | Type | Description |
| --- | --- | --- |
| `failureRateThreshold` | `number` | The failure rate threshold. |
| `slidingWindowSize` | `number` | The sliding window size. |
| `minimumNumberOfCalls` | `number` | The minimum number of calls. |
| `waitDurationInOpenState` | `number` | The wait duration in the open state. |
| `permittedNumberOfCallsInHalfOpenState`| `number` | The permitted number of calls in the half-open state. |
| `slowCallRateThreshold` | `number` | The slow call rate threshold. |
| `slowCallDurationThreshold` | `number` | The slow call duration threshold. |
| `automaticTransitionFromOpenToHalfOpenEnabled` | `boolean` | Whether automatic transition from open to half-open is enabled. |
| `maxWaitDurationInHalfOpenState` | `number` | The maximum wait duration in the half-open state. |

### `CircuitBreakerTransitionResponse`
| Property | Type | Description |
| --- | --- | --- |
| `service` | `string` | The name of the service. |
| `previousState` | `string` | The previous state of the circuit breaker. |
| `currentState` | `string` | The current state of the circuit breaker. |
| `transitionTimestamp` | `number` | The timestamp of the transition. |
| `message` | `string` | The transition message. |

### `ProtoRegistryEntry`
| Property | Type | Description |
| --- | --- | --- |
| `filename` | `string` | The name of the proto file. |
| `serviceName` | `string` | The name of the service. |
| `data` | `string` | The proto file data. |
