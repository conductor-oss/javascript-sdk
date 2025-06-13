import {beforeAll, afterEach, describe, expect, jest, test} from "@jest/globals";
import {ServiceRegistryClient} from "../serviceRegistryClient";
import {orkesConductorClient} from "../../orkes";
import {ServiceType} from "../../common/open-api/models/ServiceRegistryModels";
import * as fs from 'fs';
import * as path from 'path';

describe("ServiceRegistryClient", () => {
    const clientPromise = orkesConductorClient({useEnvVars: true});
    let serviceRegistryClient: ServiceRegistryClient;
    const testServicesToCleanup: string[] = [];

    beforeAll(async () => {
        const client = await clientPromise;
        serviceRegistryClient = new ServiceRegistryClient(client);
    });

    afterEach(async () => {
        // Clean up any services created during tests
        for (const serviceName of testServicesToCleanup) {
            try {
                await serviceRegistryClient.removeService(serviceName);
            } catch (e) {
                // Ignore cleanup errors - service might already be deleted or not exist
                console.debug(`Failed to cleanup service ${serviceName}:`, e);
            }
        }
        testServicesToCleanup.length = 0;
    });

    jest.setTimeout(15000);

    test("Should add and retrieve a service registry", async () => {
        // Create a test service registry
        const testServiceRegistry = {
            name: "test_service_registry",
            type: ServiceType.HTTP,
            serviceURI: "http://localhost:8081/api-docs",
            config: {
                circuitBreakerConfig: {
                    failureRateThreshold: 50.0,
                    slidingWindowSize: 100,
                    minimumNumberOfCalls: 100,
                    waitDurationInOpenState: 1000,
                    permittedNumberOfCallsInHalfOpenState: 100,
                    slowCallRateThreshold: 50.0,
                    slowCallDurationThreshold: 100,
                    automaticTransitionFromOpenToHalfOpenEnabled: true,
                    maxWaitDurationInHalfOpenState: 1
                }
            }
        };

        // Add service to cleanup list
        testServicesToCleanup.push(testServiceRegistry.name);

        // Register the service registry
        await expect(
            serviceRegistryClient.addOrUpdateService(testServiceRegistry)
        ).resolves.not.toThrowError();

        // Retrieve the service registry from the API
        const retrievedServiceRegistry = await serviceRegistryClient.getService(
            testServiceRegistry.name
        );

        // Verify the service registry properties
        expect(retrievedServiceRegistry.name).toEqual(testServiceRegistry.name);
        expect(retrievedServiceRegistry.type).toEqual(testServiceRegistry.type);
        expect(retrievedServiceRegistry.serviceURI).toEqual(testServiceRegistry.serviceURI);

        // Verify circuit breaker config
        const expectedConfig = testServiceRegistry.config.circuitBreakerConfig;
        const actualConfig = retrievedServiceRegistry.config?.circuitBreakerConfig;

        expect(actualConfig?.failureRateThreshold).toEqual(expectedConfig.failureRateThreshold);
        expect(actualConfig?.slidingWindowSize).toEqual(expectedConfig.slidingWindowSize);
        expect(actualConfig?.minimumNumberOfCalls).toEqual(expectedConfig.minimumNumberOfCalls);
        expect(actualConfig?.waitDurationInOpenState).toEqual(expectedConfig.waitDurationInOpenState);
        expect(actualConfig?.permittedNumberOfCallsInHalfOpenState).toEqual(expectedConfig.permittedNumberOfCallsInHalfOpenState);
        expect(actualConfig?.slowCallRateThreshold).toEqual(expectedConfig.slowCallRateThreshold);
        expect(actualConfig?.slowCallDurationThreshold).toEqual(expectedConfig.slowCallDurationThreshold);
        expect(actualConfig?.automaticTransitionFromOpenToHalfOpenEnabled).toEqual(expectedConfig.automaticTransitionFromOpenToHalfOpenEnabled);
        expect(actualConfig?.maxWaitDurationInHalfOpenState).toEqual(expectedConfig.maxWaitDurationInHalfOpenState);
    });

    test("Should add and remove a service registry", async () => {
        // Create a test service registry
        const testServiceRegistry = {
            name: "test_service_registry_to_remove",
            type: ServiceType.HTTP,
            serviceURI: "http://localhost:8081"
        };

        // Add service to cleanup list
        testServicesToCleanup.push(testServiceRegistry.name);

        // Register the service registry
        await expect(
            serviceRegistryClient.addOrUpdateService(testServiceRegistry)
        ).resolves.not.toThrowError();

        // Verify it was added
        await expect(
            serviceRegistryClient.getService(testServiceRegistry.name)
        ).resolves.not.toBeNull();

        // Remove the service registry
        await expect(
            serviceRegistryClient.removeService(testServiceRegistry.name)
        ).resolves.not.toThrowError();

        // Verify it was removed - should throw an error when trying to get it
        await expect(
            serviceRegistryClient.getService(testServiceRegistry.name)
        ).resolves.toBeUndefined();
    });

    test("Should add a service method to a registry", async () => {
        // Create a test service registry
        const testServiceRegistry = {
            name: "test_service_registry_with_method",
            type: ServiceType.HTTP,
            serviceURI: "http://localhost:8082"
        };

        // Add service to cleanup list
        testServicesToCleanup.push(testServiceRegistry.name);

        // Register the service registry
        await expect(
            serviceRegistryClient.addOrUpdateService(testServiceRegistry)
        ).resolves.not.toThrowError();

        // Create a test service method
        const testServiceMethod = {
            operationName: "testOperation",
            methodName: "testMethod",
            methodType: "GET",
            inputType: "application/json",
            outputType: "application/json",
            exampleInput: {
                key1: "value1",
                key2: "value2"
            }
        };

        // Add the service method
        await expect(
            serviceRegistryClient.addOrUpdateServiceMethod(testServiceRegistry.name, testServiceMethod)
        ).resolves.not.toThrowError();

        // Get the service registry to verify method was added
        const retrievedServiceRegistry = await serviceRegistryClient.getService(
            testServiceRegistry.name
        );

        // Check if methods array exists and contains our method
        expect(retrievedServiceRegistry.methods).toBeDefined();

        // Find our method in the array
        const foundMethod = retrievedServiceRegistry.methods?.find(
            method => method.methodName === testServiceMethod.methodName
        );

        expect(foundMethod).toBeDefined();
        expect(foundMethod?.operationName).toEqual(testServiceMethod.operationName);
        expect(foundMethod?.methodType).toEqual(testServiceMethod.methodType);
        expect(foundMethod?.inputType).toEqual(testServiceMethod.inputType);
        expect(foundMethod?.outputType).toEqual(testServiceMethod.outputType);
    });

    test("Should discover methods from a http service", async () => {
        // Create a test service registry for discovery
        const testServiceRegistry = {
            name: "test_service_registry_discovery",
            type: ServiceType.HTTP,
            serviceURI: "http://localhost:8081/api-docs"
        };

        // Add service to cleanup list
        testServicesToCleanup.push(testServiceRegistry.name);

        // Register the service registry
        await serviceRegistryClient.addOrUpdateService(testServiceRegistry);

        // Attempt to discover methods - this will fail the test if discovery fails
        const discoveredMethods = await serviceRegistryClient.discover(
            testServiceRegistry.name,
            true
        );

        // Verify that we discovered methods
        expect(discoveredMethods).toBeDefined();
        expect(Array.isArray(discoveredMethods)).toBe(true);
        expect(discoveredMethods.length).toBeGreaterThan(0);

        if (discoveredMethods.length > 0) {
            // Check that the discovered methods have the expected properties
            const firstMethod = discoveredMethods[0];
            expect(firstMethod.methodName).toBeDefined();
            expect(firstMethod.methodType).toBeDefined();
        }
    });

    test("Should discover methods from a gRPC service", async () => {
        // Create a test service registry for discovery
        const testServiceRegistry = {
            name: "test_gRPC_service_registry_discovery",
            type: ServiceType.gRPC,
            serviceURI: "localhost:50051"
        };

        // Add service to cleanup list
        testServicesToCleanup.push(testServiceRegistry.name);

        // Register the service registry
        await serviceRegistryClient.addOrUpdateService(testServiceRegistry);

        const filePath = path.join(__dirname, 'metadata', 'compiled.bin');
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], {type: 'application/octet-stream'});

        // Set proto data
        await serviceRegistryClient.setProtoData(testServiceRegistry.name, 'compiled.bin', blob);

        const serviceMethods = await serviceRegistryClient.getService(testServiceRegistry.name);
        const methods = serviceMethods.methods;

        expect(serviceMethods).toBeDefined();
        expect(methods?.length).toBeGreaterThan(0);
        expect(Array.isArray(methods)).toBe(true);

        if (methods) {
            const firstMethod = methods[0];
            expect(firstMethod.methodName).toBeDefined();
            expect(firstMethod.methodType).toBeDefined();
        }
    });
});