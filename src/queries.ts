/**
 * GraphQL query strings for the Fireflies API.
 * Plain template literals — no external gql tag needed.
 */

export const GET_CURRENT_USER = /* GraphQL */ `
  query GetCurrentUser {
    user {
      user_id
      email
      name
    }
  }
`;

/**
 * Fetches a paginated list of transcripts with metadata only.
 * Used for building the manifest without downloading full transcript content.
 *
 * Variables: { limit: Int, skip: Int }
 */
export const LIST_TRANSCRIPTS = /* GraphQL */ `
  query ListTranscripts($limit: Int, $skip: Int) {
    transcripts(limit: $limit, skip: $skip) {
      id
      title
      date
      duration
      host_email
      organizer_email
      participants
      transcript_url
      meeting_attendees {
        displayName
        email
        name
      }
    }
  }
`;

/**
 * Fetches full transcript detail including sentences (the actual conversation).
 * This is the heavy payload — one call per meeting.
 *
 * Variables: { transcriptId: String! }
 */
export const GET_TRANSCRIPT = /* GraphQL */ `
  query GetTranscript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      title
      date
      dateString
      duration
      host_email
      organizer_email
      participants
      transcript_url
      speakers {
        id
        name
      }
      sentences {
        index
        speaker_name
        speaker_id
        text
        raw_text
        start_time
        end_time
      }
      meeting_attendees {
        displayName
        email
        phoneNumber
        name
        location
      }
      meeting_attendance {
        name
        join_time
        leave_time
      }
    }
  }
`;
