import {
  expect,
  describe,
  test,
  jest,
  beforeAll,
  afterEach,
} from "@jest/globals";
import { orkesConductorClient, ApplicationClient } from "../../sdk";
import type { Tag } from "../../open-api";

describe("ApplicationClient", () => {
  jest.setTimeout(60000);

  let applicationClient: ApplicationClient;
  const testAppsToCleanup: string[] = [];

  beforeAll(async () => {
    applicationClient = new ApplicationClient(await orkesConductorClient());
  });

  afterEach(async () => {
    for (const appId of testAppsToCleanup) {
      try {
        await applicationClient.deleteApplication(appId);
      } catch (error: unknown) {
        console.debug(`Failed to delete application ${appId}:`, error);
      }
    }
    testAppsToCleanup.length = 0;
  });

  // Helper function to create unique names
  const createUniqueName = (prefix: string) =>
    `jsSdkTest-${prefix}-${Date.now()}`;

  describe("Application Management", () => {
    test("Should create a new application", async () => {
      const appName = createUniqueName("test-app-create");

      const createdApp = await applicationClient.createApplication(appName);

      expect(createdApp).toBeDefined();
      expect(createdApp.name).toEqual(appName);
      expect(createdApp.id).toBeDefined();
      expect(typeof createdApp.id).toBe("string");
      expect(createdApp.createdBy).toBeDefined();
      expect(typeof createdApp.createTime).toBe("number");

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should get all applications", async () => {
      const appName = createUniqueName("test-app-get-all");

      const createdApp = await applicationClient.createApplication(appName);

      expect(createdApp.id).toBeDefined();

      const applications = await applicationClient.getAllApplications();

      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThan(0);

      const foundApp = applications.find((app) => app.id === createdApp.id);
      expect(foundApp).toBeDefined();
      expect(foundApp?.name).toEqual(appName);
      expect(foundApp?.id).toEqual(createdApp.id);

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should get an application by id", async () => {
      const appName = createUniqueName("test-app-get-by-id");

      const createdApp = await applicationClient.createApplication(appName);

      expect(createdApp.id).toBeDefined();

      const retrievedApp = await applicationClient.getApplication(
        createdApp.id
      );

      expect(retrievedApp).toBeDefined();
      expect(retrievedApp.id).toEqual(createdApp.id);
      expect(retrievedApp.name).toEqual(appName);
      expect(retrievedApp.createdBy).toBeDefined();
      expect(typeof retrievedApp.createTime).toBe("number");

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should update an application", async () => {
      const appName = createUniqueName("test-app-update");
      const newAppName = createUniqueName("test-app-updated");

      const createdApp = await applicationClient.createApplication(appName);

      expect(createdApp.id).toBeDefined();

      const updatedApp = await applicationClient.updateApplication(
        createdApp.id,
        newAppName
      );

      expect(updatedApp).toBeDefined();
      expect(updatedApp.id).toEqual(createdApp.id);
      expect(updatedApp.name).toEqual(newAppName);
      expect(updatedApp.name).not.toEqual(appName);

      const retrievedApp = await applicationClient.getApplication(
        createdApp.id
      );
      expect(retrievedApp.name).toEqual(newAppName);

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should delete an application", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const retrievedApp = await applicationClient.getApplication(
        createdApp.id
      );
      expect(retrievedApp.id).toEqual(createdApp.id);

      await expect(
        applicationClient.deleteApplication(createdApp.id)
      ).resolves.not.toThrow();

      await expect(
        applicationClient.getApplication(createdApp.id)
      ).rejects.toThrow();
    });
  });

  describe("Access Key Management", () => {
    test("Should create an access key for an application", async () => {
      const appName = createUniqueName("test-app-access-key-create");

      const createdApp = await applicationClient.createApplication(appName);

      expect(createdApp.id).toBeDefined();

      const accessKey = await applicationClient.createAccessKey(createdApp.id);

      expect(accessKey).toBeDefined();
      expect(typeof accessKey).toBe("object");
      expect(accessKey.id).toBeDefined();
      expect(typeof accessKey.id).toBe("string");
      expect(accessKey.secret).toBeDefined();
      expect(typeof accessKey.secret).toBe("string");

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should get access keys for an application", async () => {
      const appName = createUniqueName("test-app-get-access-keys");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const createdKey = await applicationClient.createAccessKey(createdApp.id);
      expect(createdKey.id).toBeDefined();

      const accessKeys = await applicationClient.getAccessKeys(createdApp.id);

      expect(accessKeys).toBeDefined();
      expect(Array.isArray(accessKeys)).toBe(true);
      expect(accessKeys.length).toBeGreaterThan(0);

      const foundKey = accessKeys.find((key) => key.id === createdKey.id);
      expect(foundKey).toBeDefined();
      expect(foundKey?.id).toEqual(createdKey.id);
      expect(foundKey?.createdAt).toBeDefined();
      expect(typeof foundKey?.createdAt).toBe("number");
      expect(foundKey?.status).toBeDefined();
      expect(["ACTIVE", "INACTIVE"]).toContain(foundKey?.status);

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should toggle access key status", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const accessKey = await applicationClient.createAccessKey(createdApp.id);

      expect(accessKey.id).toBeDefined();

      const toggleResult = await applicationClient.toggleAccessKeyStatus(
        createdApp.id,
        accessKey.id
      );

      expect(toggleResult).toBeDefined();
      expect(typeof toggleResult).toBe("object");
      expect(toggleResult.id).toEqual(accessKey.id);
      expect(toggleResult.createdAt).toBeDefined();
      expect(typeof toggleResult.createdAt).toBe("number");
      expect(toggleResult.status).toEqual("INACTIVE");

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should delete an access key", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const accessKey = await applicationClient.createAccessKey(createdApp.id);
      expect(accessKey.id).toBeDefined();

      await expect(
        applicationClient.deleteAccessKey(createdApp.id, accessKey.id)
      ).resolves.not.toThrow();

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should get app by access key id", async () => {
      const appName = createUniqueName("test-app-get-by-access-key");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const accessKey = await applicationClient.createAccessKey(createdApp.id);
      expect(accessKey.id).toBeDefined();

      const appByAccessKey = await applicationClient.getAppByAccessKeyId(
        accessKey.id
      );

      expect(appByAccessKey).toBeDefined();
      expect(typeof appByAccessKey).toBe("object");
      expect(appByAccessKey.id).toEqual(createdApp.id);
      expect(appByAccessKey.name).toEqual(appName);
      expect(appByAccessKey.createdBy).toBeDefined();
      expect(typeof appByAccessKey.createTime).toBe("number");

      testAppsToCleanup.push(createdApp.id);
    });
  });

  describe("Role Management", () => {
    test("Should add and remove role from application", async () => {
      const appName = createUniqueName("test-app-role");
      const role = "APPLICATION_MANAGER";

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      await expect(
        applicationClient.addApplicationRole(createdApp.id, role)
      ).resolves.not.toThrow();

      await expect(
        applicationClient.removeRoleFromApplicationUser(createdApp.id, role)
      ).resolves.not.toThrow();

      testAppsToCleanup.push(createdApp.id);
    });
  });

  describe("Tag Management", () => {
    test("Should add a single tag to an application", async () => {
      const appName = createUniqueName("test-app-add-tag");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const tag: Tag = {
        key: "test-key",
        value: "test-value",
      };

      await expect(
        applicationClient.addApplicationTag(createdApp.id, tag)
      ).resolves.not.toThrow();

      const tags = await applicationClient.getApplicationTags(createdApp.id);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(1);

      const foundTag = tags.find(
        (t) => t.key === tag.key && t.value === tag.value
      );
      expect(foundTag).toBeDefined();
      expect(foundTag?.key).toEqual(tag.key);
      expect(foundTag?.value).toEqual(tag.value);

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should add multiple tags to an application", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "environment", value: "test" },
      ];

      await expect(
        applicationClient.addApplicationTags(createdApp.id, tags)
      ).resolves.not.toThrow();

      const retrievedTags = await applicationClient.getApplicationTags(
        createdApp.id
      );

      expect(Array.isArray(retrievedTags)).toBe(true);
      expect(retrievedTags.length).toBeGreaterThanOrEqual(tags.length);

      tags.forEach((expectedTag) => {
        const foundTag = retrievedTags.find(
          (tag) =>
            tag.key === expectedTag.key && tag.value === expectedTag.value
        );
        expect(foundTag).toBeDefined();
        expect(foundTag?.key).toEqual(expectedTag.key);
        expect(foundTag?.value).toEqual(expectedTag.value);
      });

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should get tags for an application", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const expectedTags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
      ];

      await applicationClient.addApplicationTags(createdApp.id, expectedTags);

      const retrievedTags = await applicationClient.getApplicationTags(
        createdApp.id
      );

      expect(Array.isArray(retrievedTags)).toBe(true);
      expect(retrievedTags.length).toBeGreaterThanOrEqual(expectedTags.length);

      expectedTags.forEach((expectedTag) => {
        const foundTag = retrievedTags.find(
          (tag) =>
            tag.key === expectedTag.key && tag.value === expectedTag.value
        );
        expect(foundTag).toBeDefined();
      });

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should delete a single tag from an application", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
      ];

      await applicationClient.addApplicationTags(createdApp.id, tags);

      const tagToDelete = tags[0];
      const remainingTag = tags[1];

      await expect(
        applicationClient.deleteApplicationTag(createdApp.id, tagToDelete)
      ).resolves.not.toThrow();

      const retrievedTags = await applicationClient.getApplicationTags(
        createdApp.id
      );

      const foundDeletedTag = retrievedTags.find(
        (tag) => tag.key === tagToDelete.key && tag.value === tagToDelete.value
      );
      expect(foundDeletedTag).toBeUndefined();

      const foundRemainingTag = retrievedTags.find(
        (tag) =>
          tag.key === remainingTag.key && tag.value === remainingTag.value
      );
      expect(foundRemainingTag).toBeDefined();

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should delete multiple tags from an application", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      if (!createdApp.id) return;
      testAppsToCleanup.push(createdApp.id);

      const tags: Tag[] = [
        { key: "test-key-1", value: "test-value-1" },
        { key: "test-key-2", value: "test-value-2" },
        { key: "test-key-3", value: "test-value-3" },
      ];

      await applicationClient.addApplicationTags(createdApp.id, tags);

      const tagsToDelete = [tags[0], tags[1]];
      const remainingTag = tags[2];

      await expect(
        applicationClient.deleteApplicationTags(createdApp.id, tagsToDelete)
      ).resolves.not.toThrow();

      const retrievedTags = await applicationClient.getApplicationTags(
        createdApp.id
      );

      tagsToDelete.forEach((deletedTag) => {
        const foundTag = retrievedTags.find(
          (tag) => tag.key === deletedTag.key && tag.value === deletedTag.value
        );
        expect(foundTag).toBeUndefined();
      });

      const foundRemainingTag = retrievedTags.find(
        (tag) =>
          tag.key === remainingTag.key && tag.value === remainingTag.value
      );
      expect(foundRemainingTag).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("Should throw error when getting non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");

      await expect(
        applicationClient.getApplication(nonExistentId)
      ).rejects.toThrow();
    });

    test("Should throw error when updating non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");
      const newName = createUniqueName("new-name");

      await expect(
        applicationClient.updateApplication(nonExistentId, newName)
      ).rejects.toThrow();
    });

    test("Should throw error when deleting non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");

      await expect(
        applicationClient.deleteApplication(nonExistentId)
      ).rejects.toThrow();
    });

    test("Should throw error when creating access key for non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");

      await expect(
        applicationClient.createAccessKey(nonExistentId)
      ).rejects.toThrow();
    });

    test("Should throw error when getting access keys for non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");

      await expect(
        applicationClient.getAccessKeys(nonExistentId)
      ).rejects.toThrow();
    });

    test("Should throw error when deleting non-existent access key", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const nonExistentKeyId = createUniqueName("non-existent-key-id");

      await expect(
        applicationClient.deleteAccessKey(createdApp.id, nonExistentKeyId)
      ).rejects.toThrow();

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should throw error when toggling status of non-existent access key", async () => {
      const appName = createUniqueName("test-app");

      const createdApp = await applicationClient.createApplication(appName);
      expect(createdApp.id).toBeDefined();

      const nonExistentKeyId = createUniqueName("non-existent-key-id");
      await expect(
        applicationClient.toggleAccessKeyStatus(createdApp.id, nonExistentKeyId)
      ).rejects.toThrow();

      testAppsToCleanup.push(createdApp.id);
    });

    test("Should throw error when getting app by non-existent access key id", async () => {
      const nonExistentKeyId = createUniqueName("non-existent-key-id");

      await expect(
        applicationClient.getAppByAccessKeyId(nonExistentKeyId)
      ).rejects.toThrow();
    });

    test("Should throw error when adding role to non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");
      const role = "USER";

      await expect(
        applicationClient.addApplicationRole(nonExistentId, role)
      ).rejects.toThrow();
    });

    test("Should throw error when removing role from non-existent application", async () => {
      const nonExistentId = createUniqueName("non-existent-app-id");
      const role = "USER";

      await expect(
        applicationClient.removeRoleFromApplicationUser(nonExistentId, role)
      ).rejects.toThrow();
    });

    test("Should throw error when creating application with empty name", async () => {
      await expect(applicationClient.createApplication("")).rejects.toThrow();
    });

    // TODO: Uncomment these tests after BE update with related fixes
    // test("Should throw error when getting tags for non-existent application", async () => {
    //   const nonExistentId = createUniqueName("non-existent-app-id");

    //   await expect(
    //     applicationClient.getApplicationTags(nonExistentId)
    //   ).rejects.toThrow();
    // });

    // test("Should throw error when adding tags to non-existent application", async () => {
    //   const nonExistentId = createUniqueName("non-existent-app-id");
    //   const tags: Tag[] = [{ key: "test", value: "test" }];

    //   await expect(
    //     applicationClient.addApplicationTags(nonExistentId, tags)
    //   ).rejects.toThrow();
    // });

    // test("Should throw error when deleting tags from non-existent application", async () => {
    //   const nonExistentId = createUniqueName("non-existent-app-id");
    //   const tags: Tag[] = [{ key: "test", value: "test" }];

    //   await expect(
    //     applicationClient.deleteApplicationTags(nonExistentId, tags)
    //   ).rejects.toThrow();
    // });
  });
});
