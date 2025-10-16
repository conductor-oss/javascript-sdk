import { Client } from "../common/open-api/client";
import { ServiceRegistryResource } from "../common/open-api/sdk.gen";

import {
  CircuitBreakerTransitionResponse,
  ProtoRegistryEntry,
  ServiceMethod,
  ServiceRegistry,
} from "../common/open-api/types.gen";
import { tryCatchReThrow } from "./helpers";

/**
 * Client for interacting with the Service Registry API
 */
export class ServiceRegistryClient {
  public readonly _client: Client;

  constructor(client: Client) {
    this._client = client;
  }

  /**
   * Retrieve all registered services
   * @returns Array of all registered services
   */
  public getRegisteredServices(): Promise<ServiceRegistry[] | undefined> {
    return tryCatchReThrow(async () => {
      const response = await ServiceRegistryResource.getRegisteredServices({
        client: this._client,
      });

      return response.data;
    });
  }

  /**
   * Remove a service by name
   * @param name The name of the service to remove
   * @returns Promise that resolves when service is removed
   */
  public removeService(name: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.removeService({
        client: this._client,
        path: { name },
      });
    });
  }

  /**
   * Get a service by name
   * @param name The name of the service to retrieve
   * @returns The requested service registry
   */
  public getService(name: string): Promise<ServiceRegistry | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.getService({
        client: this._client,
        path: { name },
      });

      if (typeof data === "object") {
        return Object.keys(data).length ? data : undefined;
      }
      return undefined;
    });
  }

  /**
   * Open the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public openCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.openCircuitBreaker({
        client: this._client,
        path: { name },
      });

      return data;
    });
  }

  /**
   * Close the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public closeCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.closeCircuitBreaker({
        client: this._client,
        path: { name },
      });

      return data;
    });
  }

  /**
   * Get circuit breaker status for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public getCircuitBreakerStatus(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.getCircuitBreakerStatus({
        client: this._client,
        path: { name },
      });

      return data;
    });
  }

  /**
   * Add or update a service registry
   * @param serviceRegistry The service registry to add or update
   * @returns Promise that resolves when service is added or updated
   */
  public addOrUpdateService(serviceRegistry: ServiceRegistry): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.addOrUpdateService({
        client: this._client,
        body: serviceRegistry,
      });
    });
  }

  /**
   * Add or update a service method
   * @param registryName The name of the registry
   * @param method The service method to add or update
   * @returns Promise that resolves when method is added or updated
   */
  public addOrUpdateServiceMethod(
    registryName: string,
    method: ServiceMethod
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.addOrUpdateMethod({
        client: this._client,
        path: { registryName },
        body: method,
      });
    });
  }

  /**
   * Remove a service method
   * @param registryName The name of the registry
   * @param serviceName The name of the service
   * @param method The name of the method
   * @param methodType The type of the method
   * @returns Promise that resolves when method is removed
   */
  public removeMethod(
    registryName: string,
    serviceName: string,
    method: string,
    methodType: string
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.removeMethod({
        client: this._client,
        path: { registryName },
        query: { serviceName, method, methodType },
      });
    });
  }

  /**
   * Get proto data
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @returns The proto file data as a Blob
   */
  public getProtoData(
    registryName: string,
    filename: string
  ): Promise<Blob | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.getProtoData({
        client: this._client,
        path: { registryName, filename },
      });

      return data as unknown as Blob; //todo: remove casting after OpenApi spec is fixed
    });
  }

  /**
   * Set proto data
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @param data The proto file data
   * @returns Promise that resolves when proto data is set
   */
  public setProtoData(
    registryName: string,
    filename: string,
    data: Blob
  ): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.setProtoData({
        client: this._client,
        path: { registryName, filename },
        body: data as unknown as string, // todo: remove casting after OpenApi spec is fixed (byte -> binary)
        bodySerializer: (body: Blob) => body,
      });
    });
  }

  /**
   * Delete a proto file
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @returns Promise that resolves when proto file is deleted
   */
  public deleteProto(registryName: string, filename: string): Promise<void> {
    return tryCatchReThrow(async () => {
      await ServiceRegistryResource.deleteProto({
        client: this._client,
        path: { registryName, filename },
      });
    });
  }

  /**
   * Get all proto files for a registry
   * @param registryName The name of the registry
   * @returns List of proto registry entries
   */
  public getAllProtos(
    registryName: string
  ): Promise<ProtoRegistryEntry[] | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.getAllProtos({
        client: this._client,
        path: { registryName },
      });
      return data;
    });
  }

  /**
   * Discover service methods
   * @param name The name of the service
   * @param create Whether to create the discovered methods (defaults to false)
   * @returns The discovered service methods
   */
  public discover(
    name: string,
    create = false
  ): Promise<ServiceMethod[] | undefined> {
    return tryCatchReThrow(async () => {
      const { data } = await ServiceRegistryResource.discover({
        client: this._client,
        path: { name },
        query: { create },
      });

      return data;
    });
  }
}
