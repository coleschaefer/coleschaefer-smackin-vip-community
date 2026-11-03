export type CapabilityStatus = "supported" | "unsupported" | "needs_setup" | "degraded";

export interface Capability {
  key: string;
  name: string;
  status: CapabilityStatus;
  summary: string;
  evidence: Record<string, unknown>;
}

const checkedAt = "2026-11-03T21:00:00.000Z";

export const CAPABILITIES: Capability[] = [
  {
    key: "facebook_group_feed_read",
    name: "Facebook Graph group feed read",
    status: "unsupported",
    summary:
      "The public Groups API that returned group posts and comments was removed. This app does not read the live feed.",
    evidence: {
      checkedAt,
      sources: [
        "https://developers.facebook.com/docs/graph-api/changelog/version19.0/",
        "https://support.buffer.com/article/570-connecting-facebook-groups-and-troubleshooting-connections",
        "https://help.zapier.com/hc/en-us/articles/23970212345357-App-update-Facebook-Groups-app-removal",
      ],
      finding:
        "Graph API v19.0 deprecated publish_to_groups, groups_access_member_info, and the Groups API, removed across versions on 2024-04-22. The v19 changelog page timed out on a direct fetch during this build; the removal text was corroborated by Buffer and Zapier notices dated to that change. A user token cannot restore it.",
    },
  },
  {
    key: "facebook_group_publish",
    name: "Facebook Graph group publish",
    status: "unsupported",
    summary: "Unattended publishing to the group through the Graph API is not available.",
    evidence: {
      checkedAt,
      finding:
        "publish_to_groups was removed with the Groups API on 2024-04-22. This codebase exports no Graph write call.",
    },
  },
  {
    key: "facebook_group_comment",
    name: "Facebook Graph group comment",
    status: "unsupported",
    summary: "The app cannot post comments into the group through the Graph API.",
    evidence: {
      checkedAt,
      finding: "Commenting on group posts depended on the removed Groups API. Replies stay in the human-assisted queue.",
    },
  },
  {
    key: "facebook_group_member_read",
    name: "Facebook Graph member list",
    status: "unsupported",
    summary: "Member identity from the group is not available through the public API.",
    evidence: {
      checkedAt,
      finding: "groups_access_member_info was removed on 2024-04-22. Staff exclusion is an operator-maintained list.",
    },
  },
  {
    key: "facebook_unattended_read_write",
    name: "Unattended Facebook read/write",
    status: "unsupported",
    summary: "There is no supported unattended read or write path for this group.",
    evidence: {
      checkedAt,
      finding:
        "No scraped session, no vaulted password, and no unofficial token is used. Browser posting is a person using Facebook after a draft is approved.",
    },
  },
  {
    key: "human_assisted_browser_publish",
    name: "Human-assisted browser publish",
    status: "supported",
    summary:
      "Supported as a human procedure in this app: approved draft, a person posts in Facebook, then pastes the permalink. It does not run unattended.",
    evidence: {
      checkedAt,
      primary: true,
      groupId: "604690051505802",
      finding:
        "The publication row stays awaiting_human until a permalink and attestation arrive. Verified means the operator attested and the URL is a post in this group. The app does not fetch Facebook to prove the post exists.",
    },
  },
  {
    key: "permalink_verification",
    name: "Permalink shape check",
    status: "supported",
    summary:
      "The app checks that a pasted URL is a /groups/604690051505802/posts/{id} link and that a human attested. It does not call Facebook.",
    evidence: {
      checkedAt,
      finding: "Short facebook.com/share links stay unverified because the group id is not in the URL.",
    },
  },
  {
    key: "buffer_channel_connected",
    name: "Buffer group channel",
    status: "degraded",
    summary:
      "The SMACKIN’ VIP group channel is connected in Buffer. The stored group URL has a duplicated https scheme, so the channel record is degraded.",
    evidence: {
      checkedAt,
      readOnly: true,
      organizationId: "6aea481c2f2977ad27bd75d1",
      channelId: "6aea4900e29c69a17150b894",
      account: "cole@smackinsnacks.com",
      service: "facebook",
      type: "group",
      isDisconnected: false,
      externalLink: "https://https://www.facebook.com/groups/604690051505802",
      finding:
        "Read on 2026-11-03 via the connected Buffer account. No post was created. externalLink repeats the https scheme. Buffer documents that group posts are notification-only.",
      sources: [
        "https://support.buffer.com/article/570-connecting-facebook-groups-and-troubleshooting-connections",
        "https://developers.buffer.com/types/SchedulingType.html",
      ],
    },
  },
  {
    key: "buffer_notification_schedule",
    name: "Buffer notification scheduling",
    status: "needs_setup",
    summary:
      "Backup only. The client can queue schedulingType=notification after approval in bounded live mode. No API key is stored for this app, so the call is not live.",
    evidence: {
      checkedAt,
      endpoint: "https://api.buffer.com",
      schedulingType: "notification",
      finding:
        "Needs BUFFER_API_KEY from Buffer Settings → API. A successful call records buffer_notification_scheduled, never verified. Automatic scheduling is refused in code.",
    },
  },
  {
    key: "buffer_automatic_group_publish",
    name: "Buffer automatic group publish",
    status: "unsupported",
    summary: "Buffer cannot automatically publish to Facebook groups.",
    evidence: {
      checkedAt,
      finding:
        "Buffer help: group posts are always sent as notifications because Meta's API does not support automatic group posting. schedulingType=automatic is rejected before any request.",
    },
  },
  {
    key: "google_drive_runtime_sync",
    name: "Google Drive sync from this app",
    status: "needs_setup",
    summary: "The running app has no Google credential and does not sync the VIP folder.",
    evidence: {
      checkedAt,
      folderId: "1oNe5i3nNx-jm9ckuurF44ogtVctqicJ3",
      finding: "Drive access during setup used the operator session, not an app token. Nothing is written back to Drive.",
    },
  },
  {
    key: "google_drive_setup_session_read",
    name: "Drive folder seen in setup",
    status: "degraded",
    summary:
      "The Facebook VIP folder was readable in the setup session. That read is evidence, not an ongoing connector.",
    evidence: {
      checkedAt,
      folderId: "1oNe5i3nNx-jm9ckuurF44ogtVctqicJ3",
      documentId: "1eSj5KKoOdlaAAXV1HXokgmqmFtTBzptBvHIBwIG1TaI",
      documentTitle: "VIP Featured Drafts Review 2026-11-03",
      modifiedTime: "2026-11-03T20:56:58.741Z",
      finding: "One Google Doc was listed. Hub drafts in this app were copied from it and remain unpublished.",
    },
  },
  {
    key: "grok_function_calling",
    name: "Grok tool calling",
    status: "needs_setup",
    summary:
      "The app calls the xAI Responses API and executes tools locally. No XAI_API_KEY is configured in this environment, so live model calls are not claimed.",
    evidence: {
      checkedAt,
      endpoint: "https://api.x.ai/v1/responses",
      docs: "https://docs.x.ai/developers/tools/function-calling",
      modelDefault: "grok-4.7",
      finding:
        "Tools cover knowledge, follow-ups, drafts, calendar proposals, and metrics. Approve and publish are not tools. A successful grok_runs row moves this capability to supported.",
    },
  },
  {
    key: "contribution_ingest",
    name: "Live contribution ingest",
    status: "degraded",
    summary:
      "Unique-contributor metrics accept manual entry and CSV-style import. There is no live group ingest.",
    evidence: {
      checkedAt,
      finding:
        "Sample rows are tagged sample_not_live and are not the official metric. Demo rows are tagged demo_fixture. Reactions are stored and reported separately.",
    },
  },
];

export function capabilityByKey(key: string): Capability | undefined {
  return CAPABILITIES.find((item) => item.key === key);
}
