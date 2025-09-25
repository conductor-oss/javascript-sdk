import * as fs from 'fs';
import * as path from 'path';
import {WorkflowDef} from "../../src/common";
import {MetadataClient} from "../../src/core/metadataClient";
import {WorkflowExecutor} from "../../src/core/executor";

export class TestUtil {
    private static metadataClient: MetadataClient;

    public static setMetadataClient(metadataClient: MetadataClient): void {
        this.metadataClient = metadataClient;
    }
    /**
     * Read and parse workflow definition from JSON file
     */
    public static getWorkflowDef(filePath: string): WorkflowDef {
        try {
            const fullPath = path.join(__dirname, filePath);
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            return JSON.parse(fileContent) as WorkflowDef;
        } catch (error) {
            throw new Error(`Failed to read workflow definition from ${filePath}: ${error}`);
        }
    }

    /**
     * Register a single workflow from JSON file
     */
    public static async registerWorkflow(workflowName: string): Promise<void> {
        try {
            const workflowDef = this.getWorkflowDef(`../common/metadata/${workflowName}.json`);
            await this.metadataClient.registerWorkflowDef(workflowDef, true);
            console.log(`✓ Registered workflow: ${workflowName}`);
        } catch (error) {
            throw new Error(`Failed to register workflow ${workflowName}: ${error}`);
        }
    }

    // Helper function to wait for workflow completion
    public static async waitForWorkflowCompletion(
        executor: WorkflowExecutor,
        workflowId: string,
        maxWaitMs: number = 300000, // 5 minutes default
        pollIntervalMs: number = 100 // 100ms default
    ) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            try {
                const workflowStatus = await executor.getWorkflow(workflowId, true);

                // Check if workflow is in a terminal state
                if (['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(workflowStatus.status!)) {
                    console.debug(`Workflow ${workflowId} reached terminal state: ${workflowStatus.status}`);
                    return workflowStatus;
                }

                console.debug(`Workflow ${workflowId} status: ${workflowStatus.status}, waiting...`);

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

            } catch (error) {
                console.warn(`Error checking workflow status for ${workflowId}:`, error);
                await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
            }
        }

        throw new Error(`Workflow ${workflowId} did not complete within ${maxWaitMs}ms`);
    }

    /**
     * Unregister a workflow
     */
    public static async unregisterWorkflow(workflowName: string, version: number = 1): Promise<void> {
        try {
            await this.metadataClient.unregisterWorkflow(workflowName, version);
            console.log(`✓ Unregistered workflow: ${workflowName} ${version}`);
        } catch (error) {
            console.warn(`Failed to unregister workflow ${workflowName}: ${error}`);
        }
    }

    /**
     * Wait for workflow to reach expected status
     */
    public static async waitForWorkflowStatus(
        workflowClient: any,
        workflowId: string,
        expectedStatus: string,
        maxWaitTimeMs: number = 15000,
        pollIntervalMs: number = 1000
    ): Promise<any> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTimeMs) {
            try {
                const workflow = await workflowClient.getWorkflow(workflowId, true);

                if (workflow.status === expectedStatus) {
                    return workflow;
                }

                if (workflow.status === 'FAILED' || workflow.status === 'TERMINATED') {
                    throw new Error(`Workflow ended in unexpected state: ${workflow.status}`);
                }

                await this.sleep(pollIntervalMs);
            } catch (error) {
                throw new Error(`Failed to get workflow status: ${error}`);
            }
        }

        throw new Error(`Workflow did not reach status ${expectedStatus} within ${maxWaitTimeMs}ms`);
    }

    /**
     * Sleep utility
     */
    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}