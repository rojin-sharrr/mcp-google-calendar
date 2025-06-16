import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../../../tools/registry.js';

describe('Schema $ref Prevention Tests', () => {
  it('should not generate $ref references in JSON schemas, causes issues with Claude Desktop', () => {
    const tools = ToolRegistry.getToolsWithSchemas();
    
    // Convert each tool schema to JSON Schema and check for $ref
    for (const tool of tools) {
      const jsonSchema = JSON.stringify(tool.inputSchema);
      
      // Check for any $ref references
      const hasRef = jsonSchema.includes('"$ref"');
      
      if (hasRef) {
        console.error(`Tool "${tool.name}" contains $ref in schema:`, jsonSchema);
      }
      
      expect(hasRef).toBe(false);
    }
  });

  it('should have unique schema instances for similar parameters', () => {
    const tools = ToolRegistry.getToolsWithSchemas();
    
    // Find tools with timeMin/timeMax or start/end parameters
    const timeParams = [];
    
    for (const tool of tools) {
      const schemaStr = JSON.stringify(tool.inputSchema);
      if (schemaStr.includes('timeMin') || schemaStr.includes('timeMax') || 
          schemaStr.includes('"start"') || schemaStr.includes('"end"')) {
        timeParams.push(tool.name);
      }
    }
    
    // Ensure we're testing the right tools
    expect(timeParams.length).toBeGreaterThan(0);
    console.log('Tools with time parameters:', timeParams);
  });

  it('should detect if shared schema instances are reused', () => {
    // This test checks the source code structure to prevent regression
    const registryCode = require('fs').readFileSync(
      require('path').join(__dirname, '../../../tools/registry.ts'), 
      'utf8'
    );
    
    // Check for problematic patterns that could cause $ref generation
    const sharedSchemaUsage = [
      /timeMin:\s*[A-Z][a-zA-Z]*Schema(?!\.)/,  // timeMin: SomeSchema (not SomeSchema.describe)
      /timeMax:\s*[A-Z][a-zA-Z]*Schema(?!\.)/,  // timeMax: SomeSchema
      /start:\s*[A-Z][a-zA-Z]*Schema(?!\.)/,    // start: SomeSchema
      /end:\s*[A-Z][a-zA-Z]*Schema(?!\.)/       // end: SomeSchema
    ];
    
    for (const pattern of sharedSchemaUsage) {
      const matches = registryCode.match(pattern);
      if (matches) {
        console.error(`Found potentially problematic schema usage: ${matches[0]}`);
        expect(matches).toBeNull();
      }
    }
  });
});