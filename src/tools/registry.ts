import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseToolHandler } from "../handlers/core/BaseToolHandler.js";

// Import all handlers
import { ListCalendarsHandler } from "../handlers/core/ListCalendarsHandler.js";
import { ListEventsHandler } from "../handlers/core/ListEventsHandler.js";
import { SearchEventsHandler } from "../handlers/core/SearchEventsHandler.js";
import { ListColorsHandler } from "../handlers/core/ListColorsHandler.js";
import { CreateEventHandler } from "../handlers/core/CreateEventHandler.js";
import { UpdateEventHandler } from "../handlers/core/UpdateEventHandler.js";
import { DeleteEventHandler } from "../handlers/core/DeleteEventHandler.js";
import { FreeBusyEventHandler } from "../handlers/core/FreeBusyEventHandler.js";
import { GetCurrentTimeHandler } from "../handlers/core/GetCurrentTimeHandler.js";

// Unified Schema Definitions - Single Source of Truth
// These schemas serve both MCP registration and TypeScript typing

// Base schemas
const RFC3339DateTimeSchema = z.string()
  .datetime({ offset: true })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/, 
    "Must be RFC3339 format with timezone (e.g., '2024-01-01T10:00:00Z' or '2024-01-01T10:00:00-08:00')");

const TimeMinSchema = RFC3339DateTimeSchema.describe(
  "Start time boundary - CRITICAL: Must include timezone. Valid formats: '2024-01-01T00:00:00Z' (UTC) or '2024-01-01T00:00:00-08:00' (Pacific). NEVER omit timezone."
);

const TimeMaxSchema = RFC3339DateTimeSchema.describe(
  "End time boundary - CRITICAL: Must include timezone. Valid formats: '2024-01-01T23:59:59Z' (UTC) or '2024-01-01T23:59:59-08:00' (Pacific). NEVER omit timezone."
);

// Common schemas
const CalendarIdSchema = z.string().describe("ID of the calendar (use 'primary' for the main calendar)");
const EmailSchema = z.string().email();

// Reminder schema for reusability
const RemindersSchema = z.object({
  useDefault: z.boolean().describe("Whether to use the default reminders"),
  overrides: z.array(z.object({
    method: z.enum(["email", "popup"]).default("popup").describe("Reminder method"),
    minutes: z.number().describe("Minutes before the event to trigger the reminder")
  }).partial({ method: true })).optional().describe("Custom reminders")
}).describe("Reminder settings for the event");

// Attendee schema
const AttendeeSchema = z.object({
  email: EmailSchema.describe("Email address of the attendee")
});

// Define all tool schemas with TypeScript inference
export const ToolSchemas = {
  'list-calendars': z.object({}),
  
  'list-events': z.object({
    calendarId: z.string().describe(
      "ID of the calendar(s) to list events from. Accepts either a single calendar ID string or an array of calendar IDs (passed as JSON string like '[\"cal1\", \"cal2\"]')"
    ),
    timeMin: TimeMinSchema.optional(),
    timeMax: TimeMaxSchema.optional()
  }),
  
  'search-events': z.object({
    calendarId: CalendarIdSchema,
    query: z.string().describe(
      "Free text search query (searches summary, description, location, attendees, etc.)"
    ),
    timeMin: TimeMinSchema,
    timeMax: TimeMaxSchema
  }),
  
  'list-colors': z.object({}),
  
  'create-event': z.object({
    calendarId: CalendarIdSchema,
    summary: z.string().describe("Title of the event"),
    description: z.string().optional().describe("Description/notes for the event"),
    start: RFC3339DateTimeSchema.describe(
      "Event start time - CRITICAL: Must be RFC3339 format with timezone. Examples: '2024-01-01T10:00:00Z' (UTC) or '2024-01-01T10:00:00-08:00' (Pacific). NEVER use '2024-01-01T10:00:00' without timezone."
    ),
    end: RFC3339DateTimeSchema.describe(
      "Event end time - CRITICAL: Must be RFC3339 format with timezone. Examples: '2024-01-01T11:00:00Z' (UTC) or '2024-01-01T11:00:00-08:00' (Pacific). NEVER use '2024-01-01T11:00:00' without timezone."
    ),
    timeZone: z.string().describe(
      "Timezone as IANA Time Zone Database name (e.g., America/Los_Angeles)"
    ),
    location: z.string().optional().describe("Location of the event"),
    attendees: z.array(AttendeeSchema).optional().describe("List of attendee email addresses"),
    colorId: z.string().optional().describe(
      "Color ID for the event (use list-colors to see available IDs)"
    ),
    reminders: RemindersSchema.optional(),
    recurrence: z.array(z.string()).optional().describe(
      "Recurrence rules in RFC5545 format (e.g., [\"RRULE:FREQ=WEEKLY;COUNT=5\"])"
    )
  }),
  
  'update-event': z.object({
    calendarId: CalendarIdSchema,
    eventId: z.string().describe("ID of the event to update"),
    summary: z.string().optional().describe("Updated title of the event"),
    description: z.string().optional().describe("Updated description/notes"),
    start: RFC3339DateTimeSchema.optional().describe(
      "Updated start time - CRITICAL: Must be RFC3339 format with timezone. Examples: '2024-01-01T10:00:00Z' (UTC) or '2024-01-01T10:00:00-08:00' (Pacific). NEVER use '2024-01-01T10:00:00' without timezone."
    ),
    end: RFC3339DateTimeSchema.optional().describe(
      "Updated end time - CRITICAL: Must be RFC3339 format with timezone. Examples: '2024-01-01T11:00:00Z' (UTC) or '2024-01-01T11:00:00-08:00' (Pacific). NEVER use '2024-01-01T11:00:00' without timezone."
    ),
    timeZone: z.string().describe("Updated timezone"),
    location: z.string().optional().describe("Updated location"),
    attendees: z.array(AttendeeSchema).optional().describe("Updated attendee list"),
    colorId: z.string().optional().describe("Updated color ID"),
    reminders: RemindersSchema.optional(),
    recurrence: z.array(z.string()).optional().describe("Updated recurrence rules"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe(
      "Whether to send update notifications"
    ),
    modificationScope: z.enum(["thisAndFollowing", "all", "thisEventOnly"]).optional().describe(
      "Scope for recurring event modifications"
    ),
    originalStartTime: RFC3339DateTimeSchema.optional().describe(
      "Original start time of recurring event instance - CRITICAL: Must be RFC3339 format with timezone. Required for 'thisEventOnly' scope."
    ),
    futureStartDate: RFC3339DateTimeSchema.optional().describe(
      "Start date for future instances - CRITICAL: Must be RFC3339 format with timezone. Required for 'thisAndFollowing' scope."
    )
  }).refine(
    (data) => {
      // Require originalStartTime when modificationScope is 'thisEventOnly'
      if (data.modificationScope === 'thisEventOnly' && !data.originalStartTime) {
        return false;
      }
      return true;
    },
    {
      message: "originalStartTime is required when modificationScope is 'thisEventOnly'",
      path: ["originalStartTime"]
    }
  ).refine(
    (data) => {
      // Require futureStartDate when modificationScope is 'thisAndFollowing'
      if (data.modificationScope === 'thisAndFollowing' && !data.futureStartDate) {
        return false;
      }
      return true;
    },
    {
      message: "futureStartDate is required when modificationScope is 'thisAndFollowing'",
      path: ["futureStartDate"]
    }
  ).refine(
    (data) => {
      // Ensure futureStartDate is in the future when provided
      if (data.futureStartDate) {
        const futureDate = new Date(data.futureStartDate);
        const now = new Date();
        return futureDate > now;
      }
      return true;
    },
    {
      message: "futureStartDate must be in the future",
      path: ["futureStartDate"]
    }
  ),
  
  'delete-event': z.object({
    calendarId: CalendarIdSchema,
    eventId: z.string().describe("ID of the event to delete"),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe(
      "Whether to send cancellation notifications"
    )
  }),
  
  'get-freebusy': z.object({
    calendars: z.array(z.object({
      id: CalendarIdSchema
    })).describe(
      "List of calendars and/or groups to query for free/busy information"
    ),
    timeMin: TimeMinSchema,
    timeMax: TimeMaxSchema,
    timeZone: z.string().optional().describe("Timezone for the query"),
    groupExpansionMax: z.number().int().max(100).optional().describe(
      "Maximum number of calendars to expand per group (max 100)"
    ),
    calendarExpansionMax: z.number().int().max(50).optional().describe(
      "Maximum number of calendars to expand (max 50)"
    )
  }),
  
  'get-current-time': z.object({
    timeZone: z.string().optional().describe(
      "Optional IANA timezone (e.g., 'America/Los_Angeles', 'Europe/London', 'UTC'). If not provided, returns UTC time and system timezone for reference."
    )
  })
} as const;

// Generate TypeScript types from schemas
export type ToolInputs = {
  [K in keyof typeof ToolSchemas]: z.infer<typeof ToolSchemas[K]>
};

// Export individual types for convenience
export type ListCalendarsInput = ToolInputs['list-calendars'];
export type ListEventsInput = ToolInputs['list-events'];
export type SearchEventsInput = ToolInputs['search-events'];
export type ListColorsInput = ToolInputs['list-colors'];
export type CreateEventInput = ToolInputs['create-event'];
export type UpdateEventInput = ToolInputs['update-event'];
export type DeleteEventInput = ToolInputs['delete-event'];
export type GetFreeBusyInput = ToolInputs['get-freebusy'];
export type GetCurrentTimeInput = ToolInputs['get-current-time'];

interface ToolDefinition {
  name: keyof typeof ToolSchemas;
  description: string;
  schema: z.ZodType<any>;
  handler: new () => BaseToolHandler;
  handlerFunction?: (args: any) => Promise<any>;
}


export class ToolRegistry {
  private static tools: ToolDefinition[] = [
    {
      name: "list-calendars",
      description: "List all available calendars",
      schema: ToolSchemas['list-calendars'],
      handler: ListCalendarsHandler
    },
    {
      name: "list-events",
      description: "List events from one or more calendars. Each event includes a clickable URL for easy viewing in Google Calendar - always present these URLs to users for convenient access.",
      schema: ToolSchemas['list-events'],
      handler: ListEventsHandler,
      handlerFunction: async (args: ListEventsInput & { calendarId: string | string[] }) => {
        // Validate and preprocess calendarId input for multi-calendar support
        let processedCalendarId: string | string[] = args.calendarId;
        
        // Handle case where calendarId is passed as a JSON string
        if (typeof args.calendarId === 'string' && args.calendarId.trim().startsWith('[') && args.calendarId.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(args.calendarId);
            if (Array.isArray(parsed) && parsed.every(id => typeof id === 'string' && id.length > 0)) {
              if (parsed.length === 0) {
                throw new Error("At least one calendar ID is required");
              }
              if (parsed.length > 50) {
                throw new Error("Maximum 50 calendars allowed per request");
              }
              if (new Set(parsed).size !== parsed.length) {
                throw new Error("Duplicate calendar IDs are not allowed");
              }
              processedCalendarId = parsed;
            } else {
              throw new Error('JSON string must contain an array of non-empty strings');
            }
          } catch (error) {
            throw new Error(
              `Invalid JSON format for calendarId: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
            );
          }
        }
        
        // Additional validation for arrays
        if (Array.isArray(processedCalendarId)) {
          if (processedCalendarId.length === 0) {
            throw new Error("At least one calendar ID is required");
          }
          if (processedCalendarId.length > 50) {
            throw new Error("Maximum 50 calendars allowed per request");
          }
          if (!processedCalendarId.every(id => typeof id === 'string' && id.length > 0)) {
            throw new Error("All calendar IDs must be non-empty strings");
          }
          if (new Set(processedCalendarId).size !== processedCalendarId.length) {
            throw new Error("Duplicate calendar IDs are not allowed");
          }
        }
        
        return { calendarId: processedCalendarId, timeMin: args.timeMin, timeMax: args.timeMax };
      }
    },
    {
      name: "search-events",
      description: "Search for events in a calendar by text query. Each result includes a clickable URL for easy viewing in Google Calendar - always present these URLs to users for convenient access.",
      schema: ToolSchemas['search-events'],
      handler: SearchEventsHandler
    },
    {
      name: "list-colors",
      description: "List available color IDs and their meanings for calendar events",
      schema: ToolSchemas['list-colors'],
      handler: ListColorsHandler
    },
    {
      name: "create-event",
      description: "Create a new calendar event. Returns event details with a clickable URL for immediate viewing in Google Calendar - always share this URL with users so they can easily access their new event.",
      schema: ToolSchemas['create-event'],
      handler: CreateEventHandler
    },
    {
      name: "update-event",
      description: "Update an existing calendar event with recurring event modification scope support. Returns updated event details with a clickable URL for immediate viewing in Google Calendar - always share this URL with users so they can easily access their updated event.",
      schema: ToolSchemas['update-event'],
      handler: UpdateEventHandler
    },
    {
      name: "delete-event",
      description: "Delete a calendar event",
      schema: ToolSchemas['delete-event'],
      handler: DeleteEventHandler
    },
    {
      name: "get-freebusy",
      description: "Query free/busy information for calendars. Note: Time range is limited to a maximum of 3 months between timeMin and timeMax.",
      schema: ToolSchemas['get-freebusy'],
      handler: FreeBusyEventHandler
    },
    {
      name: "get-current-time",
      description: "Get current system time and timezone information. Only use when explicitly asked for current time/date, not for event scheduling or calendar operations.",
      schema: ToolSchemas['get-current-time'],
      handler: GetCurrentTimeHandler
    }
  ];

  static getToolsWithSchemas() {
    return this.tools.map(tool => {
      const jsonSchema = zodToJsonSchema(tool.schema);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: jsonSchema
      };
    });
  }

  static async registerAll(
    server: McpServer, 
    executeWithHandler: (
      handler: any, 
      args: any
    ) => Promise<{ content: Array<{ type: "text"; text: string }> }>
  ) {
    for (const tool of this.tools) {
      // Use the existing registerTool method which handles schema conversion properly
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: 'shape' in tool.schema ? tool.schema.shape : (tool.schema as any)._def.schema.shape
        },
        async (args: any) => {
          // Validate input using our Zod schema
          const validatedArgs = tool.schema.parse(args);
          
          // Apply any custom handler function preprocessing
          const processedArgs = tool.handlerFunction ? await tool.handlerFunction(validatedArgs) : validatedArgs;
          
          // Create handler instance and execute
          const handler = new tool.handler();
          return executeWithHandler(handler, processedArgs);
        }
      );
    }
  }
}