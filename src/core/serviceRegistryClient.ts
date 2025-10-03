import { ConductorClient } from "../common";

import {
    CircuitBreakerTransitionResponse, ProtoRegistryEntry,
    ServiceMethod,
    ServiceRegistry
} from "../common/open-api/models/ServiceRegistryModels";
import {tryCatchReThrow} from "./helpers";

/**
 * Client for interacting with the Service Registry API
 */
export class ServiceRegistryClient {
    public readonly _client: ConductorClient;

    constructor(client: ConductorClient) {
        this._client = client;
    }

    /**
     * Retrieve all registered services
     * @returns Array of all registered services
     */
    public getRegisteredServices(): Promise<ServiceRegistry[]> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.getRegisteredServices()
        );
    }

    /**
     * Remove a service by name
     * @param name The name of the service to remove
     * @returns Promise that resolves when service is removed
     */
    public removeService(name: string): Promise<void> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.removeService(name)
        );
    }

    /**
     * Get a service by name
     * @param name The name of the service to retrieve
     * @returns The requested service registry
     */
    public getService(name: string): Promise<ServiceRegistry> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.getService(name)
        );
    }

    /**
     * Open the circuit breaker for a service
     * @param name The name of the service
     * @returns Response with circuit breaker status
     */
    public openCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.openCircuitBreaker(name)
        );
    }

    /**
     * Close the circuit breaker for a service
     * @param name The name of the service
     * @returns Response with circuit breaker status
     */
    public closeCircuitBreaker(name: string): Promise<CircuitBreakerTransitionResponse> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.closeCircuitBreaker(name)
        );
    }

    /**
     * Get circuit breaker status for a service
     * @param name The name of the service
     * @returns Response with circuit breaker status
     */
    public getCircuitBreakerStatus(name: string): Promise<CircuitBreakerTransitionResponse> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.getCircuitBreakerStatus(name)
        );
    }

    /**
     * Add or update a service registry
     * @param serviceRegistry The service registry to add or update
     * @returns Promise that resolves when service is added or updated
     */
    public addOrUpdateService(serviceRegistry: ServiceRegistry): Promise<void> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.addOrUpdateService(serviceRegistry)
        );
    }

    /**
     * Add or update a service method
     * @param registryName The name of the registry
     * @param method The service method to add or update
     * @returns Promise that resolves when method is added or updated
     */
    public addOrUpdateServiceMethod(registryName: string, method: ServiceMethod): Promise<void> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.addOrUpdateServiceMethod(registryName, method)
        );
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
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.removeMethod(registryName, serviceName, method, methodType)
        );
    }

    /**
     * Get proto data
     * @param registryName The name of the registry
     * @param filename The name of the proto file
     * @returns The proto file data as a Blob
     */
    public getProtoData(registryName: string, filename: string): Promise<Blob> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.getProtoData(registryName, filename)
        );
    }

    /**
     * Set proto data
     * @param registryName The name of the registry
     * @param filename The name of the proto file
     * @param data The proto file data
     * @returns Promise that resolves when proto data is set
     */
    public setProtoData(registryName: string, filename: string, data: Blob): Promise<void> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.setProtoData(registryName, filename, data)
        );
    }

    /**
     * Delete a proto file
     * @param registryName The name of the registry
     * @param filename The name of the proto file
     * @returns Promise that resolves when proto file is deleted
     */
    public deleteProto(registryName: string, filename: string): Promise<void> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.deleteProto(registryName, filename)
        );
    }

    /**
     * Get all proto files for a registry
     * @param registryName The name of the registry
     * @returns List of proto registry entries
     */
    public getAllProtos(registryName: string): Promise<ProtoRegistryEntry[]> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.getAllProtos(registryName)
        );
    }

    /**
     * Discover service methods
     * @param name The name of the service
     * @param create Whether to create the discovered methods (defaults to false)
     * @returns The discovered service methods
     */
    public discover(name: string, create = false): Promise<ServiceMethod[]> {
        return tryCatchReThrow(() =>
            this._client.serviceRegistryResource.discover(name, create)
        );
    }
}