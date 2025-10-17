import { Client } from "../common/open-api/client";
import { ServiceRegistryResource } from "../common/open-api/sdk.gen";

import {
  CircuitBreakerTransitionResponse,
  ProtoRegistryEntry,
  ServiceMethod,
  ServiceRegistry,
} from "../common/open-api/types.gen";
import { errorMapper } from "./helpers";

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
  public async getRegisteredServices(): Promise<ServiceRegistry[] | undefined> {
    try {
      const response = await ServiceRegistryResource.getRegisteredServices({
        client: this._client,
      });

      return response.data;
    } catch (error: unknown) {
      throw errorMapper(error);
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
      });
    } catch (error: unknown) {
      throw errorMapper(error);
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
      });

      if (typeof data === "object") {
        return Object.keys(data).length ? data : undefined;
      }
      return undefined;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Open the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async openCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    try {
      const { data } = await ServiceRegistryResource.openCircuitBreaker({
        client: this._client,
        path: { name },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Close the circuit breaker for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async closeCircuitBreaker(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    try {
      const { data } = await ServiceRegistryResource.closeCircuitBreaker({
        client: this._client,
        path: { name },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Get circuit breaker status for a service
   * @param name The name of the service
   * @returns Response with circuit breaker status
   */
  public async getCircuitBreakerStatus(
    name: string
  ): Promise<CircuitBreakerTransitionResponse | undefined> {
    try {
      const { data } = await ServiceRegistryResource.getCircuitBreakerStatus({
        client: this._client,
        path: { name },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Add or update a service registry
   * @param serviceRegistry The service registry to add or update
   * @returns Promise that resolves when service is added or updated
   */
  public async addOrUpdateService(serviceRegistry: ServiceRegistry): Promise<void> {
    try {
      await ServiceRegistryResource.addOrUpdateService({
        client: this._client,
        body: serviceRegistry,
      });
    } catch (error: unknown) {
      throw errorMapper(error);
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
      });
    } catch (error: unknown) {
      throw errorMapper(error);
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
      });
    } catch (error: unknown) {
      throw errorMapper(error);
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
  ): Promise<Blob | undefined> {
    try {
      const { data } = await ServiceRegistryResource.getProtoData({
        client: this._client,
        path: { registryName, filename },
      });

      return data as unknown as Blob; // todo: remove casting after OpenApi spec is fixed
    } catch (error: unknown) {
      throw errorMapper(error);
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
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Delete a proto file
   * @param registryName The name of the registry
   * @param filename The name of the proto file
   * @returns Promise that resolves when proto file is deleted
   */
  public async deleteProto(registryName: string, filename: string): Promise<void> {
    try {
      await ServiceRegistryResource.deleteProto({
        client: this._client,
        path: { registryName, filename },
      });
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }

  /**
   * Get all proto files for a registry
   * @param registryName The name of the registry
   * @returns List of proto registry entries
   */
  public async getAllProtos(
    registryName: string
  ): Promise<ProtoRegistryEntry[] | undefined> {
    try {
      const { data } = await ServiceRegistryResource.getAllProtos({
        client: this._client,
        path: { registryName },
      });
      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
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
  ): Promise<ServiceMethod[] | undefined> {
    try {
      const { data } = await ServiceRegistryResource.discover({
        client: this._client,
        path: { name },
        query: { create },
      });

      return data;
    } catch (error: unknown) {
      throw errorMapper(error);
    }
  }
}
