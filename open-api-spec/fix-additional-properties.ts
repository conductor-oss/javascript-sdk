import * as fs from "fs";

// Read the api-docs.json file
const filePath = "open-api-spec/spec.json";
let content = fs.readFileSync(filePath, "utf8");
// fullPayload EventMessage | defaultValue FieldDescriptor 
// Pattern to find and replace:
// "type": "object",
// "additionalProperties": {
//      "type": "object"
// }
//
// Replace with:
// "type": "object",
// "additionalProperties": {}

// Using regex to match the pattern with flexible whitespace
const pattern =
  /("type"\s*:\s*"object"\s*,\s*"additionalProperties"\s*:\s*{\s*"type"\s*:\s*"object"\s*})/g;
const replacement =
  '"type": "object",\n              "additionalProperties": {}';

// Count matches before replacement
const matches = content.match(pattern);
const matchCount = matches ? matches.length : 0;

console.log(`Found ${matchCount} occurrences to replace`);

// Perform the replacement
content = content.replace(pattern, replacement);

// Write back to file
fs.writeFileSync(filePath, content, "utf8");

console.log(
  `✓ Successfully replaced ${matchCount} occurrences in api-docs.json`
);
