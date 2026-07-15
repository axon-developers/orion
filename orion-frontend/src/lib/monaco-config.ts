import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";

// In Vite, workers must be imported using the ?worker syntax to bundle correctly
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import yamlWorker from "monaco-yaml/yaml.worker.js?worker";

// Custom JSON Schema for Orion Test Cases Step definitions
const orionSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Orion Test Case Schema",
  type: "object",
  properties: {
    testCase: {
      type: "object",
      description: "Test Case Metadata",
      properties: {
        name: { type: "string", description: "The name of the test case scenario" },
        description: { type: "string", description: "Description of what this test case verifies" }
      },
      required: ["name"]
    },
    steps: {
      type: "array",
      description: "Sequence of execution steps",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Human-readable name of the step node" },
          description: { type: "string", description: "Optional description detailing what the step performs" },
          stepType: {
            type: "string",
            description: "Step category executor type",
            enum: [
              "HTTP_REQUEST",
              "SOAP_REQUEST",
              "GRAPHQL_REQUEST",
              "DATABASE_QUERY",
              "BROWSER_AUTOMATION",
              "MAINFRAME_TERMINAL",
              "ASSERTION",
              "SET_VARIABLE",
              "CSV_EXTRACT",
              "RESPONSE_PROCESSOR",
              "LOG",
              "DB_TABLE_VIEW",
              "DELAY",
              "CONDITIONAL",
              "LOOP",
              "SCRIPT",
              "PARALLEL",
              "GLOBAL_REF"
            ]
          },
          enabled: { type: "boolean", default: true, description: "Toggles whether this step runs" },
          config: {
            type: "object",
            description: "Execution configurations unique to stepType"
          }
        },
        required: ["name", "stepType"],
        allOf: [
          {
            "if": { "properties": { "stepType": { "const": "HTTP_REQUEST" } } },
            "then": {
              "properties": {
                "config": {
                  "type": "object",
                  "properties": {
                    "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"] },
                    "url": { "type": "string", "description": "Target endpoint (supports dynamic {{placeholders}})" },
                    "headers": { "type": "object", "description": "Headers key-value maps" },
                    "bodyType": { "type": "string", "enum": ["NONE", "JSON", "XML", "FORM_DATA", "TEXT"] },
                    "body": { "type": "string", "description": "Request payload content" },
                    "timeoutMs": { "type": "integer", "default": 30000 }
                  },
                  "required": ["method", "url"]
                }
              }
            }
          },
          {
            "if": { "properties": { "stepType": { "const": "DATABASE_QUERY" } } },
            "then": {
              "properties": {
                "config": {
                  "type": "object",
                  "properties": {
                    "databaseKey": { "type": "string", "description": "Target JDBC Connection Key" },
                    "connectionString": { "type": "string", "description": "JDBC Connection URL (optional fallback)" },
                    "query": { "type": "string", "description": "SQL SELECT, UPDATE, or DDL script" }
                  },
                  "required": ["query"]
                }
              }
            }
          },
          {
            "if": { "properties": { "stepType": { "const": "DELAY" } } },
            "then": {
              "properties": {
                "config": {
                  "type": "object",
                  "properties": {
                    "durationMs": { "type": "integer", "minimum": 0, "description": "Length of pause in milliseconds" }
                  },
                  "required": ["durationMs"]
                }
              }
            }
          },
          {
            "if": { "properties": { "stepType": { "const": "SCRIPT" } } },
            "then": {
              "properties": {
                "config": {
                  "type": "object",
                  "properties": {
                    "script": { "type": "string", "description": "JavaScript Sandbox ECMAScript 5 code" }
                  },
                  "required": ["script"]
                }
              }
            }
          },
          {
            "if": { "properties": { "stepType": { "const": "LOG" } } },
            "then": {
              "properties": {
                "config": {
                  "type": "object",
                  "properties": {
                    "logLevel": { "type": "string", "enum": ["INFO", "DEBUG", "WARN", "ERROR"] },
                    "message": { "type": "string", "description": "Formatted log message" }
                  },
                  "required": ["message"]
                }
              }
            }
          }
        ]
      }
    }
  }
};

// Configure Monaco environment to spin up the separate YAML worker chunk
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "yaml") {
      return new yamlWorker();
    }
    return new editorWorker();
  },
};

// Apply yaml configuration schema rules
configureMonacoYaml(monaco, {
  enableSchemaRequest: false,
  schemas: [
    {
      uri: "https://orion.dev/schemas/testcase-schema.json",
      fileMatch: ["*"],
      schema: orionSchema
    }
  ]
});

// Configure Monaco Loader wrapper to use our pre-configured instance
loader.config({ monaco });
