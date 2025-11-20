import * as fs from "fs";

// Read the api-docs.json file
const filePath = "src/open-api/spec/spec.json";
let content = fs.readFileSync(filePath, "utf8");

// Pattern 1: Handle nested object case
// "type": "object",
// "additionalProperties": {
//      "type": "object"
// }
//
// Replace with:
// "type": "object",
// "additionalProperties": {}

const pattern1 =
  /("type"\s*:\s*"object"\s*,\s*"additionalProperties"\s*:\s*{\s*"type"\s*:\s*"object"\s*})/g;
const replacement1 =
  '"type": "object",\n              "additionalProperties": {}';

const matches1 = content.match(pattern1);
const matchCount1 = matches1 ? matches1.length : 0;
console.log(`Found ${matchCount1} nested object patterns to replace`);
content = content.replace(pattern1, replacement1);

// Pattern 2: Handle all bare "type": "object" properties within component schemas
// Fix ALL properties with "type": "object" that lack additionalProperties
// But EXCLUDE:
// - "schema" properties (used in responses/requests)
// - Properties that already have additionalProperties

// First, let's find all bare "type": "object" within property definitions
// Match pattern: "propertyName": { "type": "object" } (followed by closing brace)
// But NOT "schema": { "type": "object" }

const pattern2 =
  /("(?!schema)[^"]+"\s*:\s*{\s*)"type"\s*:\s*"object"(\s*\n\s*})/g;

// Find matches within the components/schemas section only
const componentsStart = content.indexOf('"components"');
const componentsEnd = content.lastIndexOf("}"); // End of file

let matchCount2 = 0;
const fixedProperties = new Set();

if (componentsStart !== -1) {
  // Work only within the components section
  const beforeComponents = content.substring(0, componentsStart);
  let componentsSection = content.substring(componentsStart, componentsEnd);
  const afterComponents = content.substring(componentsEnd);

  // Replace in components section only
  componentsSection = componentsSection.replace(
    pattern2,
    (match, g1, g2) => {
      // Extract property name for logging
      const propNameMatch = g1.match(/"([^"]+)"\s*:\s*{\s*$/);
      const propName = propNameMatch ? propNameMatch[1] : "unknown";

      matchCount2++;
      fixedProperties.add(propName);

      return `${g1}"type": "object",\n              "additionalProperties": {}${g2}`;
    }
  );

  content = beforeComponents + componentsSection + afterComponents;
}

console.log(`Found ${matchCount2} bare object patterns to fix`);

// Write back to file
fs.writeFileSync(filePath, content, "utf8");

const totalCount = matchCount1 + matchCount2;
console.log(
  `✓ Successfully fixed ${totalCount} total occurrences (${matchCount1} nested object + ${matchCount2} bare object)`
);
