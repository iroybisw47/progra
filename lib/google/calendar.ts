import "server-only";

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

type ListResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export async function listPrimaryCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CALENDAR_API}/calendars/primary/events`);
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    // singleEvents=true expands recurring events into individual instances.
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar API ${res.status}: ${text}`);
    }

    const data = (await res.json()) as ListResponse;
    if (data.items) events.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}
