import { calendar_v3 } from "googleapis";

/**
 * Generates a Google Calendar event view URL
 */
export function generateEventUrl(calendarId: string, eventId: string): string {
    const encodedCalendarId = encodeURIComponent(calendarId);
    const encodedEventId = encodeURIComponent(eventId);
    return `https://calendar.google.com/calendar/event?eid=${encodedEventId}&cid=${encodedCalendarId}`;
}

/**
 * Formats a single event with URL information
 */
export function formatEventWithUrl(event: calendar_v3.Schema$Event, calendarId?: string): string {
    const attendeeList = event.attendees
        ? `\nAttendees: ${event.attendees
            .map((a) => `${a.email || "no-email"} (${a.responseStatus || "unknown"})`)
            .join(", ")}`
        : "";
    const locationInfo = event.location ? `\nLocation: ${event.location}` : "";
    const descriptionInfo = event.description ? `\nDescription: ${event.description}` : "";
    const colorInfo = event.colorId ? `\nColor ID: ${event.colorId}` : "";
    
    // Use htmlLink from API response if available, otherwise generate URL
    let eventLink = "";
    if (event.htmlLink) {
        eventLink = `\n🔗 View in Google Calendar: ${event.htmlLink}`;
    } else if (calendarId && event.id) {
        eventLink = `\n🔗 View in Google Calendar: ${generateEventUrl(calendarId, event.id)}`;
    }
    
    const reminderInfo = event.reminders
        ? `\nReminders: ${event.reminders.useDefault ? 'Using default' :
            (event.reminders.overrides || []).map((r: any) => `${r.method} ${r.minutes} minutes before`).join(', ') || 'None'}`
        : "";
    
    return `${event.summary || "Untitled"} (${event.id || "no-id"})${locationInfo}${descriptionInfo}${eventLink}\nStart: ${event.start?.dateTime || event.start?.date || "unspecified"}\nEnd: ${event.end?.dateTime || event.end?.date || "unspecified"}${attendeeList}${colorInfo}${reminderInfo}\n`;
}

/**
 * Formats a list of events into a user-friendly string.
 */
export function formatEventList(events: calendar_v3.Schema$Event[], calendarId?: string): string {
    return events
        .map((event) => formatEventWithUrl(event, calendarId))
        .join("\n");
}
