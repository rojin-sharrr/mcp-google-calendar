import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { SearchEventsInput } from "../../tools/registry.js";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { calendar_v3 } from 'googleapis';
import { formatEventList } from "../utils.js";

export class SearchEventsHandler extends BaseToolHandler {
    async runTool(args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {
        const validArgs = args as SearchEventsInput;
        const events = await this.searchEvents(oauth2Client, validArgs);
        return {
            content: [{
                type: "text",
                text: formatEventList(events, validArgs.calendarId),
            }],
        };
    }

    private async searchEvents(
        client: OAuth2Client,
        args: SearchEventsInput
    ): Promise<calendar_v3.Schema$Event[]> {
        try {
            const calendar = this.getCalendar(client);
            const response = await calendar.events.list({
                calendarId: args.calendarId,
                q: args.query,
                timeMin: args.timeMin,
                timeMax: args.timeMax,
                singleEvents: true,
                orderBy: 'startTime',
            });
            return response.data.items || [];
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }
}
