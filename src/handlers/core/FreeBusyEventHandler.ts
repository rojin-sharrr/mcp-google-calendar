import { BaseToolHandler } from './BaseToolHandler.js';
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { FreeBusyEventArgumentsSchema } from "../../schemas/validators.js";
import { z } from "zod";
import { FreeBusyResponse } from '../../schemas/types.js';

export class FreeBusyEventHandler extends BaseToolHandler {
  async runTool(args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {

    const validArgs = FreeBusyEventArgumentsSchema.safeParse(args);
    if (!validArgs.success) {
      throw new Error(
          `Invalid arguments Error: ${JSON.stringify(validArgs.error.issues)}`
      );
    }

    if(!this.isLessThanThreeMonths(validArgs.data.timeMin,validArgs.data.timeMax)){
      return {
        content: [{
          type: "text",
          text: "The time gap between timeMin and timeMax must be less than 3 months",
        }],
      }
    }

    const result = await this.queryFreeBusy(oauth2Client, validArgs.data);
    const calendarCount = Object.keys(result.calendars ?? {}).length;
    const groupCount = Object.keys(result.groups ?? {}).length;

    return {
      content: [{
        type: "text",
        text: `Free/busy information retrieved for ${calendarCount} calendar(s) and ${groupCount} group(s).`,
      }],
      data: result,
    };
  }

  private async queryFreeBusy(
    client: OAuth2Client,
    args: z.infer<typeof FreeBusyEventArgumentsSchema>
  ): Promise<any> {
    try {
      const calendar = this.getCalendar(client);
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: args.timeMin,
          timeMax: args.timeMax,
          timeZone: args.timeZone,
          groupExpansionMax: args.groupExpansionMax,
          calendarExpansionMax: args.calendarExpansionMax,
          items: args.items,
        },
      });
      return response.data as FreeBusyResponse;
    } catch (error) {
      throw this.handleGoogleApiError(error);
    }
  }

  private isLessThanThreeMonths (timeMin: string, timeMax: string): boolean {
    const minDate = new Date(timeMin);
    const maxDate = new Date(timeMax);

    const diffInMilliseconds = maxDate.getTime() - minDate.getTime();
    const threeMonthsInMilliseconds = 3 * 30 * 24 * 60 * 60 * 1000;

    // Check if the difference is less than or equal to 3 months
    return diffInMilliseconds <= threeMonthsInMilliseconds;
  };
}
