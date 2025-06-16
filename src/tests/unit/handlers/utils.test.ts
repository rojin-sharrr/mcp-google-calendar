import { describe, it, expect } from 'vitest';
import { generateEventUrl, formatEventWithUrl, formatEventList } from '../../../handlers/utils.js';
import { calendar_v3 } from 'googleapis';

describe('Event URL Utilities', () => {
    describe('generateEventUrl', () => {
        it('should generate a proper Google Calendar event URL', () => {
            const calendarId = 'user@example.com';
            const eventId = 'abc123def456';
            const url = generateEventUrl(calendarId, eventId);
            
            expect(url).toBe('https://calendar.google.com/calendar/event?eid=abc123def456&cid=user%40example.com');
        });

        it('should properly encode special characters in calendar ID', () => {
            const calendarId = 'user@test-calendar.com';
            const eventId = 'event123';
            const url = generateEventUrl(calendarId, eventId);
            
            expect(url).toBe('https://calendar.google.com/calendar/event?eid=event123&cid=user%40test-calendar.com');
        });

        it('should properly encode special characters in event ID', () => {
            const calendarId = 'user@example.com';
            const eventId = 'event+with+special&chars';
            const url = generateEventUrl(calendarId, eventId);
            
            expect(url).toBe('https://calendar.google.com/calendar/event?eid=event%2Bwith%2Bspecial%26chars&cid=user%40example.com');
        });
    });

    describe('formatEventWithUrl', () => {
        const mockEvent: calendar_v3.Schema$Event = {
            id: 'test123',
            summary: 'Test Event',
            start: { dateTime: '2024-03-15T10:00:00-07:00' },
            end: { dateTime: '2024-03-15T11:00:00-07:00' },
            location: 'Conference Room A',
            description: 'Test meeting'
        };

        it('should use htmlLink when available', () => {
            const eventWithHtmlLink = {
                ...mockEvent,
                htmlLink: 'https://calendar.google.com/event?eid=existing123'
            };
            
            const result = formatEventWithUrl(eventWithHtmlLink);
            expect(result).toContain('🔗 View in Google Calendar: https://calendar.google.com/event?eid=existing123');
        });

        it('should generate URL when htmlLink is not available but calendarId is provided', () => {
            const result = formatEventWithUrl(mockEvent, 'user@example.com');
            expect(result).toContain('🔗 View in Google Calendar: https://calendar.google.com/calendar/event?eid=test123&cid=user%40example.com');
        });

        it('should not include URL when htmlLink is not available and calendarId is not provided', () => {
            const result = formatEventWithUrl(mockEvent);
            expect(result).not.toContain('🔗 View in Google Calendar:');
        });

        it('should format all event details correctly', () => {
            const result = formatEventWithUrl(mockEvent, 'user@example.com');
            
            expect(result).toContain('Test Event (test123)');
            expect(result).toContain('Location: Conference Room A');
            expect(result).toContain('Description: Test meeting');
            expect(result).toContain('Start: 2024-03-15T10:00:00-07:00');
            expect(result).toContain('End: 2024-03-15T11:00:00-07:00');
            expect(result).toContain('🔗 View in Google Calendar: https://calendar.google.com/calendar/event?eid=test123&cid=user%40example.com');
        });
    });

    describe('formatEventList', () => {
        const mockEvents: calendar_v3.Schema$Event[] = [
            {
                id: 'event1',
                summary: 'Event 1',
                start: { dateTime: '2024-03-15T10:00:00-07:00' },
                end: { dateTime: '2024-03-15T11:00:00-07:00' }
            },
            {
                id: 'event2',
                summary: 'Event 2',
                start: { dateTime: '2024-03-15T14:00:00-07:00' },
                end: { dateTime: '2024-03-15T15:00:00-07:00' }
            }
        ];

        it('should format multiple events with calendar ID', () => {
            const result = formatEventList(mockEvents, 'user@example.com');
            
            expect(result).toContain('Event 1 (event1)');
            expect(result).toContain('Event 2 (event2)');
            expect(result).toContain('🔗 View in Google Calendar: https://calendar.google.com/calendar/event?eid=event1&cid=user%40example.com');
            expect(result).toContain('🔗 View in Google Calendar: https://calendar.google.com/calendar/event?eid=event2&cid=user%40example.com');
        });

        it('should format events without URLs when calendar ID is not provided', () => {
            const result = formatEventList(mockEvents);
            
            expect(result).toContain('Event 1 (event1)');
            expect(result).toContain('Event 2 (event2)');
            expect(result).not.toContain('🔗 View in Google Calendar:');
        });

        it('should handle empty event list', () => {
            const result = formatEventList([]);
            expect(result).toBe('');
        });
    });
});