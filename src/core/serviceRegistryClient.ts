import { Client } from "../common/open-api/client";
import { ServiceRegistryResource } from "../common/open-api/sdk.gen";

import {
  CircuitBreakerTransitionResponse,
  ProtoRegistryEntry,
  ServiceMethod,
  ServiceRegistry,
} from "../common/open-api/types.gen";
import { handleSdkError } from "./helpers";

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
  public async getRegisteredServices(): Promise<ServiceRegistry[]> {
    try {
      const { data } = await ServiceRegistryResource.getRegisteredServices({
        client: this._client,
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, "Failed to get registered services");
    }
  }

  /**
   * Remove a service by name
   * @param name The name of the service to remove
   * @returns Promise that resolves when service is removed
   */
  public async removeService(name: string): Promise<void> {
    try {
      await ServiceRegistryResource.removeService({
        client: this._client,
        path: { name },
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, `Failed to remove service '${name}'`);
    }
  }

  /**
   * Get a service by name
   * @param name The name of the service to retrieve
   * @returns The requested service registry
   */
  public async getService(name: string): Promise<ServiceRegistry | undefined> {
    try {
      const { data } = await ServiceRegistryResource.getService({
        client: this._client,
        path: { name },
        throwOnError: true,
      });

      if (typeof data === "object") {
        return Object.keys(data).length ? data : undefined;
      }
      return undefined;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to get service '${name}'`);
    }
  }

  /**
   * Open the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async openCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse> {
    try {
      const { data } = await ServiceRegistryResource.openCircuitBreaker({
        client: this._client,
        path: { name },
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to open circuit breaker for service '${name}'`
      );
    }
  }

  /**
   * Close the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async closeCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse> {
    try {
      const { data } = await ServiceRegistryResource.closeCircuitBreaker({
        client: this._client,
        path: { name },
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to close circuit breaker for service '${name}'`
      );
    }
  }

  /**
   * Get circuit breaker status for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async getCircuitBreakerStatus(
    name: string
  ): Promise<CircuitBreakerTransitionResponse> {
    try {
      const { data } = await ServiceRegistryResource.getCircuitBreakerStatus({
        client: this._client,
        path: { name },
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get circuit breaker status for service '${name}'`
      );
    }
  }

  /**
   * Add or update a service registry
   * @param serviceRegistry The service registry to add or update
   * @returns Promise that resolves when service is added or updated
   */
  public async addOrUpdateService(
    serviceRegistry: ServiceRegistry
  ): Promise<void> {
    try {
      await ServiceRegistryResource.addOrUpdateService({
        client: this._client,
        body: serviceRegistry,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(error, "Failed to add or update service");
    }
  }

  /**
   * Add or update a service method
   * @param registryName The name of the registry
   * @param method The service method to add or update
   * @returns Promise that resolves when method is added or updated
   */
  public async addOrUpdateServiceMethod(
    registryName: string,
    method: ServiceMethod
  ): Promise<void> {
    try {
      await ServiceRegistryResource.addOrUpdateMethod({
        client: this._client,
        path: { registryName },
        body: method,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to add or update service method for registry '${registryName}'`
      );
    }
  }

  /**
   * Remove a service method
   * @param registryName The name of the registry
   * @param serviceName The name of the service
   * @param method The name of the method
   * @param methodType The type of the method
   * @returns Promise that resolves when method is removed
   */
  public async removeMethod(
    registryName: string,
    serviceName: string,
    method: string,
    methodType: string
  ): Promise<void> {
    try {
      await ServiceRegistryResource.removeMethod({
        client: this._client,
        path: { registryName },
        query: { serviceName, method, methodType },
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to remove method '${method}' from service '${serviceName}'`
      );
    }
  }

  /**
   * Get proto data
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @returns The proto file data as a Blob
   */
  public async getProtoData(
    registryName: string,
    filename: string
  ): Promise<Blob> {
    try {
      const { data } = await ServiceRegistryResource.getProtoData({
        client: this._client,
        path: { registryName, filename },
        throwOnError: true,
      });

      return data as unknown as Blob; // todo: remove casting after OpenApi spec is fixed
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get proto data '${filename}' from registry '${registryName}'`
      );
    }
  }

  /**
   * Set proto data
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @param data The proto file data
   * @returns Promise that resolves when proto data is set
   */
  public async setProtoData(
    registryName: string,
    filename: string,
    data: Blob
  ): Promise<void> {
    try {
      await ServiceRegistryResource.setProtoData({
        client: this._client,
        path: { registryName, filename },
        body: data as unknown as string, // todo: remove casting after OpenApi spec is fixed (byte -> binary)
        bodySerializer: (body: Blob) => body,
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to set proto data '${filename}' for registry '${registryName}'`
      );
    }
  }

  /**
   * Delete a proto file
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @returns Promise that resolves when proto file is deleted
   */
  public async deleteProto(
    registryName: string,
    filename: string
  ): Promise<void> {
    try {
      await ServiceRegistryResource.deleteProto({
        client: this._client,
        path: { registryName, filename },
        throwOnError: true,
      });
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to delete proto '${filename}' from registry '${registryName}'`
      );
    }
  }

  /**
   * Get all proto files for a registry
   * @param registryName The name of the registry
   * @returns List of proto registry entries
   */
  public async getAllProtos(
    registryName: string
  ): Promise<ProtoRegistryEntry[]> {
    try {
      const { data } = await ServiceRegistryResource.getAllProtos({
        client: this._client,
        path: { registryName },
        throwOnError: true,
      });
      return data;
    } catch (error: unknown) {
      handleSdkError(
        error,
        `Failed to get all protos for registry '${registryName}'`
      );
    }
  }

  /**
   * Discover service methods
   * @param name The name of the service
   * @param create Whether to create the discovered methods (defaults to false)
   * @returns The discovered service methods
   */
  public async discover(
    name: string,
    create = false
  ): Promise<ServiceMethod[]> {
    try {
      const { data } = await ServiceRegistryResource.discover({
        client: this._client,
        path: { name },
        query: { create },
        throwOnError: true,
      });

      return data;
    } catch (error: unknown) {
      handleSdkError(error, `Failed to discover service methods for '${name}'`);
    }
  }
}
